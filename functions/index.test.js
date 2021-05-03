const geofire = require('geofire-common')

const targetLoc = [44.45204, 20.696933] // Mladenovac - target
const loc2 = [44.427525, 20.690323] // almost Mladenovac, close to loc1
const loc3 = [44.822132, 20.389074] // NBG - not close to loc1 and loc2

const radius = 20

const user = {
  locations: {
    loc2, loc3
  }
}

describe('geolocation', () => {
  test('loc2 should be within radius of targetLoc', () => {
    expect(geofire.distanceBetween(targetLoc, loc2) < radius).toBeTruthy()
  })
  test('loc3 should not be within radius of targetLoc', () => {
    expect(geofire.distanceBetween(targetLoc, loc3) < radius).toBeFalsy()
  })
  test('user should be interested in target loc', () => {
    const locations = Object.values(user.locations)
    expect(locations.some(loc => geofire.distanceBetween(loc, targetLoc) < radius)).toBeTruthy()
  })
})
