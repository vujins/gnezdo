const express = require('express');
const getLatest = require('./src/scraper-haloograsi');

// connect mongoose to mongodb local instance
require('./src/config/db');

const app = express();
const port = 3000;

app.get('/', (req, res) => res.send('hello :D'));

app.listen(port, () => console.log(`Server running at http://localhost:${port}`));

console.log(getLatest());
