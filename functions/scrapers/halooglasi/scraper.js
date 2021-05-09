const axios = require('axios').default
const cheerio = require('cheerio')
const { JSDOM, VirtualConsole } = require('jsdom')
const URL = require('../../utils/url')
const types = require('../../utils/types')
const geofire = require('geofire-common')

async function scrape(type) {
  let promises;

  switch (type) {
    case types.houseSale: {
      promises = [
        scrapeList(`${URL.halooglasi[types.houseSale]}/beograd?cena_d_to=${500000}&cena_d_unit=4&page=${1}`, types.houseSale),
        scrapeList(`${URL.halooglasi[types.houseSale]}/beograd?cena_d_to=${500000}&cena_d_unit=4&page=${2}`, types.houseSale),
        scrapeList(`${URL.halooglasi[types.houseSale]}/beograd?cena_d_to=${500000}&cena_d_unit=4&page=${3}`, types.houseSale),
      ]
      break
    }
    case types.apartmentSale: {
      promises = [
        scrapeList(`${URL.halooglasi[types.apartmentSale]}/novi-sad?cena_d_to=${100000}&cena_d_unit=4&page=${1}`, types.apartmentSale),
        scrapeList(`${URL.halooglasi[types.apartmentSale]}/novi-sad?cena_d_to=${100000}&cena_d_unit=4&page=${2}`, types.apartmentSale),
        scrapeList(`${URL.halooglasi[types.apartmentSale]}/novi-sad?cena_d_to=${100000}&cena_d_unit=4&page=${3}`, types.apartmentSale),
      ]
      break
    }
    case types.landSale: {
      promises = [
        scrapeList(`${URL.halooglasi[types.landSale]}/beograd?cena_d_to=${100000}&cena_d_unit=4&page=${1}`, types.landSale)
      ]
      break
    }
    default:
      throw new Error('Unkown scrape type!')
  }


  return (await Promise.all(promises)).flat()
}

async function scrapeList(url, type) {
  const list = await getList(url)
  const settledPromises = await Promise.allSettled(list.map(propertyUrl => scrapeItem(`${URL.halooglasi.baseUrl}${propertyUrl}`, type)))
  return settledPromises.filter(p => p.status === 'fulfilled').map(p => p.value)
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
  const { Id, Title, ValidFrom, GeoLocationRPT, CategoryNames, TotalViews, AveragePriceBySurfaceValue, AveragePriceBySurfaceLink, cena_d_unit_s, kvadratura_d_unit_s, broj_soba_s, spratnost_s, povrsina_placa_d, grad_s, lokacija_s, mikrolokacija_s, kvadratura_d, oglasivac_nekretnine_s, ulica_t, cena_d, povrsina_placa_d_unit_s, ImageURLs, povrsina_d, povrsina_d_unit_s }
    = window.QuidditaEnvironment?.CurrentClassified
  const { AdKindCode } = window.QuidditaEnvironment?.CurrentClassifiedInstances[0]
  const [lat, lng] = GeoLocationRPT.split(',')
  const geoLocation = [parseFloat(lat), parseFloat(lng)]
  const geohash = geofire.geohashForLocation(geoLocation)

  // Halooglasi returns dates in format '2021-05-04T10:11:43.32Z', Z at the end is refering to UTC time zone
  // but the actual date from Halooglasi is refering to GMT +2.
  // Removing the Z at the end will not work because our server is in GTM +0, the solution is to sub 2 hours.
  const validFrom = new Date(Date.parse(ValidFrom) - 2 * 60 * 60 * 1000)

  return {
    url,
    imageURLs: ImageURLs,
    type,
    id: Id,
    title: Title,
    validFrom,
    geoLocation,
    geohash,
    categories: CategoryNames,
    rooms: broj_soba_s,
    floors: spratnost_s,
    plot: povrsina_placa_d ?? povrsina_d,
    plotUnit: povrsina_placa_d_unit_s ?? povrsina_d_unit_s,
    city: grad_s,
    location: lokacija_s,
    microlocation: mikrolokacija_s,
    street: ulica_t,
    sqm: kvadratura_d,
    sqmUnit: kvadratura_d_unit_s,
    price: cena_d,
    priceUnit: cena_d_unit_s,
    pricePerSqm: Math.floor(cena_d / kvadratura_d ?? povrsina_placa_d ?? povrsina_d),
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
