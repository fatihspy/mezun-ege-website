const mongoose = require('mongoose');

const mesajSchema = new mongoose.Schema({
  gonderen: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  alici:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  metin:    { type: String, required: true },
  okundu:   { type: Boolean, default: false },
  tarih:    { type: Date, default: Date.now }
});

module.exports = mongoose.model('Mesaj', mesajSchema);