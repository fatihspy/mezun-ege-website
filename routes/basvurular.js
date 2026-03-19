const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const validator = require('../utils/validator');
const Basvuru = require('../models/Basvuru');
const Ilan = require('../models/Ilan');
const authMiddleware = require('../middleware/auth');

// Rate limiters
const basvuruLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,   // 1 saat
  max: 20,                    // günde 20 başvuru
  message: { basarili: false, mesaj: 'Çok fazla başvuru yaptınız. 1 saat sonra tekrar deneyin.' }
});

// POST /api/basvurular/:ilanId — İlana başvur
router.post('/:ilanId', basvuruLimiter, authMiddleware, async (req, res, next) => {
    try {
        if (req.kullanici.rol.includes('isveren')) return res.status(403).json({ basarili: false, mesaj: 'İşverenler ilana başvuramaz.' });
        const ilan = await Ilan.findById(req.params.ilanId);
        if (!ilan) return res.status(404).json({ basarili: false, mesaj: 'İlan bulunamadı.' });

        // CV validation
        if (req.body.cvBase64) {
            const cvCheck = validator.validateCV(req.body.cvBase64);
            if (!cvCheck.valid) return res.status(400).json({ basarili: false, mesaj: cvCheck.error });
        }

        const basvuru = await Basvuru.create({
            ilan: ilan._id, 
            basvuran: req.kullanici._id, 
            isveren: ilan.isveren, 
            onYazi: req.body.onYazi ? validator.sanitizeString(req.body.onYazi) : '',
            cvBase64: req.body.cvBase64 || null,
            cvVar: !!req.body.cvBase64
        });
        res.json({ basarili: true, mesaj: 'Başvurunuz başarıyla alındı.', basvuru });
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ basarili: false, mesaj: 'Bu ilana zaten başvurdunuz.' });
        next(err); 
    }
});

// GET /api/basvurular/benimkiler — Öğrencinin kendi başvuruları
router.get('/benimkiler', authMiddleware, async (req, res, next) => {
    try {
        const basvurular = await Basvuru.find({ basvuran: req.kullanici._id }).populate('ilan', 'pozisyon sirket konum tur').sort({ basvuruTarihi: -1 });
        res.json({ basarili: true, basvurular });
    } catch (err) { next(err); }
});

// GET /api/basvurular/isveren — İşverene GELEN başvurular
router.get('/isveren', authMiddleware, async (req, res, next) => {
    try {
        if (!req.kullanici.rol.includes('isveren')) return res.status(403).json({ basarili: false, mesaj: 'Yetkisiz erişim.' });
        const basvurular = await Basvuru.find({ isveren: req.kullanici._id })
            .populate('ilan', 'pozisyon')
            .populate('basvuran', 'isim soyisim email telefon')
            .populate('isveren', '_id')
            .sort({ basvuruTarihi: -1 });
        res.json({ basarili: true, basvurular });
    } catch (err) { next(err); }
});

// PUT /api/basvurular/:id/durum — Başvuru durumunu güncelle (İşveren)
router.put('/:id/durum', authMiddleware, async (req, res, next) => {
    try {
        const basvuru = await Basvuru.findOneAndUpdate(
            { _id: req.params.id, isveren: req.kullanici._id },
            { durum: req.body.durum },
            { new: true }
        );
        if (!basvuru) return res.status(404).json({ basarili: false, mesaj: 'Başvuru bulunamadı.' });
        res.json({ basarili: true, basvuru });
    } catch (err) { next(err); }
});

module.exports = router;