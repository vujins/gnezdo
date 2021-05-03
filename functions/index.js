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

// ~~~~~~~~~~~~~~~~~~~~~~~~ TELEGRAM ~~~~~~~~~~~~~~~~~~~~~~~~

const bot = new Telegraf(functions.config().telegram.token, {
  telegram: { webhookReply: true },
})

// error handling
bot.catch((err, ctx) => {
  functions.logger.error('[Bot] Error', err)
  return ctx.reply(`Ooops, encountered an error for ${ctx.updateType}`, err)
})

// initialize the commands
bot.command('/start', async (ctx) => {
  const chatId = ctx.message.chat.id
  functions.logger.info(`User ${chatId} is registered!`)
  await updateCurrentUser({ [chatId]: { active: true, radius: 5 } }) // TODO remove radius
  return ctx.reply(`Welcome user: ${chatId}!`)
})

bot.command('/pause', async (ctx) => {
  const chatId = ctx.message.chat.id
  functions.logger.info(`User ${chatId} is paused!`)
  await updateCurrentUser({ [chatId]: { active: false } })
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

// copy every message and send to the user
// bot.on('message', (ctx) => ctx.telegram.sendCopy(ctx.chat.id, ctx.message))
bot.hears('hi', (ctx) => ctx.reply('Hello there!'))

// handle all telegram updates with HTTPs trigger
exports.registrationBot = functions.region('europe-west1').https.onRequest((request, response) => {
  functions.logger.info(`Incoming message: ${JSON.stringify(request.body)}`)
  return bot.handleUpdate(request.body, response)
})

// ~~~~~~~~~~~~~~~~~~~~~~~~ NOTIFICATIONS ~~~~~~~~~~~~~~~~~~~~~~~~

exports.notifications = functions.region('europe-west1').firestore.document('properties/{docId}').onCreate(async docSnap => {
  return await handleProperty(docSnap.data())
})

exports.testNotifications = functions.region('europe-west1').https.onRequest(async (req, res) => {
  await handleProperty({ geoLocation: [40.774015, 20.409911], url: 'asdas' })
  return res.sendStatus(200)
})

async function handleProperty(property) {
  const usersRef = await firestore.doc('/scraping/users').get()
  const users = usersRef.data()

  for (const chatId in users) {
    console.log(chatId)
    const { locations, radius, active } = users[chatId]
    if (!active) continue;
    const locationCoords = Object.values(locations)
    if (locationCoords.some(loc => geofire.distanceBetween(loc, property.geoLocation) < radius)) {
      console.log(`Found property for user ${chatId}: ${property.url}`)
      bot.telegram.sendMessage(chatId, property.url)
    }
  }

  console.log(users)
  console.log(property)
}

// ~~~~~~~~~~~~~~~~~~~~~~~~ SCRAPING ~~~~~~~~~~~~~~~~~~~~~~~~

exports.fakeScraping = functions.region('europe-west1').https.onRequest(async (req, res) => {
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
    await scrapeJob(lastScrapeDate)
    res.send('scraping finished')
  } catch (err) {
    functions.logger.error(err)
    res.send(err.message)
  }
})

exports.scheduledScrapeJob = functions.region('europe-west1').pubsub.schedule('0 * * * *').onRun(async () => {
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
    await scrapeJob(lastScrapeDate)
    return true
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
const usersDocPath = '/scraping/users'
async function updateCurrentUser(user) {
  return await firestore.doc(usersDocPath).set(user, { merge: true })
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
  return await firestore.doc(usersDocPath).update({ [chatId]: { active: false } }, { merge: true })
}
