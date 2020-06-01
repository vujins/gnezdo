const cheerio = require('cheerio');
const axios = require('axios').default;

const sid = `&sid=${Date.now()}`;

const baseUrl = 'https://www.halooglasi.com';
const baseNest = baseUrl + '/nekretnine';

const sale = baseNest + '/prodaja-';
const rent = baseNest + '/izdavanje-';

const apartmentType = 'stan';
const apartmentSale = sale + 'stanova';
const apartmentRent = rent + 'stanova';

const houseType = 'kuca';
const houseSale = sale + 'kuca';
const houseRent = rent + 'kuca';

const landType = 'zemljiste';
const landSale = sale + 'zemljista';
const landRent = rent + 'zemljista';

const getLatest = (url, type, lastSearch) => {
  return axios.get(url)
      .then((response) => {
        const rez = [];
        const html = response.data;
        const $ = cheerio.load(html);
        const list = $('.product-list > div > .row > div');
        list.each((i, element) => {
          const places = $(element).find('div > .subtitle-places > li');
          const features = $(element).find('div > .product-features > li > div');
          console.log(features['1'].children[0].data);
          const surfaceAndMeasurement = features['1'].children[0].data.split(' ');
          console.log(surfaceAndMeasurement);
          rez.push({
            type: type,
            price: parseFloat($(element).find('.central-feature > span').attr('data-value').replace(/\W/g, '')),
            title: $(element).find('div > .product-title > a').text(),
            link: baseUrl + $(element).find('div > .product-title > a').attr('href') + sid,
            city: places['0'] ? places['0'].children[0].data.trim() : undefined,
            location: places['1'] ? places['1'].children[0].data.trim() : undefined,
            microlocation: places['2'] ? places['2'].children[0].data.trim() : undefined,
            street: places['3'] ? places['3'].children[0].data.trim() : undefined,
            surface: parseFloat(surfaceAndMeasurement[0].replace(',', '.')),
            measurement: surfaceAndMeasurement[1],
            roomsNumber: features['2']? parseFloat(features['2'].children[0].data.replace('+', '').replace(',', '.')) : undefined,
          });
        });
        return rez;
      })
      .catch(console.error);
};

const getAllLatest = async () => {
  const iou = [];

  iou.push(getLatest(houseSale, houseType, 0));
  iou.push(getLatest(houseRent, houseType, 0));

  iou.push(getLatest(apartmentSale, apartmentType, 0));
  iou.push(getLatest(apartmentRent, apartmentType, 0));

  iou.push(getLatest(landSale, landType, 0));
  iou.push(getLatest(landRent, landType, 0));

  return await Promise.all(iou);
};

module.exports = getAllLatest;
