const cheerio = require('cheerio');
const axios = require('axios').default;

const dateParser = require('../utils/dateParser');
const types = require('../utils/types');
const scraperUrls = require('../utils/url');
const {response} = require('express');

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
        if (responses.length != resultsPerPage) {
          throw new Error(`${scraperUrls.halooglasi.baseUrl} didn't return ${resultsPerPage} expected results!`);
        }
        const rez = [];
        for (response of responses) {
          if (response.status !== 200) {
            throw new Error(`${response.config && response.config.url} did not respond!`);
          }
          const url = response.config.url;
          const html = response.data;
          const $ = cheerio.load(html);
          const id = parseInt($('.sidebar-info-box-content > #plh680 > .value > strong').text());
          const time = dateParser($('.sidebar-info-box-content > #plh682 > .value > strong').text());
          const title = $('.product-details-title > #plh1').text();
          const city = $('.product-details-desc > #plh2');
          const location = $('.product-details-desc > #plh3').text();
          const microlocation = $('.product-details-desc > #plh4').text();
          const street = $('.product-details-desc > #plh5').text();

          const price = parseInt($('.price-product-detail > #plh6 > .offer-price-value').text());
          const priceUnit = $('.price-product-detail > #plh6 > .offer-price-unit').text();

          rez.push({url, id, time, type, title, city, location, microlocation, street, price, priceUnit});
        }
        return rez;
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
