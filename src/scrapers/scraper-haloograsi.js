const cheerio = require('cheerio');
const axios = require('axios').default;

const dateParser = require('../utils/dateParser');
const types = require('../../functions/utils/types');
const scraperUrls = require('../../functions/utils/url');
const { response } = require('express');

const sid = `&sid=${Date.now()}`;
const resultsPerPage = 20;

const lastSearch = 0;

const getLatest = (url, type) => {
  return axios.get(url)
    .then((response) => {
      if (response.status !== 200) {
        throw new Error(`${url} did not respond!`);
      }
      const html = response.data;
      const $ = cheerio.load(html);
      const list = $('.product-list > div > .row > div');
      const iou = [];
      const t = [];
      list.each((i, element) => {
        const elementUrl = scraperUrls.halooglasi.baseUrl + $(element).find('div > .product-title > a').attr('href') + sid;
        iou.push(axios.get(elementUrl));
        t.push(elementUrl);
      });
      return Promise.all(iou);
    })
    .then((responses) => {

    })
    .catch(console.error);
};

const getAllLatest = async () => {
  const iou = [];

  iou.push(getLatest(scraperUrls.halooglasi.houseSale, types.houseSale));
  // iou.push(getLatest(scraperUrls.halooglasi.houseRent, types.houseRent));
  // iou.push(getLatest(scraperUrls.halooglasi.apartmentSale, types.apartmentSale));
  // iou.push(getLatest(scraperUrls.halooglasi.apartmentRent, types.apartmentRent));
  // iou.push(getLatest(scraperUrls.halooglasi.landSale, types.landSale));
  // iou.push(getLatest(scraperUrls.halooglasi.landRent, types.landRent));

  return Promise.all(iou);
};

module.exports = getAllLatest;
