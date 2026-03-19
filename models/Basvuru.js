const mongoose = require('mongoose');

const basvuruSchema = new mongoose.Schema({
  ilan:     { type: mongoose.Schema.Types.ObjectId, ref: 'Ilan', required: true },
  basvuran: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isveren:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  onYazi:   { type: String, trim: true },
  cvVar:    { type: Boolean, default: false },
  cvBase64: { type: String, default: null },
  durum:    { type: String, enum: ['beklemede', 'gorusme', 'reddedildi', 'kabul'], default: 'beklemede' },
  basvuruTarihi: { type: Date, default: Date.now }
});

// Aynı ilana iki kez başvuruyu engelle
basvuruSchema.index({ ilan: 1, basvuran: 1 }, { unique: true });

module.exports = mongoose.model('Basvuru', basvuruSchema);
