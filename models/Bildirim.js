const mongoose = require('mongoose');

const bildirimSchema = new mongoose.Schema({
  user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tip:    { type: String, trim: true },
  mesaj:  { type: String, trim: true },
  link:   { type: String, trim: true },
  okundu: { type: Boolean, default: false },
  tarih:  { type: Date, default: Date.now }
});

// Index for fast lookup of recent notifications per user
bildirimSchema.index({ user: 1, tarih: -1 });

module.exports = mongoose.model('Bildirim', bildirimSchema);
