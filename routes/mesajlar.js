const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const Mesaj = require('../models/Mesaj');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const validator = require('../utils/validator');

// Rate limiters
const mesajLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 dakika
  max: 30,                    // 30 mesaj/dakika
  message: { basarili: false, mesaj: 'Çok fazla mesaj gönderdiniz. Lütfen bir tur sonra tekrar deneyin.' }
});

function regexEscape(str) {
        return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET /api/mesajlar/konusmalar — Kullanıcının tüm konuşmalarını gruplayarak getir
router.get('/konusmalar', mesajLimiter, authMiddleware, async (req, res, next) => {
    try {
        const userId = req.kullanici._id;
        // Kullanıcının gönderdiği veya aldığı tüm mesajları bul
        const mesajlar = await Mesaj.find({ $or: [{ gonderen: userId }, { alici: userId }] })
                                    .populate('gonderen alici', 'isim soyisim rol email')
                                    .sort({ tarih: 1 });

        const konusmalarMap = new Map();

        mesajlar.forEach(m => {
            // Karşı tarafı belirle
            const karsiTaraf = m.gonderen._id.toString() === userId.toString() ? m.alici : m.gonderen;
            const karsiId = karsiTaraf._id.toString();

            if (!konusmalarMap.has(karsiId)) {
                konusmalarMap.set(karsiId, { karsiKullanici: karsiTaraf, mesajlar: [], okunmadi: 0 });
            }
            
            const k = konusmalarMap.get(karsiId);
            k.mesajlar.push(m);
            // Bize gelen ve okunmamış olan mesajları say
            if (m.alici._id.toString() === userId.toString() && !m.okundu) k.okunmadi++;
        });

        // Tarihe göre en yeniler üstte olacak şekilde sırala
        const konusmalar = Array.from(konusmalarMap.values()).sort((a, b) => {
            const sonA = a.mesajlar[a.mesajlar.length - 1].tarih;
            const sonB = b.mesajlar[b.mesajlar.length - 1].tarih;
            return new Date(sonB) - new Date(sonA);
        });

        res.json({ basarili: true, konusmalar });
    } catch (err) { next(err); }
});

// GET /api/mesajlar/ara — Yeni mesaj için sistemdeki kişileri ara
router.get('/ara', authMiddleware, async (req, res, next) => {
    try {
        const arama = String(req.query.q || '').substring(0, 100).trim();
        if (arama.length < 2) {
            return res.json({ basarili: true, kisiler: [] });
        }
        const aramaGuvenli = regexEscape(arama);
        const kisiler = await User.find({
            _id: { $ne: req.kullanici._id }, // Kendimizi hariç tut
            $or: [
                { isim: { $regex: aramaGuvenli, $options: 'i' } },
                { soyisim: { $regex: aramaGuvenli, $options: 'i' } },
                { email: { $regex: aramaGuvenli, $options: 'i' } }
            ]
        }).select('isim soyisim rol email').limit(10);
        
        res.json({ basarili: true, kisiler });
    } catch(err) { next(err); }
});

// POST /api/mesajlar/:aliciId — Karşı tarafa mesaj gönder
router.post('/:aliciId', mesajLimiter, authMiddleware, async (req, res, next) => {
    try {
        const alici = await User.findById(req.params.aliciId);
        if (!alici) return res.status(404).json({ basarili: false, mesaj: 'Kişi bulunamadı.' });
        if (alici._id.toString() === req.kullanici._id.toString()) {
            return res.status(400).json({ basarili: false, mesaj: 'Kendinize mesaj gönderemezsiniz.' });
        }

        const metinHam = req.body?.metin;
        const metin = validator.sanitizeString(metinHam);
        if (!metin || metin.length < 1) {
            return res.status(400).json({ basarili: false, mesaj: 'Mesaj boş olamaz.' });
        }
        if (metin.length > 1000) {
            return res.status(400).json({ basarili: false, mesaj: 'Mesaj 1000 karakteri geçemez.' });
        }

        const yeniMesaj = await Mesaj.create({ gonderen: req.kullanici._id, alici: alici._id, metin });
        res.json({ basarili: true, mesaj: yeniMesaj });
    } catch (err) { next(err); }
});

// PUT /api/mesajlar/:karsiId/okundu — Konuşmayı okundu işaretle
router.put('/:karsiId/okundu', authMiddleware, async (req, res, next) => {
    try {
        await Mesaj.updateMany(
            { gonderen: req.params.karsiId, alici: req.kullanici._id, okundu: false },
            { $set: { okundu: true } }
        );
        res.json({ basarili: true });
    } catch (err) { next(err); }
});

module.exports = router;