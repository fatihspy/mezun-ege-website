require('dotenv').config();
const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const helmet     = require('helmet');
const path       = require('path');

const app = express();

// ── Güvenlik başlıkları ───────────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));
}

// ── CORS ──────────────────────────────────────────────
const izinliOriginler = process.env.ALLOWED_ORIGIN
  ? process.env.ALLOWED_ORIGIN.split(',').map(o => o.trim())
  : [];

app.use(cors({
  origin: (origin, callback) => {
    // ALLOWED_ORIGIN=* ise herkese izin ver (sadece geliştirme)
    if (process.env.ALLOWED_ORIGIN === '*') return callback(null, true);
    // Origin yoksa (curl, Postman, sunucu içi istek) izin ver
    if (!origin) return callback(null, true);
    if (izinliOriginler.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: ${origin} adresine izin verilmiyor.`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ── Body parser ───────────────────────────────────────
app.use(express.json({ limit: '10mb' }));

// ── Statik dosyalar ───────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public', 'giris_ekrani')));

// ── API Routes ────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/ilanlar',    require('./routes/ilanlar'));
app.use('/api/basvurular', require('./routes/basvurular'));
app.use('/api/mesajlar',   require('./routes/mesajlar'));
app.use('/api/dosya',      require('./routes/dosya'));

// ── Ana sayfa ─────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'giris_ekrani', 'index.html'));
});

app.use('/giris-ekrani', express.static(path.join(__dirname, 'public', 'giris_ekrani')));
app.get('/giris-ekrani', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'giris_ekrani', 'index.html'));
});

// ── 404 ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// ── Global hata yönetimi ──────────────────────────────
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] HATA:`, err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }
  // Production'da iç hata detaylarını kullanıcıya gösterme
  const mesaj = process.env.NODE_ENV === 'production'
    ? 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.'
    : err.message;
  res.status(err.status || 500).json({ basarili: false, mesaj });
});

// ── MongoDB + Sunucu başlat ───────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    app.listen(process.env.PORT || 3000, () => {
      console.log(`🚀 Sunucu çalışıyor: http://localhost:${process.env.PORT || 3000}`);
      console.log(`📦 MongoDB bağlantısı başarılı`);
      console.log(`🌍 Ortam: ${process.env.NODE_ENV || 'development'}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB bağlantı hatası:', err.message);
    process.exit(1);
  });
