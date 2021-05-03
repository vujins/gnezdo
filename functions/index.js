const functions = require("firebase-functions")
const { Telegraf } = require('telegraf')
const admin = require('firebase-admin')
const google_billing = require('googleapis/build/src/apis/cloudbilling')
const google_compute = require('googleapis/build/src/apis/compute')
const { GoogleAuth } = require('google-auth-library')
const { scrape } = require('./scrapers/halooglasi/scraper')
const geofire = require('geofire-common')

const firestore = admin.initializeApp().firestore()
firestore.settings({ ignoreUndefinedProperties: true })
const billing = google_billing.cloudbilling('v1')
const PROJECT_ID = process.env.GCLOUD_PROJECT
const PROJECT_NAME = `projects/${PROJECT_ID}`

// firestore paths
const usersDocPath = '/scraping/users'

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
  functions.logger.info(`User ${chatId} is registered!`)
  await updateCurrentUser(chatId, { active: true })
  return ctx.reply(`Welcome user: ${chatId}!`)
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
  ctx.reply(`New location added ${JSON.stringify(location)}!`)
})

bot.command('/limit', async (ctx) => {
  // args[0] is the command, rest are arguments
  const args = ctx.message.text.split(' ')
  const priceLimit = parseInt(args[1])
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

bot.hears('hi', (ctx) => ctx.reply('Hello there!'))

// handle all telegram updates with HTTPs trigger
exports.registrationBot = functions.region('europe-west1').https.onRequest((request, response) => {
  functions.logger.info(`Incoming message: ${JSON.stringify(request.body)}`)
  return bot.handleUpdate(request.body, response)
})

// ~~~~~~~~~~~~~~~~~~~~~~~~ NOTIFICATIONS ~~~~~~~~~~~~~~~~~~~~~~~~

exports.notifications = functions.runWith({ memory: '512MB' }).region('europe-west1').firestore.document('properties/{docId}').onCreate(docSnap => {
  return handleProperty(docSnap.data())
})

exports.testNotifications = functions.region('europe-west1').https.onRequest(async (req, res) => {
  await handleProperty({ geoLocation: [44.427525, 20.690323], url: 'asdas', price: 150000 })
  return res.sendStatus(200)
})

async function handleProperty(property) {
  const users = await getUsers()

  for (const chatId in users) {
    const { locations, radius, active, priceLimit } = users[chatId]
    if (!active) {
      functions.logger.log(`Skipping user: ${chatId} - not active`)
      continue
    }
    const locationCoords = Object.values(locations)
    functions.logger.info(`Checking user {chatId: ${chatId}, priceLimit: ${priceLimit}, radius: ${radius}, locations: ${JSON.stringify(locationCoords)}} -
      property: {price: ${property.price}, location: ${JSON.stringify(property.geoLocation)}}`)
    if (property.price < priceLimit && locationCoords.some(loc => geofire.distanceBetween(loc, property.geoLocation) <= radius)) {
      console.log(`Found property for user ${chatId}: ${property.url}`)
      bot.telegram.sendMessage(chatId, property.url)
    }
  }
}

// ~~~~~~~~~~~~~~~~~~~~~~~~ SCRAPING ~~~~~~~~~~~~~~~~~~~~~~~~

exports.fakeScraping = functions.region('europe-west1').https.onRequest(async (req, res) => {
  try {
    await firestore.doc('/scraping/info').set({ active: true, validFrom: admin.firestore.Timestamp.fromMillis(Date.UTC(2021, 3, 25)) })
    // get date of last scrape
    const infoDocRef = await firestore.doc('/scraping/info').get()
    const info = infoDocRef.data()
    console.log(info)

    // cancle scraping if paused
    if (!info.active) {
      functions.logger.info('Scraping paused - master switch')
      return res.send('scraping finished - not active')
    }

    // cancle scraping if all users paused
    const users = Object.values(await getUsers());
    console.log(users)
    if (!users.some(user => user.active)) {
      functions.logger.info('Scraping paused - no active users')
      return res.send('scraping finished - no active users')
    }

    const lastScrapeDate = info.validFrom.toDate()
    await scrapeJob(lastScrapeDate)
    res.send('scraping finished')
  } catch (err) {
    functions.logger.error(err)
    res.send(err.message)
  }
})

exports.scheduledScrapeJob = functions.runWith({ memory: '512MB' }).region('europe-west1').pubsub.schedule('0 * * * *').onRun(async () => {
  try {
    // get date of last scrape
    const infoDocRef = await firestore.doc('/scraping/info').get()
    const info = infoDocRef.data()

    // cancle scraping if paused
    if (!info.active) {
      functions.logger.info('Scraping paused - master switch')
      return true
    }

    // cancle scraping if all users paused
    const users = Object.values(await getUsers());
    if (!users.some(user => user.active)) {
      functions.logger.info('Scraping paused - no active users')
      return true
    }

    const lastScrapeDate = info.validFrom.toDate()
    // scrapeJob will write valid results to firestore, which will trigger notifications job
    return scrapeJob(lastScrapeDate)
  } catch (err) {
    functions.logger.error(err)
    return false
  }
});

async function scrapeJob(lastScrapeDate) {
  // scrape properties and filter for properties uploaded between last scrape and now
  const properties = await scrape()
  const validProperties = properties.filter(property => property.validFrom > lastScrapeDate)

  // write all properties into firestore and trigger all subscribers
  const propertyRefs = await Promise.all(validProperties.map(property => firestore.collection('properties').add(property)))

  // if nothing failed, update validFrom so next scrape will ignore already scraped properties
  await firestore.doc('/scraping/info').set({ validFrom: admin.firestore.Timestamp.now() }, { merge: true })

  functions.logger.info(`Saved ${propertyRefs.length} new out of ${validProperties.length}/${properties.length} (valid/total) properties at ${new Date()}`)

  return Promise.resolve()
}

// ~~~~~~~~~~~~~~~~~~~~~~~~ BILLING ~~~~~~~~~~~~~~~~~~~~~~~~

exports.stopBilling = functions.region('europe-west1').pubsub.topic('billing').onPublish(async (message) => {
  try {
    const billingData = message.json
    const rez = await handleBillingPubSub(billingData)
    functions.logger.info(rez)
    return rez
  } catch (error) {
    return `receiveBillingNotice function failed: ${error}`
  }
})

async function handleBillingPubSub(pubsubData) {
  if (!pubsubData) return 'PubSub data undefined!'

  if (pubsubData.costAmount <= pubsubData.budgetAmount) {
    return `No action necessary. (Current cost: ${pubsubData.costAmount})`
  }

  if (!PROJECT_ID) {
    return 'No project specified'
  }

  _setAuthCredential()
  const billingEnabled = await _isBillingEnabled(PROJECT_NAME)
  if (billingEnabled) {
    return _disableBillingForProject(PROJECT_NAME)
  } else {
    return 'Billing already disabled'
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
    console.log(
      'Unable to determine if billing is enabled on specified project, assuming billing is enabled'
    )
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
  return `Billing disabled: ${JSON.stringify(res.data)}`
}

// ~~~~~~~~~~~~~~~~~~~~~~~~ FIRESTORE ~~~~~~~~~~~~~~~~~~~~~~~~

// users
async function updateCurrentUser(chatId, user) {
  return await firestore.doc(usersDocPath).set({ [chatId]: user }, { merge: true })
}

async function getUsers() {
  return (await firestore.doc(usersDocPath).get()).data()
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
