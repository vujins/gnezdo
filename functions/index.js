const functions = require("firebase-functions")
const { Telegraf } = require('telegraf')
const admin = require('firebase-admin')
const google_billing = require('googleapis/build/src/apis/cloudbilling')
const google_compute = require('googleapis/build/src/apis/compute')
const { GoogleAuth } = require('google-auth-library')
const scrapeHalooglasi = require('./scrapers/halooglasi/scraper').scrape
const scrapeCityExpert = require('./scrapers/cityexpert/scraper').scrape
const geofire = require('geofire-common')
const types = require('./utils/types')

const typesToScrape = [types.houseSale, types.apartmentSale, types.landSale]
const firestore = admin.initializeApp().firestore()
firestore.settings({ ignoreUndefinedProperties: true })
const billing = google_billing.cloudbilling('v1')
const PROJECT_ID = process.env.GCLOUD_PROJECT
const PROJECT_NAME = `projects/${PROJECT_ID}`

// const adminChatId = 838164104

// firestore paths
const usersDocPath = '/scraping/users'
const infoDocPath = '/scraping/info'

const helpText = `
Welcome to Gnezdo!
/help - get this help text.
/limit {amount} - set the price limit for your search (amount can be 200k or 200000).
/radius {km} - set the search radius in km for your locations.
/go - start notifications.
/pause - pause notifications.
/reset - reset ALL search parameters.
/type {types seperated by space} - available: [house-sale, apartment-sale, apartment-rent, other-sale] (other means room, apartmant in house, etc.). Default all. (e.g. /type house-sale apartmant-sale)
Send custom location to search in the set radius around sent locations.
/img - to toggle receiving images with properties.
`

// ~~~~~~~~~~~~~~~~~~~~~~~~ TELEGRAM ~~~~~~~~~~~~~~~~~~~~~~~~

const bot = new Telegraf(functions.config().telegram.token, {
  telegram: { webhookReply: true },
})

// error handling
bot.catch((err, ctx) => {
  functions.logger.error('[Bot] Error', err)
  return ctx.reply(`Ooops, encountered an error for ${ctx.updateType}`, err)
})

bot.command('/start', async (ctx) => {
  const chatId = ctx.message.chat.id
  functions.logger.info(`Users ${chatId} search is registered!`)
  await updateCurrentUser(chatId, { active: false })
  return ctx.reply(helpText)
})

bot.command('/help', async (ctx) => {
  return ctx.reply(helpText)
})

bot.command('/go', async (ctx) => {
  const chatId = ctx.message.chat.id
  functions.logger.info(`Users ${chatId} search is started!`)
  await updateCurrentUser(chatId, { active: true })
  return ctx.reply(`Search started!`)
})

bot.command('/pause', async (ctx) => {
  const chatId = ctx.message.chat.id
  functions.logger.info(`User ${chatId} is paused!`)
  await updateCurrentUser(chatId, { active: false })
  return ctx.reply(`Search paused!`)
})

bot.command('/reset', async (ctx) => {
  const chatId = ctx.message.chat.id
  functions.logger.info(`User ${chatId} is reset!`)
  await resetUser(chatId)
  return ctx.reply(`Locations and radius reset reset!`)
})

bot.on('location', async (ctx) => {
  const chatId = ctx.message.chat.id
  const locationObj = ctx.message.location
  const location = [locationObj.latitude, locationObj.longitude]
  await addUserLocation(chatId, location)
  return ctx.reply(`New location added ${JSON.stringify(location)}!`)
})

bot.command('/limit', async (ctx) => {
  // args[0] is the command, rest are arguments
  const args = ctx.message.text.split(' ')
  const priceLimit = parseInt(args[1].replace('k', '000'))
  const chatId = ctx.message.chat.id
  await updateCurrentUser(chatId, { priceLimit })
  return ctx.reply(`Price limit set to ${priceLimit} EUR.`)
})

bot.command('/radius', async (ctx) => {
  // args[0] is the command, rest are arguments
  const args = ctx.message.text.split(' ')
  const radius = parseInt(args[1])
  const chatId = ctx.message.chat.id
  await updateCurrentUser(chatId, { radius })
  return ctx.reply(`Search radius set to ${radius}km.`)
})

bot.command('/type', async (ctx) => {
  // args[0] is the command, rest are arguments
  const args = ctx.message.text.split(' ')
  const types = args.slice(1)
  const chatId = ctx.message.chat.id
  await updateCurrentUser(chatId, { types })
  return ctx.reply(`Types set to ${types}`)
})

bot.command('/img', async (ctx) => {
  const chatId = ctx.message.chat.id
  const user = await getUser(chatId)
  await updateCurrentUser(chatId, { img: !user.img })
  return ctx.reply(`Receiving images set to ${!user.img}`)
})

// admin commands
bot.command('/stop', async (ctx) => {
  const chatId = ctx.message.chat.id
  const users = await getUsers()
  if (!users[chatId].admin) return ctx.reply(`You are not the admin!`)
  const rez = await updateScrapingInfo({ active: false })
  return ctx.reply(`Master switch turned off! ${rez}`)
})

bot.command('/broadcast', async (ctx) => {
  const chatId = ctx.message.chat.id
  const users = await getUsers()
  if (!users[chatId].admin) return ctx.reply(`You are not the admin!`)
  const args = ctx.message.text.split(' ')
  const msg = args.slice(1).join(' ')
  return Promise.all(Object.keys(users).map(chatId => bot.telegram.sendMessage(chatId, msg)))
})

// ping
bot.hears('hi', (ctx) => ctx.reply('Hello there!'))

// handle all telegram updates with HTTPs trigger
exports.registrationBot = functions.runWith({ memory: '256MB', maxInstances: 1 }).region('europe-west1').https.onRequest((request, response) => {
  return bot.handleUpdate(request.body, response)
})

// ~~~~~~~~~~~~~~~~~~~~~~~~ NOTIFICATIONS ~~~~~~~~~~~~~~~~~~~~~~~~

exports.notifications = functions.runWith({ memory: '256MB', maxInstances: 1 }).region('europe-west1').firestore.document('properties/{docId}').onWrite(change => {
  if (!change.after.exists) { // if property is deleted
    functions.logger.info(`Skipping property ${change.before.data().id}. Reason: deleted!`)
    return Promise.resolve()
  }
  if (change.before.exists && change.before.data().price === change.after.data().price) { // if property is updated but price stays the same
    functions.logger.info(`Skipping property ${change.before.data().id}. Reason: price the same!`)
    return Promise.resolve()
  }
  return handleProperty(change.after.data()) // if property is new or price changed
})

async function handleProperty(property) {
  const users = await getUsers()
  const promises = []

  for (const chatId in users) {
    const { locations, radius, active, priceLimit, types, img } = users[chatId]
    if (!active) {
      functions.logger.log(`Skipping user: ${chatId} - not active`)
      continue
    }
    const locationCoords = Object.values(locations)
    functions.logger.info(`Checking user {chatId: ${chatId}, priceLimit: ${priceLimit}, radius: ${radius}, locations: ${JSON.stringify(locationCoords)}} -
      property: {id: ${property.id} price: ${property.price}, location: ${JSON.stringify(property.geoLocation)}}`)
    if (property.price < priceLimit && (!types || types.includes(property.type)) && locationCoords.some(loc => geofire.distanceBetween(loc, property.geoLocation) <= radius)) {
      functions.logger.info(`Found property: ${property.id}, validFrom: ${JSON.stringify(property.validFrom)} at ${admin.firestore.Timestamp.now().toDate()} for user ${chatId}: ${property.url}`)

      const msg = `${property.title}\nBroj pregleda: ${property.totalViews}\nCena: ${property.price} ${property.priceUnit}\n${property.sqm ? `Kvadratura: ${property.sqm} ${property.sqmUnit}\n` : ''}${property.pricePerSqm ? `Cena po kvadratu: ${property.pricePerSqm} ${property.priceUnit}/${property.sqmUnit}\n` : ''}${property.plot ? `Površina placa: ${property.plot} ${property.plotUnit}\n` : ''}${property.pricePerPlotSqm ? `Cena po aru: ${property.pricePerPlotSqm} ${property.priceUnit}/${property.plotUnit}\n` : ''}${property.city} - ${property.location} - ${property.microlocation}\n${property.url}`
      promises.push(bot.telegram.sendMessage(chatId, msg))
      const media = property.imageURLs?.slice(0, 10)?.map(url => ({ type: 'photo', media: url }))
      if (media?.length && img) promises.push(bot.telegram.sendMediaGroup(chatId, media))
    }
  }

  return Promise.all(promises)
}

// ~~~~~~~~~~~~~~~~~~~~~~~~ SCRAPING ~~~~~~~~~~~~~~~~~~~~~~~~

exports.scheduledScrapeJob = functions.runWith({ memory: '1GB', maxInstances: 1 }).region('europe-west1').pubsub.schedule('*/10 * * * *').onRun(async () => {
  return handleScheduledScrapeJob()
})

// exports.fakeScheduledScrapeJob = functions.runWith({ memory: '1GB', maxInstances: 1 }).region('europe-west1').https.onRequest(async (req, res) => {
//   try {
//     const d = admin.firestore.Timestamp.fromDate(new Date("2021-04-01T12:00:45.36"))
//     await updateScrapingInfo({ active: true, validFrom: { 'apartment-sale': d, 'house-sale': d, 'land-sale': d }, lastScrape: d, nextScrape: 0 })
//     await updateCurrentUser(838164104, {
//       active: true,
//       locations: {
//         srytek82hu: [44.585291, 20.534001],
//         srytek82hi: [44.7822, 20.4495],
//       },
//       priceLimit: 5000000,
//       radius: 300,
//       types: ['house-sale', 'land-sale'],
//       // types: ['apartment-sale']
//       // types: ['land-sale']
//       img: true,
//     })

//     await handleScheduledScrapeJob()
//     return res.sendStatus(200)
//   } catch (err) {
//     functions.logger.error(err)
//     return res.sendStatus(500)
//   }
// })

async function handleScheduledScrapeJob() {
  try {
    // get date of last scrape
    const info = await getScrapingInfo()

    // cancle scraping if paused
    if (!info.active) {
      functions.logger.info('Scraping paused - master switch')
      return Promise.resolve()
    }

    // cancle scraping if all users paused
    const users = Object.values(await getUsers())
    if (!users.some(user => user.active)) {
      functions.logger.info('Scraping paused - no active users')
      return Promise.resolve()
    }

    const type = typesToScrape[info.nextScrape]
    const lastScrapeDateForType = info.validFrom[type].toDate()
    const lastScrapeDate = info.lastScrape.toDate()
    // scrapeJob will write valid results to firestore, which will trigger notifications job
    return scrapeJob(lastScrapeDate, lastScrapeDateForType, type, info.nextScrape)
  } catch (err) {
    functions.logger.error(err)
    return Promise.reject()
  }
}

async function scrapeJob(lastScrapeDate, lastScrapeDateForType, type, nextScrape) {
  const timestamp = admin.firestore.Timestamp.now()
  // scrape properties and filter for properties uploaded between last scrape and now
  functions.logger.info(`Starting scraping job for Halooglasi for type: ${type}. Looking for properties valid from: ${lastScrapeDateForType}. Starting scraping job for CityExpert. Looking for properties valid from: ${lastScrapeDate}.`)
  const [propertiesHO, propertiesCE] = await Promise.all([scrapeHalooglasi(type), scrapeCityExpert()])

  const validPropertiesHO = propertiesHO.filter(property => property.validFrom > lastScrapeDateForType)
  const validPropertiesCE = propertiesCE.filter(property => property.validFrom > lastScrapeDate)

  const validProperties = [...validPropertiesCE, ...validPropertiesHO]

  // write all properties into firestore and trigger all subscribers
  const propertyRefs = await Promise.all(validProperties.map(property => firestore.collection('properties').doc(property.id).set(property)))

  const promoted = propertiesHO.filter(p => p.adKindCode === 'Premium').length
  const top = propertiesHO.filter(p => p.adKindCode === 'Top').length
  const standard = propertiesHO.filter(p => p.adKindCode === 'Standard').length
  functions.logger.info(`Saved ${propertyRefs.length} new out of ${validProperties.length}/${propertiesHO.length + propertiesCE.length} (valid/total) properties!`)
  functions.logger.info(`CityExpres: ${validPropertiesCE.length}/${propertiesCE.length} (valid/total)`)
  functions.logger.info(`Halooglasi: ${standard}/${top}/${promoted} (standard/top/promoted) out of ${validPropertiesHO.length}/${propertiesHO.length} (valid/total)`)

  // if nothing failed, update validFrom so next scrape will ignore already scraped properties
  return updateScrapingInfo({ validFrom: { [type]: timestamp }, lastScrape: timestamp, nextScrape: (nextScrape + 1) % typesToScrape.length })
}

// ~~~~~~~~~~~~~~~~~~~~~~~~ BILLING ~~~~~~~~~~~~~~~~~~~~~~~~

exports.stopBilling = functions.runWith({ memory: '256MB', maxInstances: 1 }).region('europe-west1').pubsub.topic('billing').onPublish(async (message) => {
  try {
    const billingData = message.json
    functions.logger.info(`Received billing data: ${JSON.stringify(billingData)}`)
    return handleBillingPubSub(billingData).then(rez => {
      functions.logger.info(rez)
    })
  } catch (error) {
    return Promise.reject(`receiveBillingNotice function failed: ${error}`)
  }
})

async function handleBillingPubSub(pubsubData) {
  if (!pubsubData) return Promise.reject('PubSub data undefined!')

  if (pubsubData.costAmount <= pubsubData.budgetAmount) {
    return Promise.resolve(`No action necessary. (Current cost: ${pubsubData.costAmount})`)
  }

  if (!PROJECT_ID) return Promise.reject('No project specified')

  _setAuthCredential()
  const billingEnabled = await _isBillingEnabled(PROJECT_NAME)
  if (billingEnabled) {
    return _disableBillingForProject(PROJECT_NAME)
  } else {
    return Promise.resolve('Billing already disabled')
  }
}

/**
 * @return {Promise} Credentials set globally
 */
const _setAuthCredential = () => {
  const client = new GoogleAuth({
    scopes: [
      'https://www.googleapis.com/auth/cloud-billing',
      'https://www.googleapis.com/auth/cloud-platform',
    ],
  })

  // Set credentials
  google_compute.auth = client
  google_billing._options = {
    // Required monkeypatch
    auth: client,
  }
}

/**
 * Determine whether billing is enabled for a project
 * @param {string} projectName Name of project to check if billing is enabled
 * @return {bool} Whether project has billing enabled or not
 */
const _isBillingEnabled = async projectName => {
  try {
    const res = await billing.projects.getBillingInfo({ name: projectName })
    return res.data.billingEnabled
  } catch (e) {
    functions.logger.error('Unable to determine if billing is enabled on specified project, assuming billing is enabled')
    return true
  }
}

/**
 * Disable billing for a project by removing its billing account
 * @param {string} projectName Name of project disable billing on
 * @return {string} Text containing response from disabling billing
 */
const _disableBillingForProject = async projectName => {
  const res = await billing.projects.updateBillingInfo({
    name: projectName,
    requestBody: { billingAccountName: '' }, // Disable billing
  })
  return Promise.resolve(`Billing disabled: ${JSON.stringify(res.data)}`)
}

// ~~~~~~~~~~~~~~~~~~~~~~~~ FIRESTORE ~~~~~~~~~~~~~~~~~~~~~~~~

// users
async function updateCurrentUser(chatId, user) {
  return await firestore.doc(usersDocPath).set({ [chatId]: user }, { merge: true })
}

async function getUsers() {
  return (await firestore.doc(usersDocPath).get()).data()
}

async function getUser(chatId) {
  return (await getUsers())[chatId]
}

async function addUserLocation(chatId, location) {
  functions.logger.info(`Adding new location: ${location} for user ${chatId}`)
  await firestore.doc(usersDocPath).set({
    [chatId]: { locations: { [geofire.geohashForLocation(location)]: location } }
  }, { merge: true })
}

async function resetUser(chatId) {
  return await firestore.doc(usersDocPath).update({ [chatId]: { active: false } })
}

async function getScrapingInfo() {
  return (await firestore.doc(infoDocPath).get()).data()
}

async function updateScrapingInfo(info) {
  return await firestore.doc(infoDocPath).set(info, { merge: true })
}
