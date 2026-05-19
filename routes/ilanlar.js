const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const validator = require('../utils/validator');
const Ilan = require('../models/Ilan');
const Basvuru = require('../models/Basvuru');
const authMiddleware = require('../middleware/auth');

// Normalize incoming `tur` values to the model enum values
function normalizeTur(val) {
    if (typeof val !== 'string') return null;
    let v = val.toLowerCase().trim();
    // replace common Turkish characters with ASCII approximations for matching
    v = v.replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
             .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c');
    v = v.replace(/[^a-z0-9 ]/g, '');
    v = v.replace(/\s+/g, ' ').trim();

    const map = {
        'tam': 'tam',
        'tam zamanli': 'tam',
        'tamzamanli': 'tam',
        'tamm': 'tam',
        'yari': 'yari',
        'yari zamanli': 'yari',
        'staj': 'staj',
        'uzaktan': 'uzaktan',
        'remote': 'uzaktan',
        'uzaktan calisma': 'uzaktan',
        'uzaktancalisma': 'uzaktan'
    };

    return map[v] || null;
}

// Rate limiters
const ilanListeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 dakika
  max: 100,                   // 100 istek
  message: { basarili: false, mesaj: 'Çok fazla istek. Lütfen bir tur süre sonra tekrar deneyin.' }
});

const ilanCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,   // 1 saat
  max: 50,                    // 50 ilan oluştur
  message: { basarili: false, mesaj: 'Çok fazla ilan oluşturdunuz. 1 saat sonra tekrar deneyin.' }
});

// GET /api/ilanlar — Tüm aktif ilanları getir
router.get('/', ilanListeLimiter, authMiddleware, async (req, res, next) => {
    try {
        const ilanlar = await Ilan.find({ aktifMi: true })
                                  .sort({ olusturmaTarihi: -1 })
                                  .populate('isveren', 'isim soyisim email');
        res.json({ basarili: true, ilanlar });
    } catch (err) { next(err); }
});

// GET /api/ilanlar/benimkiler — İşverenin kendi ilanları
router.get('/benimkiler', ilanListeLimiter, authMiddleware, async (req, res, next) => {
    try {
        const ilanlar = await Ilan.find({ isveren: req.kullanici._id }).sort({ olusturmaTarihi: -1 });
        res.json({ basarili: true, ilanlar });
    } catch (err) { next(err); }
});

// POST /api/ilanlar — Yeni ilan oluştur
router.post('/', ilanCreateLimiter, authMiddleware, async (req, res, next) => {
    try {
        if (!req.kullanici.rol.includes('isveren')) {
            return res.status(403).json({ basarili: false, mesaj: 'İlan oluşturma yetkiniz yok.' });
        }
        
        // Validation
        const pozCheck = validator.validatePosition(req.body.pozisyon);
        if (!pozCheck.valid) return res.status(400).json({ basarili: false, mesaj: pozCheck.error });
        
        const salaryCheck = validator.validateSalary(req.body.minMaas);
        if (!salaryCheck.valid) return res.status(400).json({ basarili: false, mesaj: salaryCheck.error });
        
        // Normalize `tur` to match schema enum values when possible
        if (req.body.tur) {
            const nt = normalizeTur(req.body.tur);
            if (nt) req.body.tur = nt;
            else req.body.tur = String(req.body.tur).toLowerCase().trim();
        }

        const yeniIlan = await Ilan.create({ 
            ...req.body, 
            isveren: req.kullanici._id,
            pozisyon: validator.sanitizeString(req.body.pozisyon),
            aciklama: validator.sanitizeLongText(req.body.aciklama),
            konum: validator.sanitizeString(req.body.konum)
        });
        res.status(201).json({ basarili: true, ilan: yeniIlan });
    } catch (err) { next(err); }
});

// PUT /api/ilanlar/:id — İlan güncelle
router.put('/:id', ilanCreateLimiter, authMiddleware, async (req, res, next) => {
    try {
        // Whitelist and sanitize allowed update fields to prevent privilege escalation
        const { pozisyon, aciklama, tur, maas, konum, nitelikler, sonTarih, aktifMi } = req.body;
        const updateSet = {};
        if (pozisyon !== undefined) updateSet.pozisyon = validator.sanitizeString(pozisyon);
        if (aciklama !== undefined) updateSet.aciklama = validator.sanitizeLongText(aciklama);
        if (tur !== undefined) {
            const nt = normalizeTur(tur);
            updateSet.tur = nt || String(tur).toLowerCase().trim();
        }
        if (maas !== undefined) updateSet.maas = validator.sanitizeString(maas);
        if (konum !== undefined) updateSet.konum = validator.sanitizeString(konum);
        if (nitelikler !== undefined) updateSet.nitelikler = validator.sanitizeLongText(nitelikler);
        if (sonTarih !== undefined) {
            const d = new Date(sonTarih);
            if (!isNaN(d)) updateSet.sonTarih = d;
        }
        if (aktifMi !== undefined) updateSet.aktifMi = Boolean(aktifMi);

        const ilan = await Ilan.findOneAndUpdate(
            { _id: req.params.id, isveren: req.kullanici._id },
            { $set: updateSet },
            { new: true, runValidators: true }
        );
        if (!ilan) return res.status(404).json({ basarili: false, mesaj: 'İlan bulunamadı veya yetkiniz yok.' });
        res.json({ basarili: true, ilan });
    } catch (err) { next(err); }
});

// DELETE /api/ilanlar/:id — İlan sil
router.delete('/:id', ilanCreateLimiter, authMiddleware, async (req, res, next) => {
    try {
        const ilan = await Ilan.findOneAndDelete({ _id: req.params.id, isveren: req.kullanici._id });
        if (!ilan) return res.status(404).json({ basarili: false, mesaj: 'İlan bulunamadı.' });
        await Basvuru.deleteMany({ ilan: req.params.id });
        res.json({ basarili: true, mesaj: 'İlan ve ilgili başvurular silindi.' });
    } catch (err) { next(err); }
});

module.exports = router;
