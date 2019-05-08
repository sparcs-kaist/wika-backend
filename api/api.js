const express = require('express');

const router = express.Router();

const Destination = require('../models/destinationSchema');


router.get('/test', (req, res) => {
  res.send('hello world!');
});


router.get('/destination', (req, res) => {
  Destination.find({})
  .then(destinations => {
    return res.json(destinations);
  });
});

module.exports = router;

