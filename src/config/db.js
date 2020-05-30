const mongoose = require('mongoose');

const dbUrl = 'mongodb://localhost/gnezdo';

mongoose.connect(dbUrl, {useNewUrlParser: true, useUnifiedTopology: true})
    .then(
        () => console.log('DB connected!'),
    ).catch(
        (error) => console.error(error),
    );

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'DB connection error:'));
