const { scrape, getProperties, formatString } = require('./scraper')
const { sr } = require('./languages.json')

describe('lng.json', () => {
  test('serbian languages were correctly imported', () => {
    expect(sr['ABOUT-US']).toEqual('O nama')
    expect(sr[`PROPTYPEURL-1`]).toEqual('stan')
  })
})

describe('cityexpert scraper', () => {
  const urlregex = /https:\/\/cityexpert\.rs\/(prodaja|izdavanje)\/(stan|kuca|poslovni-prostor|lokal|stan-u-kuci|soba|apartman|splav)\/\d+\/.+/
  const expectedPropertyObject = expect.objectContaining({
    url: expect.stringMatching(urlregex),
    // imageURLs: expect.anything(),
    type: expect.stringMatching(/(house-sale|house-rent|apartment-sale|apartment-rent|land-sale|land-rent|other-sale|other-rent)/),
    id: expect.any(Number),
    title: expect.any(String),
    validFrom: expect.any(Date),
    geoLocation: expect.arrayContaining([expect.any(Number), expect.any(Number)]),
    geohash: expect.any(String),
    // categories: expect.anything(),
    rooms: expect.any(String),
    // floors: expect.any(String), // only for houses
    // plot: expect.any(Number),
    // plotUnit: expect.any(String),
    city: expect.any(String),
    location: expect.any(String),
    microlocation: expect.any(String),
    sqm: expect.any(Number),
    sqmUnit: expect.any(String),
    // street: expect.anything(),
    price: expect.any(Number),
    priceUnit: expect.any(String),
    pricePerSqm: expect.any(Number),
    // avaragePricePerSqm: expect.anything(),
    // avaragePricePerSqmLink: expect.anything(),
    // advertiser: expect.any(String),
    // totalViews: expect.any(Number),
    // adKindCode: expect.any(String),
  })

  test('encode location #1', () => {
    const startingLocation = 'Novi Beograd'
    const location = startingLocation.toLowerCase().replace(' ', '-')
    const expectedLocation = 'novi-beograd'
    expect(location).toEqual(expectedLocation)
  })

  test('encode location #2', () => {
    const startingLocation = 'Smolućska'
    const location = startingLocation.toLowerCase().replace(' ', '-').replace('ć', 'c')
    const expectedLocation = 'smolucska'
    expect(location).toEqual(expectedLocation)
  })

  test('encode location #3', () => {
    const startingLocation = 'Smolućska'
    const location = formatString(startingLocation)
    const expectedLocation = 'smolucska'
    expect(location).toEqual(expectedLocation)
  })

  test('encode location #4', () => {
    const translateRegex = /[šđčćž]/g
    const translate = {
      'š': 's',
      'đ': 'dj',
      'č': 'c',
      'ć': 'c',
      'ž': 'z',
    }
    const startingLocation = 'Smolućska'
    const location = startingLocation.toLowerCase().replace(translateRegex, (match) => translate[match])
    const expectedLocation = 'smolucska'
    expect(location).toEqual(expectedLocation)
  })

  test('getProperties returns 120 properties, 60 per city', async () => {
    const properties = await getProperties();

    expect(properties.length).toEqual(120)
  })

  test('scrape returns 120 properties, 60 per city', async () => {
    const properties = await scrape();

    expect(properties.length).toEqual(120)
  })

  test('scrape returns 120 properties of expected type', async () => {
    const properties = await scrape();

    expect(properties).toEqual(Array(120).fill(expectedPropertyObject))
  })

  test('regex matches url', () => {
    const url = 'https://cityexpert.rs/prodaja/stan/35198/dvosoban-vracar-hadzi-melentijeva'

    expect(urlregex.test(url)).toBeTruthy()
  })

  test('scrape returns 120 property urls of expected type', async () => {
    const properties = await scrape();
    const urls = properties.map(p => p.url)
    const faultyUrl = urls.find(url => !urlregex.test(url))

    expect(faultyUrl).toBeUndefined()
  })

  test('scrape returns 1 property of expected type', async () => {
    const properties = await scrape();

    expect(properties[0]).toEqual(expectedPropertyObject)
  })

  test('scrape returns 120 properties of valid dates', async () => {
    const properties = await scrape();

    expect(properties.some(p => p.validFrom > new Date())).toBeFalsy()
  })
})
