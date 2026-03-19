const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const Mesaj = require('../models/Mesaj');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

// Rate limiters
const mesajLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 dakika
  max: 30,                    // 30 mesaj/dakika
  message: { basarili: false, mesaj: 'Çok fazla mesaj gönderdiniz. Lütfen bir tur sonra tekrar deneyin.' }
});

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
        const arama = req.query.q || '';
        const kisiler = await User.find({
            _id: { $ne: req.kullanici._id }, // Kendimizi hariç tut
            $or: [
                { isim: { $regex: arama, $options: 'i' } },
                { soyisim: { $regex: arama, $options: 'i' } },
                { email: { $regex: arama, $options: 'i' } }
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

        const yeniMesaj = await Mesaj.create({ gonderen: req.kullanici._id, alici: alici._id, metin: req.body.metin });
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