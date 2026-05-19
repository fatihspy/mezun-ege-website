const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const Mesaj = require('../models/Mesaj');
const User = require('../models/User');
const Bildirim = require('../models/Bildirim');
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

// GET /api/mesajlar/konusmalar — Kullanıcının konuşmalarını DB tarafında gruplayarak getir (aggregation)
router.get('/konusmalar', mesajLimiter, authMiddleware, async (req, res, next) => {
    try {
        const userId = req.kullanici._id;
        const mongoose = require('mongoose');
        const userObjId = new mongoose.Types.ObjectId(userId);

        // Pipeline: match user's messages, compute 'other' participant, sort by date desc,
        // group by other participant taking the latest message per conversation and unread count
        const pipeline = [
            { $match: { $or: [ { gonderen: userObjId }, { alici: userObjId } ] } },
            { $addFields: { other: { $cond: [ { $eq: ['$gonderen', userObjId] }, '$alici', '$gonderen' ] } } },
            { $sort: { tarih: -1 } },
            { $group: {
                _id: '$other',
                sonMesaj: { $first: '$$ROOT' },
                okunmadi: { $sum: { $cond: [ { $and: [ { $eq: ['$alici', userObjId] }, { $eq: ['$okundu', false] } ] }, 1, 0 ] } },
                toplam: { $sum: 1 }
            } },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'karsi' } },
            { $unwind: '$karsi' },
            { $project: {
                karsiKullanici: { _id: '$karsi._id', isim: '$karsi.isim', soyisim: '$karsi.soyisim', email: '$karsi.email', rol: '$karsi.rol' },
                sonMesaj: { metin: '$sonMesaj.metin', tarih: '$sonMesaj.tarih', gonderen: '$sonMesaj.gonderen', alici: '$sonMesaj.alici' },
                okunmadi: 1,
                toplamMesaj: '$toplam'
            } },
            { $sort: { 'sonMesaj.tarih': -1 } },
            { $limit: 100 }
        ];

        const konusmalar = await Mesaj.aggregate(pipeline);

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

// GET /api/mesajlar/:karsiId/mesajlar — İki kullanıcı arasındaki tüm mesajları getir
router.get('/:karsiId/mesajlar', authMiddleware, async (req, res, next) => {
    try {
        const mongoose = require('mongoose');
        const benimId = req.kullanici._id;
        const karsiId = req.params.karsiId;

        if (!mongoose.Types.ObjectId.isValid(karsiId)) {
            return res.status(400).json({ basarili: false, mesaj: 'Geçersiz kullanıcı ID.' });
        }

        const mesajlar = await Mesaj.find({
            $or: [
                { gonderen: benimId, alici: karsiId },
                { gonderen: karsiId, alici: benimId }
            ]
        })
        .sort({ tarih: 1 })
        .limit(200)
        .lean();

        res.json({ basarili: true, mesajlar });
    } catch (err) { next(err); }
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

        // Alıcıya bildirim oluştur
        const gonderenAd = `${req.kullanici.isim || ''} ${req.kullanici.email}`.trim();
        await Bildirim.create({
            user: alici._id,
            tip: 'mesaj',
            mesaj: `${req.kullanici.isim || req.kullanici.email} size bir mesaj gönderdi.`,
            link: '/mesajlar/mesajlar.html'
        }).catch(() => {}); // bildirim hatası mesajı engellesin

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