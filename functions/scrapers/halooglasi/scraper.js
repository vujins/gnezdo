const axios = require('axios').default
const cheerio = require('cheerio')
const { JSDOM, VirtualConsole } = require('jsdom')
const URL = require('../../utils/url')
const types = require('../../utils/types')
const geofire = require('geofire-common')

async function scrape() {
  const promises = [
    scrapeList(`${URL.halooglasi[types.houseSale]}/beograd?cena_d_to=${200000}&cena_d_unit=4&page=${1}`, types.houseSale),
    scrapeList(`${URL.halooglasi[types.houseSale]}/beograd?cena_d_to=${200000}&cena_d_unit=4&page=${2}`, types.houseSale),
  ]

  return (await Promise.all(promises)).flat()
}

async function scrapeList(url, type) {
  const list = await getList(url)
  const settledPromises = await Promise.allSettled(list.map(propertyUrl => scrapeItem(`${URL.halooglasi.baseUrl}${propertyUrl}`, type)))
  return settledPromises
    .filter(p => p.status === 'fulfilled')
    .map(p => p.value)
}

async function getList(url) {
  const response = await axios.get(url)
  const { data } = response
  if (response.status !== 200) throw new Error(`Status code ${response.status} ${response.statusText} for url: ${url}`)

  const urls = []

  const $ = cheerio.load(data)

  $('h3.product-title > a').each((_i, el) => {
    urls.push($(el).attr('href'))
  })

  return urls
}

async function scrapeItem(url, type) {
  const response = await axios.get(url)
  const { data } = response
  if (response.status !== 200) throw new Error(`Status code ${response.status} ${response.statusText} for url: ${url}`)

  // virtualConsole by default has no handlers, this is to silence all internal script errors
  const virtualConsole = new VirtualConsole()
  const dom = new JSDOM(data, {
    runScripts: 'dangerously',
    // resources: 'usable',
    virtualConsole,
  })
  const { window } = dom
  const { Id, Title, ValidFrom, GeoLocationRPT, CategoryNames, TotalViews, AveragePriceBySurfaceValue, AveragePriceBySurfaceLink, cena_d_unit_s, kvadratura_d_unit_s, broj_soba_s, spratnost_s, povrsina_placa_d, grad_s, lokacija_s, mikrolokacija_s, kvadratura_d, oglasivac_nekretnine_s, ulica_t, cena_d, povrsina_placa_d_unit_s, ImageURLs }
    = window.QuidditaEnvironment?.CurrentClassified
  const { AdKindCode } = window.QuidditaEnvironment?.CurrentClassifiedInstances[0]
  const [lat, lng] = GeoLocationRPT.split(',')
  const geoLocation = [parseFloat(lat), parseFloat(lng)]
  const geohash = geofire.geohashForLocation(geoLocation)

  return {
    url,
    imageURLs: ImageURLs,
    type,
    id: Id,
    title: Title,
    validFrom: new Date(ValidFrom),
    geoLocation,
    geohash,
    categories: CategoryNames,
    rooms: broj_soba_s,
    floors: spratnost_s,
    plot: povrsina_placa_d,
    plotUnit: povrsina_placa_d_unit_s,
    city: grad_s,
    location: lokacija_s,
    microlocation: mikrolokacija_s,
    street: ulica_t,
    sqm: kvadratura_d,
    sqmUnit: kvadratura_d_unit_s,
    price: cena_d,
    priceUnit: cena_d_unit_s,
    pricePerSqm: Math.floor(cena_d / kvadratura_d),
    avaragePricePerSqm: AveragePriceBySurfaceValue,
    avaragePricePerSqmLink: AveragePriceBySurfaceLink,
    advertiser: oglasivac_nekretnine_s,
    totalViews: TotalViews,
    adKindCode: AdKindCode,
  }
}

module.exports.scrapeItem = scrapeItem
module.exports.getList = getList
module.exports.scrapeList = scrapeList
module.exports.scrape = scrape
