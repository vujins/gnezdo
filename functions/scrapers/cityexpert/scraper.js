const axios = require('axios').default
const languages = require('./languages.json').sr
const geofire = require('geofire-common')
const types = require('../../utils/types')

const searchAPI = 'https://cityexpert.rs/api/Search/'
// const mapAPI = 'https://cityexpert.rs/api/Search/Map'
const bodyBGSale = { "ptId": [], "cityId": 1, "rentOrSale": "s", "currentPage": 1, "resultsPerPage": 60, "floor": [], "avFrom": false, "underConstruction": false, "furnished": [], "furnishingArray": [], "heatingArray": [], "parkingArray": [], "petsArray": [], "minPrice": null, "maxPrice": null, "minSize": null, "maxSize": null, "polygonsArray": [], "searchSource": "regular", "sort": "datedsc", "structure": [], "propIds": [], "filed": [], "ceiling": [], "bldgOptsArray": [], "joineryArray": [], "yearOfConstruction": [], "otherArray": [], "numBeds": null, "category": null, "maxTenants": null, "extraCost": null, "numFloors": null, "numBedrooms": null, "numToilets": null, "numBathrooms": null, "heating": null, "bldgEquipment": [], "cleaning": null, "extraSpace": [], "parking": null, "parkingIncluded": null, "parkingExtraCost": null, "parkingZone": null, "petsAllowed": null, "smokingAllowed": null, "aptEquipment": [], "site": "SR" }
const bodyBGRent = { "ptId": [], "cityId": 1, "rentOrSale": "r", "currentPage": 1, "resultsPerPage": 60, "floor": [], "avFrom": false, "underConstruction": false, "furnished": [], "furnishingArray": [], "heatingArray": [], "parkingArray": [], "petsArray": [], "minPrice": null, "maxPrice": null, "minSize": null, "maxSize": null, "polygonsArray": [], "searchSource": "regular", "sort": "datedsc", "structure": [], "propIds": [], "filed": [], "ceiling": [], "bldgOptsArray": [], "joineryArray": [], "yearOfConstruction": [], "otherArray": [], "numBeds": null, "category": null, "maxTenants": null, "extraCost": null, "numFloors": null, "numBedrooms": null, "numToilets": null, "numBathrooms": null, "heating": null, "bldgEquipment": [], "cleaning": null, "extraSpace": [], "parking": null, "parkingIncluded": null, "parkingExtraCost": null, "parkingZone": null, "petsAllowed": null, "smokingAllowed": null, "aptEquipment": [], "site": "SR" }
const bodyNSSale = { "ptId": [], "cityId": 2, "rentOrSale": "s", "currentPage": 1, "resultsPerPage": 60, "floor": [], "avFrom": false, "underConstruction": false, "furnished": [], "furnishingArray": [], "heatingArray": [], "parkingArray": [], "petsArray": [], "minPrice": null, "maxPrice": null, "minSize": null, "maxSize": null, "polygonsArray": [], "searchSource": "regular", "sort": "datedsc", "structure": [], "propIds": [], "filed": [], "ceiling": [], "bldgOptsArray": [], "joineryArray": [], "yearOfConstruction": [], "otherArray": [], "numBeds": null, "category": null, "maxTenants": null, "extraCost": null, "numFloors": null, "numBedrooms": null, "numToilets": null, "numBathrooms": null, "heating": null, "bldgEquipment": [], "cleaning": null, "extraSpace": [], "parking": null, "parkingIncluded": null, "parkingExtraCost": null, "parkingZone": null, "petsAllowed": null, "smokingAllowed": null, "aptEquipment": [], "site": "SR" }
const bodyNSRent = { "ptId": [], "cityId": 2, "rentOrSale": "r", "currentPage": 1, "resultsPerPage": 60, "floor": [], "avFrom": false, "underConstruction": false, "furnished": [], "furnishingArray": [], "heatingArray": [], "parkingArray": [], "petsArray": [], "minPrice": null, "maxPrice": null, "minSize": null, "maxSize": null, "polygonsArray": [], "searchSource": "regular", "sort": "datedsc", "structure": [], "propIds": [], "filed": [], "ceiling": [], "bldgOptsArray": [], "joineryArray": [], "yearOfConstruction": [], "otherArray": [], "numBeds": null, "category": null, "maxTenants": null, "extraCost": null, "numFloors": null, "numBedrooms": null, "numToilets": null, "numBathrooms": null, "heating": null, "bldgEquipment": [], "cleaning": null, "extraSpace": [], "parking": null, "parkingIncluded": null, "parkingExtraCost": null, "parkingZone": null, "petsAllowed": null, "smokingAllowed": null, "aptEquipment": [], "site": "SR" }

const translateRegex = /[šđčćž]/g
const translate = {
  'š': 's',
  'đ': 'dj',
  'č': 'c',
  'ć': 'c',
  'ž': 'z',
}

const propertyTypeConversion = {
  1: 'apartment', //"stan",
  2: 'house', //"kuca",
  3: 'other', //"poslovni-prostor",
  4: 'other', //"lokal",
  5: 'other', //"stan-u-kuci",
  6: 'other', //"soba",
  7: 'other', //"apartman",
  8: 'other', //"splav",
}

const cities = {
  1: 'Beograd',
  2: 'Novi Sad',
}

async function scrape() {
  const properties = await getProperties()

  return properties.map(property => {
    const [lat, lng] = property.location.split(',')
    const geoLocation = [parseFloat(lat), parseFloat(lng)]
    const geohash = geofire.geohashForLocation(geoLocation)
    return {
      url: `https://cityexpert.rs/${property.rentOrSale === 's' ? 'prodaja' : 'izdavanje'}/${languages[`PROPTYPEURL-${property.ptId}`]}/${property.propId}/${languages[`STRURL-${property.structure}`]}-${formatString(property.municipality)}-${formatString(property.street)}`,
      title: `${property.street}, ${property.municipality}`,
      geoLocation,
      geohash,
      type: types[`${propertyTypeConversion[property.ptId]}${property.rentOrSale === 's' ? 'Sale' : 'Rent'}`],
      id: property.propId.toString(),
      validFrom: new Date(property.firstPublished),
      price: property.price,
      priceUnit: 'EUR',
      pricePerSqm: Math.round(property.pricePerSize),
      city: cities[property.cityId],
      location: property.municipality,
      microlocation: property.street,
      totalViews: 'no info :(',
      sqm: property.size,
      sqmUnit: 'm2',
      rooms: property.structure,
    }
  })
}

async function getProperties() {
  const promises = [
    // Beograd
    axios.post(searchAPI, bodyBGSale),
    axios.post(searchAPI, bodyBGRent),
    //Novi Sad
    axios.post(searchAPI, bodyNSSale),
    axios.post(searchAPI, bodyNSRent),
  ]

  const propertyResults = await Promise.all(promises)

  return propertyResults.map(result => result.data.result).flat()
}

function formatString(str) {
  return str.toLowerCase().replace('.', '').replace(' ', '-').replace(translateRegex, (match) => translate[match])
}

module.exports.scrape = scrape
module.exports.getProperties = getProperties
module.exports.formatString = formatString
