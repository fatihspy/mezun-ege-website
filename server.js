require('dotenv').config();

// Hata ayıklama — tüm yakalanmamış hataları logla
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err.message);
  console.error(err.stack);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
  process.exit(1);
});
const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const helmet     = require('helmet');
const cookieParser = require('cookie-parser');
const path       = require('path');
const logger     = require('./utils/logger');

// ── Environment Validation ─────────────────────────────
const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET'
];
// Mail değişkenleri opsiyonel — eksikse mail özellikleri çalışmaz ama sunucu başlar

const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingVars.length > 0) {
  console.error(`❌ Eksik environment variables: ${missingVars.join(', ')}`);
  console.error('Lütfen .env dosyasını doldur ve tekrar başlat.');
  process.exit(1);
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('❌ JWT_SECRET çok kısa! En az 32 karakter olmalı.');
  console.error('Oluştur: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  process.exit(1);
}

const app = express();

// ── Güvenlik başlıkları ───────────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));
}

// ── CORS ──────────────────────────────────────────────
// ALLOWED_ORIGIN çevre değişkeni virgülle ayrılmış origin listesi veya '*' olabilir.
const izinliOriginler = process.env.ALLOWED_ORIGIN
  ? process.env.ALLOWED_ORIGIN.split(',').map(o => o.trim()).filter(Boolean)
  : ['http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Eğer ALLOWED_ORIGIN='*' ise yalnızca development ortamında izin ver
    if (process.env.ALLOWED_ORIGIN === '*') {
      if (process.env.NODE_ENV === 'production') {
        return callback(new Error('CORS wildcard (*) production ortamında izinli değil. Lütfen ALLOWED_ORIGIN ayarını güncelleyin.'));
      }
      return callback(null, true);
    }

    // Origin yoksa (server-side veya curl gibi) izin ver
    if (!origin) return callback(null, true);

    // Normal listeleme
    if (izinliOriginler.includes(origin)) return callback(null, true);

    callback(new Error(`CORS: ${origin} adresine izin verilmiyor.`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
  ,credentials: true
}));

// ── Body parser ───────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
// Cookie parser for httpOnly auth cookies
app.use(cookieParser());

// ── Statik dosyalar ───────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public', 'giris_ekrani')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API Routes ────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/profil',     require('./routes/profil'));
app.use('/api/mezunlar',   require('./routes/mezunlar'));
app.use('/api/ilanlar',    require('./routes/ilanlar'));
app.use('/api/basvurular', require('./routes/basvurular'));
app.use('/api/mesajlar',   require('./routes/mesajlar'));
app.use('/api/dosya',      require('./routes/dosya'));
app.use('/api/bildirimler', require('./routes/bildirimler'));

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
  logger.error(`[${new Date().toISOString()}] HATA:`, {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  // Production'da iç hata detaylarını kullanıcıya gösterme
  const mesaj = process.env.NODE_ENV === 'production'
    ? 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.'
    : err.message;
  res.status(err.status || 500).json({ basarili: false, mesaj });
});

// ── MongoDB + Sunucu başlat ───────────────────────────
mongoose.connect(process.env.MONGODB_URI, {
  maxPoolSize: process.env.NODE_ENV === 'production' ? 20 : 10,
  minPoolSize: process.env.NODE_ENV === 'production' ? 10 : 5,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 5000,
})
  .then(async () => {
    logger.info(`📦 MongoDB bağlantısı başarılı`);
    logger.info(`🌍 Ortam: ${process.env.NODE_ENV || 'development'}`);

    // SMTP doğrulama atlandı — mail gönderimi arka planda çalışır

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Sunucu çalışıyor: http://0.0.0.0:${PORT}`);
    });
  })
  .catch(err => {
    logger.error('❌ MongoDB bağlantı hatası:', err.message);
    process.exit(1);
  });
