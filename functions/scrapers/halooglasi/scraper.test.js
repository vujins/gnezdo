const scraper = require('./scraper');
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
  const urlRegex = /https:\/\/www\.halooglasi\.com\/nekretnine\/(prodaja|izdavanje)-(stanova|kuca|zemljista)\/.+/

  const expectedPropertyObject = expect.objectContaining({
    url: expect.stringMatching(urlRegex),
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
    scraper.filterList = jest.fn().mockImplementation(list => list);
  });

  test('scraper.scrapeItem should have all info correctly', async () => {
    const url = 'https://www.halooglasi.com/nekretnine/prodaja-kuca/dedinje-veoma-luksuzna-kuca-uknjizena-id-1564/5425636240199?kid=4';
    await expect(scraper.scrapeItem(url, types.houseSale)).resolves.toEqual(expectedPropertyObject);
  });

  test('scraper.scrapeItem apartment should have all info correctly', async () => {
    const url = 'https://www.halooglasi.com/nekretnine/prodaja-stanova/top-lokacija-komforna-garsonjera-na-grbavici/5425636566510?kid=3&sid=1620242853597'
    await expect(scraper.scrapeItem(url, types.apartmentSale)).resolves.toEqual(expectedPropertyObject);
  });

  test('scraper.getList has 20 items', async () => {
    await expect(scraper.getList(URL.halooglasi[types.houseSale])).resolves.toHaveLength(20);
  });

  test('scraper.getList has 20 items for all urls', () => {
    const results = [];
    Object.values(types).forEach((type) => {
      if (!URL.halooglasi[type]) return;
      results.push(scraper.getList(URL.halooglasi[type]));
    });
    return Promise.all(results).then(rezs => {
      expect(rezs.flat()).toHaveLength((Object.values(types).length - 2) * 20); // reduce by 2 others
    })
  });

  test('scraper.getList should return urls', async () => {
    const expectedArray = Array(20).fill({
      url: expect.any(String),
      id: expect.any(String),
      price: expect.any(Number),
    });
    await expect(scraper.getList(URL.halooglasi[types.houseSale])).resolves.toEqual(expect.arrayContaining(expectedArray));
  });


  test('scraper.getList should return urls for all property types', () => {
    const expectedArray = Array(Object.values(types).length - 2).fill({ // remove 2 others
      url: expect.any(String),
      id: expect.any(String),
      price: expect.any(Number),
    });
    const results = [];
    Object.values(types).forEach((type) => {
      if (!URL.halooglasi[type]) return;
      results.push(scraper.getList(URL.halooglasi[type]));
    });
    return Promise.all(results).then(rezs => {
      expect(rezs.flat()).toEqual(expect.arrayContaining(expectedArray));
    })
  });

  const list = [{ id: '5425635452108', url: '/nekretnine/prodaja-kuca/dedinje-lux-vila-604m2-4ara-bazen-sauna-kamin/5425635452108?kid=4', price: 2000000 }, { id: '5425636365369', url: '/nekretnine/prodaja-kuca/kopaonik-na-3-ara-placa-vikendica-3km-grand/5425636365369?kid=4', price: 49900 }, { id: '5425636504657', url: '/nekretnine/prodaja-kuca/kuca-na-klisi/5425636504657?kid=4', price: 94500 }, { id: '5425636574724', url: '/nekretnine/prodaja-kuca/zarkovo-bele-vode-lux-kuca-generalica-prodaja/5425636574724?kid=4', price: 259000 }, { id: '5425636577216', url: '/nekretnine/prodaja-kuca/savski-venac-senjak---colak-antina/5425636577216?kid=4', price: 745000 }, { id: '5425636434030', url: '/nekretnine/prodaja-kuca/luksuzna-kuca/5425636434030?kid=4', price: 500000 }, { id: '5425636591287', url: '/nekretnine/prodaja-kuca/avala-suplja-stena-top-vikend-kuca-100m2-7500/5425636591287?kid=4', price: 75000 }, { id: '5425635614438', url: '/nekretnine/prodaja-kuca/luks-kuca-bezanijska-kosa-i-krajnja/5425635614438?kid=4', price: 399000 }, { id: '5425635256261', url: '/nekretnine/prodaja-kuca/kuca-na-prodaju-u-starcevo---blizu-skole-i-ce/5425635256261?kid=4', price: 35000 }, { id: '5425636496269', url: '/nekretnine/prodaja-kuca/visnjicka-banja-lesce-kuca-120m2-legalizovana/5425636496269?kid=4', price: 127000 }, { id: '5425636240199', url: '/nekretnine/prodaja-kuca/dedinje-veoma-luksuzna-kuca-uknjizena-id-1564/5425636240199?kid=4', price: 950000 }, { id: '5425635985984', url: '/nekretnine/prodaja-kuca/kosmaj-zoroljin-35ari-kuca-200m2/5425635985984?kid=4', price: 65000 }, { id: '5425636585141', url: '/nekretnine/prodaja-kuca/lux-kuca-sa-prelepim-dvoristem-na-glavnom-put/5425636585141?kid=4', price: 125000 }, { id: '5425636518907', url: '/nekretnine/prodaja-kuca/luksuzna-kuca-sa-bazenom-i-30-ari-placa--oaza/5425636518907?kid=4', price: 249000 }, { id: '5425635884665', url: '/nekretnine/prodaja-kuca/cukarica-banovo-brdo---petra-lekovica/5425635884665?kid=4', price: 549000 }, { id: '5425636276498', url: '/nekretnine/prodaja-kuca/lux-vila-na-dunavu-sa-bazenom-novi-banovci/5425636276498?kid=4', price: 400000 }, { id: '5425636600591', url: '/nekretnine/prodaja-kuca/izuzetna-ponuda-kuca-u-veterniku---odlicna/5425636600591?kid=4', price: 145000 }, { id: '5425635785546', url: '/nekretnine/prodaja-kuca/predivna-kuca-u-oazi-mira-moderno-opremljena/5425635785546?kid=4', price: 155000 }, { id: '5425636301903', url: '/nekretnine/prodaja-kuca/extra-extra-lux-kuca--bez-provizije/5425636301903?kid=4', price: 520000 }, { id: '5425636588473', url: '/nekretnine/prodaja-kuca/vlasnik-prodaje-kucu-u-mladenovac/5425636588473?kid=4', price: 116500 }]

  // eslint-disable-next-line jest/no-disabled-tests
  test.skip('list will have equal to or less than 20 items', async () => {
    const filteredList = await scraper.filterList(list)
    await expect(filteredList.length).toBeLessThanOrEqual(20)
  })

  test('scraper.scrapeList returns 20 items in array for houseSale', async () => {
    await expect(scraper.scrapeList(URL.halooglasi[types.houseSale], types.houseSale)).resolves.toHaveLength(20);
  });
  test('scraper.scrapeList returns 20 items in array for houseRent', async () => {
    await expect(scraper.scrapeList(URL.halooglasi[types.houseRent], types.houseRent)).resolves.toHaveLength(20);
  });
  test('scraper.scrapeList returns 20 items in array for apartmentSale', async () => {
    await expect(scraper.scrapeList(URL.halooglasi[types.apartmentSale], types.apartmentSale)).resolves.toHaveLength(20);
  });
  test('scraper.scrapeList returns 20 items in array for apartmentRent', async () => {
    await expect(scraper.scrapeList(URL.halooglasi[types.apartmentRent], types.apartmentRent)).resolves.toHaveLength(20);
  });
  test('scraper.scrapeList returns 20 items in array for landSale', async () => {
    await expect(scraper.scrapeList(URL.halooglasi[types.landSale], types.landSale)).resolves.toHaveLength(20);
  });
  test('scraper.scrapeList returns 20 items in array for landRent', async () => {
    await expect(scraper.scrapeList(URL.halooglasi[types.landRent], types.landRent)).resolves.toHaveLength(20);
  });

  // eslint-disable-next-line jest/no-disabled-tests
  test.skip('scraper.scrapeList returns 20 items in array for every property', () => {
    const results = [];
    Object.values(types).forEach((type) => {
      results.push(scraper.scrapeList(URL.halooglasi[type], type));
    });
    return Promise.all(results).then(rezs => {
      expect(rezs.flat()).toHaveLength(Object.values(types).length * 20);
    })
  });

  test('scraper.scrapeList returns 20 property items', async () => {
    const expectedArray = Array(20).fill(expectedPropertyObject);
    await expect(scraper.scrapeList(URL.halooglasi[types.houseSale], types.houseSale)).resolves.toEqual(expect.arrayContaining(expectedArray));
  });

  test('scraper.scrape house sale should return numOfPages*20 objects', async () => {
    await expect(scraper.scrape(types.houseSale)).resolves.toHaveLength(60);
  });

  test('scraper.scrape house sale should return numOfPages*20 property objects', async () => {
    await expect(scraper.scrape(types.houseSale)).resolves.toEqual(expect.arrayContaining(Array(60).fill(expectedPropertyObject)));
  });

  test('scraper.scrape house sale should not return properties with wrong ValidFrom date', async () => {
    const properties = await scraper.scrape(types.houseSale)
    expect(properties.some(property => property.validFrom > new Date())).toBeFalsy()
  });

  test('scraper.scrape apartman sale should return numOfPages*20 objects', async () => {
    await expect(scraper.scrape(types.apartmentSale)).resolves.toHaveLength(60);
  });

  test('scraper.scrape apartman sale should return numOfPages*20 property objects', async () => {
    await expect(scraper.scrape(types.apartmentSale)).resolves.toEqual(expect.arrayContaining(Array(60).fill(expectedPropertyObject)));
  });

  test('scraper.scrape apartman sale should not return properties with wrong ValidFrom date', async () => {
    const properties = await scraper.scrape(types.apartmentSale)
    expect(properties.some(property => property.validFrom > new Date())).toBeFalsy()
  });

  test('scraper.scrape land sale should return numOfPages*20 objects', async () => {
    await expect(scraper.scrape(types.landSale)).resolves.toHaveLength(20);
  });

  test('scraper.scrape land sale should return property objects', async () => {
    const properties = await scraper.scrape(types.landSale)
    expect(properties[0]).toEqual(expectedPropertyObject);
  });

  test('scraper.scrape land sale should return numOfPages*20 property objects', async () => {
    await expect(scraper.scrape(types.landSale)).resolves.toEqual(expect.arrayContaining(Array(20).fill(expectedPropertyObject)));
  });

  test('scraper.scrape land sale should not return properties with wrong ValidFrom date', async () => {
    const properties = await scraper.scrape(types.landSale)
    expect(properties.some(property => property.validFrom > new Date())).toBeFalsy()
  });
});
