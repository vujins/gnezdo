// const scrape = require('./scraper');
const { scrapeItem, getList, scrapeList } = require('./scraper');
const types = require('../../utils/types');


describe('halooglasi scraper', () => {

  const expectedPropertyObject = expect.objectContaining({
    url: expect.any(String),
    type: expect.any(String),
    id: expect.any(String),
    title: expect.any(String),
    validFrom: expect.any(Date),
    geoLocation: expect.stringMatching(/\d+\.\d+,\d+\.\d+/g),
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
  })

  beforeAll(() => {
    jest.setTimeout(20000); // 20s to execute test
  });

  it('scrapeItem should have all info correctly', async () => {
    const url = 'https://www.halooglasi.com/nekretnine/prodaja-kuca/dedinje-veoma-luksuzna-kuca-uknjizena-id-1564/5425636240199?kid=4';
    await expect(scrapeItem(url, types.houseSale)).resolves.toEqual(expectedPropertyObject);
  });

  it('getList has 20 items', async () => {
    const url = 'https://www.halooglasi.com/nekretnine/prodaja-kuca/';
    await expect(getList(url)).resolves.toHaveLength(20);
  });

  it('getList should return urls', async () => {
    const url = 'https://www.halooglasi.com/nekretnine/prodaja-kuca/';
    const expectedArray = Array(20).fill(expect.any(String));
    await expect(getList(url)).resolves.toEqual(expect.arrayContaining(expectedArray));
  });

  it('scrapeList returns 20 items in array', async () => {
    const url = 'https://www.halooglasi.com/nekretnine/prodaja-kuca/';
    await expect(scrapeList(url, types.houseSale)).resolves.toHaveLength(20);
  });

  it('scrapeList returns 20 property items', async () => {
    const url = 'https://www.halooglasi.com/nekretnine/prodaja-kuca/';
    const expectedArray = Array(20).fill(expectedPropertyObject);
    await expect(scrapeList(url, types.houseSale)).resolves.toEqual(expect.arrayContaining(expectedArray));
  });
});
