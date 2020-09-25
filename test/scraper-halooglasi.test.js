const getAllLatest = require('../src/scrapers/scraper-haloograsi');
const url = require('../src/utils/url');

test('test if it returns data', async () => {
  jest.setTimeout(100000); // 100s to execute test
  const resultsPerPage = 20;
  const numberOfTypes = Object.keys(url.halooglasi).length;

  let rez = undefined;

  try {
    result = await getAllLatest();
    rez = result.flat();
  } catch (err) {
    console.error(err);
  };

  console.log(rez);
  expect(rez.length).toEqual(resultsPerPage * numberOfTypes);
});
