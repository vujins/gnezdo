const functions = require("firebase-functions")
const { Telegraf } = require('telegraf')
const admin = require('firebase-admin')
const google_billing = require('googleapis/build/src/apis/cloudbilling')
const google_compute = require('googleapis/build/src/apis/compute')
const { GoogleAuth } = require('google-auth-library')

const firestore = admin.initializeApp().firestore()
const billing = google_billing.cloudbilling('v1')
const PROJECT_ID = process.env.GCLOUD_PROJECT
const PROJECT_NAME = `projects/${PROJECT_ID}`

const bot = new Telegraf(functions.config().telegram.token, {
  telegram: { webhookReply: true },
})

// error handling
bot.catch((err, ctx) => {
  functions.logger.error('[Bot] Error', err)
  return ctx.reply(`Ooops, encountered an error for ${ctx.updateType}`, err)
})

// initialize the commands
bot.command('/start', (ctx) => ctx.reply('Welcome!'))
// copy every message and send to the user
// bot.on('message', (ctx) => ctx.telegram.sendCopy(ctx.chat.id, ctx.message))
bot.hears('hi', (ctx) => ctx.reply('Hello there!'))

// handle all telegram updates with HTTPs trigger
exports.registrationBot = functions.https.onRequest(async (request, response) => {
  functions.logger.log('Incoming message', request.body)
  return await bot.handleUpdate(request.body, response).then((rv) => {
    // if it's not a request from the telegram, rv will be undefined, but we should respond with 200
    return !rv && response.sendStatus(200)
  })
})

// ~~~~~~~~~~~~~~~~~~~~~~~~ BILLING ~~~~~~~~~~~~~~~~~~~~~~~~

exports.stopBilling = functions.pubsub.topic('billing').onPublish(async (message) => {
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
