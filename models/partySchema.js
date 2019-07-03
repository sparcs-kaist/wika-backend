const mongoose = require('mongoose');

const partySchema = new mongoose.Schema({
  state: {
    type: String,
    enum: ['active', 'full', 'canceled', 'expired', 'done'],
  },
  members: [{
    type: mongoose.Schema.ObjectId,
    ref: 'User',
  }],
  limit: {
    type: Number,
    enum: [0, 2, 3, 4],
  },
  origin: String,
  destination: String,
  startDate: Date,
  endDate: Date,
  meetingTime: Date,
  cost: Number,
});

module.exports = mongoose.model('Party', partySchema);
