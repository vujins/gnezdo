// const scrape = require('./scraper');
const { scrapeItem, getList, scrapeList, scrape } = require('./scraper');
const types = require('../../utils/types');
const URL = require('../../utils/url');


describe('halooglasi scraper', () => {

  const expectedPropertyObject = expect.objectContaining({
    url: expect.any(String),
    imageURLs: expect.anything(),
    type: expect.any(String),
    id: expect.any(String),
    title: expect.any(String),
    validFrom: expect.any(Date),
    geoLocation: expect.arrayContaining([expect.any(Number), expect.any(Number)]),
    geohash: expect.any(String),
    categories: expect.anything(),
    rooms: expect.any(String),
    floors: expect.any(String),
    // plot: expect.any(Number),
    // plotUnit: expect.any(String),
    city: expect.any(String),
    location: expect.any(String),
    microlocation: expect.any(String),
    sqm: expect.any(Number),
    sqmUnit: expect.any(String),
    street: expect.anything(),
    price: expect.any(Number),
    priceUnit: expect.any(String),
    pricePerSqm: expect.any(Number),
    avaragePricePerSqm: expect.anything(),
    avaragePricePerSqmLink: expect.anything(),
    advertiser: expect.any(String),
    totalViews: expect.any(Number),
    adKindCode: expect.any(String),
  })

  beforeAll(() => {
    jest.setTimeout(20000); // 20s to execute test
  });

  it('scrapeItem should have all info correctly', async () => {
    const url = 'https://www.halooglasi.com/nekretnine/prodaja-kuca/dedinje-veoma-luksuzna-kuca-uknjizena-id-1564/5425636240199?kid=4';
    await expect(scrapeItem(url, types.houseSale)).resolves.toEqual(expectedPropertyObject);
  });

  it('getList has 20 items', async () => {
    await expect(getList(URL.halooglasi[types.houseSale])).resolves.toHaveLength(20);
  });

  it('getList has 20 items for all urls', () => {
    const results = [];
    Object.values(types).forEach((type) => {
      results.push(getList(URL.halooglasi[type]));
    });
    return Promise.all(results).then(rezs => {
      expect(rezs.flat()).toHaveLength(Object.values(types).length * 20);
    })
  });

  it('getList should return urls', async () => {
    const expectedArray = Array(20).fill(expect.any(String));
    await expect(getList(URL.halooglasi[types.houseSale])).resolves.toEqual(expect.arrayContaining(expectedArray));
  });


  it('getList should return urls for all property types', () => {
    const expectedArray = Array(Object.values(types).length).fill(expect.any(String));
    const results = [];
    Object.values(types).forEach((type) => {
      results.push(getList(URL.halooglasi[type]));
    });
    return Promise.all(results).then(rezs => {
      expect(rezs.flat()).toEqual(expect.arrayContaining(expectedArray));
    })
  });

  it('scrapeList returns 20 items in array for houseSale', async () => {
    await expect(scrapeList(URL.halooglasi[types.houseSale], types.houseSale)).resolves.toHaveLength(20);
  });
  it('scrapeList returns 20 items in array for houseRent', async () => {
    await expect(scrapeList(URL.halooglasi[types.houseRent], types.houseRent)).resolves.toHaveLength(20);
  });
  it('scrapeList returns 20 items in array for apartmentSale', async () => {
    await expect(scrapeList(URL.halooglasi[types.apartmentSale], types.apartmentSale)).resolves.toHaveLength(20);
  });
  it('scrapeList returns 20 items in array for apartmentRent', async () => {
    await expect(scrapeList(URL.halooglasi[types.apartmentRent], types.apartmentRent)).resolves.toHaveLength(20);
  });
  it('scrapeList returns 20 items in array for landSale', async () => {
    await expect(scrapeList(URL.halooglasi[types.landSale], types.landSale)).resolves.toHaveLength(20);
  });
  it('scrapeList returns 20 items in array for landRent', async () => {
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

  it('scrapeList returns 20 property items', async () => {
    const expectedArray = Array(20).fill(expectedPropertyObject);
    await expect(scrapeList(URL.halooglasi[types.houseSale], types.houseSale)).resolves.toEqual(expect.arrayContaining(expectedArray));
  });

  it('scrape should return numOfPages*20 objects', async () => {
    await expect(scrape()).resolves.toHaveLength(40);
  });

  it('scrape should return numOfPages*20 property objects', async () => {
    await expect(scrape()).resolves.toEqual(expect.arrayContaining(Array(40).fill(expectedPropertyObject)));
  });
});
