// const scrape = require('./scraper');
const scraper = require('./scraper');

const url = 'https://www.halooglasi.com/nekretnine/prodaja-kuca/luks-kuca-bezanijska-kosa-i-krajnja/5425635614438?kid=4&sid=1619357038686';


it('test', async () => {
  try {
    const data = await scraper();
    console.log(data);
  } catch (e) {
    e;
  }
  expect(true).toBe(true);
});
