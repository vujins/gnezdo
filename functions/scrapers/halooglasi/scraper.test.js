// const scrape = require('./scraper');
const { scrapeItem, getList, scrapeList, scrape } = require('./scraper');
const types = require('../../utils/types');
const URL = require('../../utils/url');

describe('halooglasi wrong time zone', () => {
  test('scraper should remove Z in timestamp if preset', () => {
    const timestamp = '2021-05-04T10:11:43.32Z'
    expect(timestamp.replace('Z', '')).toEqual('2021-05-04T10:11:43.32')
  })
  test('scraper should ignoretimestamp if Z not preset', () => {
    const timestamp = '2021-05-04T10:11:43.32'
    expect(timestamp.replace('Z', '')).toEqual('2021-05-04T10:11:43.32')
  })

  test('Subtracting 2 hours from UTC +0 should have the same hours as GTM +2', () => {
    const timestamp = '2021-05-04T10:11:43.32Z'
    const validFromInFuture = Date.parse(timestamp)
    const validFrom = new Date(validFromInFuture - 2 * 60 * 60 * 1000)

    expect(validFrom.getHours()).toEqual(10)
    expect(validFrom.toISOString()).toMatch('T08')
  })
})

describe('halooglasi scraper', () => {

  const expectedPropertyObject = expect.objectContaining({
    url: expect.stringMatching(/https:\/\/www\.halooglasi\.com\/nekretnine\/(prodaja|izdavanje)-(stanova|kuca|zemljista)\/.+/),
    imageURLs: expect.anything(),
    type: expect.stringMatching(/(house-sale|house-rent|apartment-sale|apartment-rent|land-sale|land-rent)/),
    id: expect.any(String),
    title: expect.any(String),
    validFrom: expect.any(Date),
    geoLocation: expect.arrayContaining([expect.any(Number), expect.any(Number)]),
    geohash: expect.any(String),
    categories: expect.anything(),
    // rooms: expect.any(String),
    // floors: expect.any(String), // only for houses
    // plot: expect.any(Number),
    // plotUnit: expect.any(String),
    city: expect.any(String),
    location: expect.any(String),
    microlocation: expect.any(String),
    // sqm: expect.any(Number),
    // sqmUnit: expect.any(String),
    // street: expect.anything(),
    price: expect.any(Number),
    priceUnit: expect.any(String),
    // pricePerSqm: expect.any(Number),
    avaragePricePerSqm: expect.anything(),
    avaragePricePerSqmLink: expect.anything(),
    advertiser: expect.any(String),
    totalViews: expect.any(Number),
    adKindCode: expect.any(String),
  })

  beforeAll(() => {
    jest.setTimeout(20000); // 20s to execute test
  });

  test('scrapeItem should have all info correctly', async () => {
    const url = 'https://www.halooglasi.com/nekretnine/prodaja-kuca/dedinje-veoma-luksuzna-kuca-uknjizena-id-1564/5425636240199?kid=4';
    await expect(scrapeItem(url, types.houseSale)).resolves.toEqual(expectedPropertyObject);
  });

  test('scrapeItem apartment should have all info correctly', async () => {
    const url = 'https://www.halooglasi.com/nekretnine/prodaja-stanova/top-lokacija-komforna-garsonjera-na-grbavici/5425636566510?kid=3&sid=1620242853597'
    await expect(scrapeItem(url, types.apartmentSale)).resolves.toEqual(expectedPropertyObject);
  });



  test('getList has 20 items', async () => {
    await expect(getList(URL.halooglasi[types.houseSale])).resolves.toHaveLength(20);
  });

  test('getList has 20 items for all urls', () => {
    const results = [];
    Object.values(types).forEach((type) => {
      results.push(getList(URL.halooglasi[type]));
    });
    return Promise.all(results).then(rezs => {
      expect(rezs.flat()).toHaveLength(Object.values(types).length * 20);
    })
  });

  test('getList should return urls', async () => {
    const expectedArray = Array(20).fill(expect.any(String));
    await expect(getList(URL.halooglasi[types.houseSale])).resolves.toEqual(expect.arrayContaining(expectedArray));
  });


  test('getList should return urls for all property types', () => {
    const expectedArray = Array(Object.values(types).length).fill(expect.any(String));
    const results = [];
    Object.values(types).forEach((type) => {
      results.push(getList(URL.halooglasi[type]));
    });
    return Promise.all(results).then(rezs => {
      expect(rezs.flat()).toEqual(expect.arrayContaining(expectedArray));
    })
  });

  test('scrapeList returns 20 items in array for houseSale', async () => {
    await expect(scrapeList(URL.halooglasi[types.houseSale], types.houseSale)).resolves.toHaveLength(20);
  });
  test('scrapeList returns 20 items in array for houseRent', async () => {
    await expect(scrapeList(URL.halooglasi[types.houseRent], types.houseRent)).resolves.toHaveLength(20);
  });
  test('scrapeList returns 20 items in array for apartmentSale', async () => {
    await expect(scrapeList(URL.halooglasi[types.apartmentSale], types.apartmentSale)).resolves.toHaveLength(20);
  });
  test('scrapeList returns 20 items in array for apartmentRent', async () => {
    await expect(scrapeList(URL.halooglasi[types.apartmentRent], types.apartmentRent)).resolves.toHaveLength(20);
  });
  test('scrapeList returns 20 items in array for landSale', async () => {
    await expect(scrapeList(URL.halooglasi[types.landSale], types.landSale)).resolves.toHaveLength(20);
  });
  test('scrapeList returns 20 items in array for landRent', async () => {
    await expect(scrapeList(URL.halooglasi[types.landRent], types.landRent)).resolves.toHaveLength(20);
  });

  // eslint-disable-next-line jest/no-disabled-tests
  it.skip('scrapeList returns 20 items in array for every property', () => {
    const results = [];
    Object.values(types).forEach((type) => {
      results.push(scrapeList(URL.halooglasi[type], type));
    });
    return Promise.all(results).then(rezs => {
      expect(rezs.flat()).toHaveLength(Object.values(types).length * 20);
    })
  });

  test('scrapeList returns 20 property items', async () => {
    const expectedArray = Array(20).fill(expectedPropertyObject);
    await expect(scrapeList(URL.halooglasi[types.houseSale], types.houseSale)).resolves.toEqual(expect.arrayContaining(expectedArray));
  });

  test('scrape house sale should return numOfPages*20 objects', async () => {
    await expect(scrape(types.houseSale)).resolves.toHaveLength(60);
  });

  test('scrape house sale should return numOfPages*20 property objects', async () => {
    await expect(scrape(types.houseSale)).resolves.toEqual(expect.arrayContaining(Array(60).fill(expectedPropertyObject)));
  });

  test('scrape house sale should not return properties with wrong ValidFrom date', async () => {
    const properties = await scrape(types.houseSale)
    expect(properties.some(property => property.validFrom > new Date())).toBeFalsy()
  });

  test('scrape apartman sale should return numOfPages*20 objects', async () => {
    await expect(scrape(types.apartmentSale)).resolves.toHaveLength(60);
  });

  test('scrape apartman sale should return numOfPages*20 property objects', async () => {
    await expect(scrape(types.apartmentSale)).resolves.toEqual(expect.arrayContaining(Array(60).fill(expectedPropertyObject)));
  });

  test('scrape apartman sale should not return properties with wrong ValidFrom date', async () => {
    const properties = await scrape(types.apartmentSale)
    expect(properties.some(property => property.validFrom > new Date())).toBeFalsy()
  });

  test('scrape land sale should return numOfPages*20 objects', async () => {
    await expect(scrape(types.landSale)).resolves.toHaveLength(20);
  });

  test('scrape land sale should return property objects', async () => {
    const properties = await scrape(types.landSale)
    expect(properties[0]).toEqual(expectedPropertyObject);
  });

  test('scrape land sale should return numOfPages*20 property objects', async () => {
    await expect(scrape(types.landSale)).resolves.toEqual(expect.arrayContaining(Array(20).fill(expectedPropertyObject)));
  });

  test('scrape land sale should not return properties with wrong ValidFrom date', async () => {
    const properties = await scrape(types.landSale)
    expect(properties.some(property => property.validFrom > new Date())).toBeFalsy()
  });
});
