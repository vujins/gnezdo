const types = require('./types');

const halooglasiBaseUrl = 'https://www.halooglasi.com';
const halooglasiBaseNest = halooglasiBaseUrl + '/nekretnine';

const halooglasiSale = halooglasiBaseNest + '/prodaja-';
const halooglasiLandRentRent = halooglasiBaseNest + '/izdavanje-';

const halooglasiApartmentSale = halooglasiSale + 'stanova';
const halooglasiApartmentRent = halooglasiLandRentRent + 'stanova';

const halooglasiHouseSale = halooglasiSale + 'kuca';
const halooglasiHouseRent = halooglasiLandRentRent + 'kuca';

const halooglasiLandSale = halooglasiSale + 'zemljista';
const halooglasiLandRent = halooglasiLandRentRent + 'zemljista';

const url = Object.freeze({
  halooglasi: {
    baseUrl: halooglasiBaseUrl,
    [types.houseSale]: halooglasiHouseSale,
    [types.houseRent]: halooglasiHouseRent,
    [types.apartmentSale]: halooglasiApartmentSale,
    [types.apartmentRent]: halooglasiApartmentRent,
    [types.landSale]: halooglasiLandSale,
    [types.landRent]: halooglasiLandRent,
  },
});

module.exports = url;
