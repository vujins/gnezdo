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

const url = {
  halooglasi: {
    baseUrl: halooglasiBaseUrl,
    houseSale: halooglasiHouseSale,
    houseRent: halooglasiHouseRent,
    apartmentSale: halooglasiApartmentSale,
    apartmentRent: halooglasiApartmentRent,
    landSale: halooglasiLandSale,
    landRent: halooglasiLandRent,
  },
};

module.exports = url;
