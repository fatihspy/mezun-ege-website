const mongoose = require('mongoose');

const ilanSchema = new mongoose.Schema({
  isveren: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sirket: { type: String, required: true, trim: true },
  pozisyon: { type: String, required: true, trim: true },
  aciklama: { type: String, required: true },
  kategori: { type: String, default: 'yazilim' },
  tur: { type: String, enum: ['tam', 'yari', 'staj', 'uzaktan'], required: true },
  maas: { type: String, trim: true },
  konum: { type: String, trim: true },
  nitelikler: { type: String },
  sonTarih: { type: Date },
  olusturmaTarihi: { type: Date, default: Date.now },
  aktifMi: { type: Boolean, default: true }
});

module.exports = mongoose.model('Ilan', ilanSchema);