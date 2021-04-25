const axios = require('axios').default;
const { JSDOM, VirtualConsole } = require('jsdom');

async function scrape(url) {
  const { data } = await axios.get(url);
  // virtualConsole by default has no handlers, this is to silence all internal script errors
  const virtualConsole = new VirtualConsole();
  const dom = new JSDOM(data, {
    runScripts: 'dangerously',
    // resources: 'usable',
    virtualConsole,
  });
  const { window } = dom;
  const { Id, Title, ValidFrom, GeoLocationRPT, CategoryNames, TotalViews, AveragePriceBySurfaceValue, AveragePriceBySurfaceLink, cena_d_unit_s, kvadratura_d_unit_s, broj_soba_s, spratnost_s, povrsina_placa_d, grad_s, lokacija_s, mikrolokacija_s, kvadratura_d, oglasivac_nekretnine_s, ulica_t, cena_d, povrsina_placa_d_unit_s } = window.QuidditaEnvironment?.CurrentClassified;

  return {
    url,
    id: Id,
    title: Title,
    validFrom: ValidFrom,
    geoLocation: GeoLocationRPT,
    categories: CategoryNames,
    rooms: broj_soba_s,
    floors: spratnost_s,
    plot: povrsina_placa_d,
    plotUnit: povrsina_placa_d_unit_s,
    city: grad_s,
    location: lokacija_s,
    microlocation: mikrolokacija_s,
    sqm: kvadratura_d,
    sqmUnit: kvadratura_d_unit_s,
    street: ulica_t,
    price: cena_d,
    priceUnit: cena_d_unit_s,
    pricePerSqm: Math.floor(cena_d / kvadratura_d),
    avaragePricePerSqm: AveragePriceBySurfaceValue,
    avaragePricePerSqmLink: AveragePriceBySurfaceLink,
    advertiser: oglasivac_nekretnine_s,
    totalViews: TotalViews,
  }
}

module.exports = scrape;
