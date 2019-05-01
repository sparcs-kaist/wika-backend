const mongoose = require('mongoose');

const partySchema = new mongoose.Schema({
  state: Number,
  members: [{
    id: String,
    startDate: Date,
    endDate: Date,
    people: {
      min: Number,
      max: Number,
    },
    comment: String,
  }],
  origin: String,
  destination: String,
  cost: Number,
});

module.exports = mongoose.model('Party', partySchema);
