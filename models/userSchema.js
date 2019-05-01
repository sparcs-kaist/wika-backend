const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,
  contact: [{
    type: String,
    address: String,
  }],
  penalty: [{
    id: String,
    issueDate: Date,
    endDate: Date,
    reason: String,
  }],
  history: [{
    id: String,
  }],
});

module.exports = mongoose.model('User', userSchema);
