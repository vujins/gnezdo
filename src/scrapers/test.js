const axios = require('axios').default;
const cheerio = require('cheerio');

axios.get('https://www.halooglasi.com/nekretnine/prodaja-kuca/meljak-lole-ribara/5425634274942?kid=3&sid=1593357380298')
    .then((response) => {
      if (response.status !== 200) throw new Error('ERROR' + response.status);
      const html = response.data;
      const $ = cheerio.load(html, {xmlMode: false});
      const scripts = $('script');
      scripts.each((i, element) => {
        const child = element.children[0];
        if (child) {
          const script = child.data;
          if (script && script.includes('QuidditaEnvironment.CurrentClassified=')) {
            console.log(script.trim().replace('\t', '').split('\n'));
          }
        }
      });
    })
    .catch(console.error);
