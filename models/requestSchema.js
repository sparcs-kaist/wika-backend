const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
  },
  state: {
    type: String,
    enum: ['active', 'canceled', 'matched', 'expired', 'done'],
  },
  limit: {
    type: Number,
    enum: [0, 2, 3, 4],
  },
  origin: String,
  destination: String,
  startDate: Date,
  endDate: Date,
  preferredDate: Date,
  cost: Number,
});

module.exports = mongoose.model('Request', requestSchema);
