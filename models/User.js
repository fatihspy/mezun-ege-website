const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  rol: { type: String, enum: ['mezun', 'ogrenci', 'isveren', 'isveren_adayi'], required: true },
  password: { type: String, required: true },
  isim: { type: String, trim: true },
  soyisim: { type: String, trim: true },
  olusturmaTarihi: { type: Date, default: Date.now },
  sonGiris: { type: Date },
  profilTamamlandi: { type: Boolean, default: false },
  dogrulamaKodu: { type: String }, // Legacy, password sisteme geçiş için
  dogrulamaKoduSonAmi: { type: Date }, // Legacy

  sifreBelirlemeKodu: { type: String }, // Eski kullanıcılar için şifre belirleme kodu
  sifreBelirlemeKoduSonAmi: { type: Date }, // Şifre belirleme kodunun expiry zamanı

  // EMAIL DOĞRULAMA
  emailVerified: { type: Boolean, default: false },
  emailVerificationCode: { type: String },
  emailVerificationCodeExpiry: { type: Date },

  // ŞIFRE SIFIRLA (Forgot Password)
  passwordResetCode: { type: String },
  passwordResetCodeExpiry: { type: Date },

  // YENİ EKLENEN PROFİL ALANLARI
  unvan: { type: String, trim: true },
  konum: { type: String, trim: true },
  hakkimda: { type: String, trim: true },
  telefon: { type: String, trim: true },
  egitim: [{
    okul: String,
    bolum: String,
    baslangic: String,
    bitis: String,
    aciklama: String
  }],
  deneyim: [{
    pozisyon: String,
    sirket: String,
    baslangic: String,
    bitis: String,
    aciklama: String
  }],
  beceriler: [{
    ad: String,
    seviye: Number
  }],
  diller: [{
    ad: String,
    seviye: Number
  }],
  sosyalMedya: {
    linkedin: String,
    github: String,
    web: String
  }
});

module.exports = mongoose.model('User', userSchema);