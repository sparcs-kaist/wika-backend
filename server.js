const express = require('express');
const morgan = require('morgan');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

const User = require('./models/userSchema');
const Party = require('./models/partySchema');
const Destination = require('./models/destinationSchema');

const api = require('./api/api');

const app = express();

dotenv.config();

const mongoDB = process.env.DB_PATH;
const db = mongoose.connection;

db.on('error', console.error.bind(console, 'mongodb connection error:'));
db.once('open', () => {
  console.log('connected to mongodb');
});
mongoose.connect(mongoDB, { useNewUrlParser: true });

app.use(express.json());
app.use(express.urlencoded({ extended: false }))

app.use(morgan('dev', {
  skip: function (req, res) {
    return res.statusCode < 400;
  },
  stream: process.stderr,
}));
app.use(morgan('dev', {
  skip: function (req, res) {
    return res.statusCode >= 400;
  },
  stream: process.stdout,
}));

app.use('/api', api);

app.use((req, res, next) => {
  return res.sendStatus(404);
});

app.listen(80, () => {
  console.log('server listening at port 80');
});
