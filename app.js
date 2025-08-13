const express = require('express');
const path = require('path');

const citiesRouter = require('./routes/cities');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/cities', citiesRouter);



module.exports = app;
