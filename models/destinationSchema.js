const mongoose = require('mongoose');

const destinationSchema = new mongoose.Schema({
  name: String,
});

module.exports = mongoose.model('Destination', destinationSchema);
