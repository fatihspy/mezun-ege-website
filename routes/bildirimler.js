const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const Bildirim = require('../models/Bildirim');

// GET /api/bildirimler/okunmamis-sayisi — Hızlı polling için sadece sayı döner
router.get('/okunmamis-sayisi', authMiddleware, async (req, res, next) => {
  try {
    const since = req.query.since ? new Date(req.query.since) : null;
    const query = { user: req.kullanici._id, okundu: false };
    if (since) query.tarih = { $gt: since };
    const sayi = await Bildirim.countDocuments(query);
    res.json({ basarili: true, sayi });
  } catch (err) { next(err); }
});

// GET /api/bildirimler — Kullanıcının son bildirimleri
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit || '20', 10));
    const bildirimler = await Bildirim.find({ user: req.kullanici._id })
      .sort({ tarih: -1 })
      .limit(limit)
      .lean();
    res.json({ basarili: true, bildirimler });
  } catch (err) { next(err); }
});

// POST /api/bildirimler — Yeni bildirim oluştur (ör: sunucu tarafı veya yönetici)
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { userId, tip, mesaj, link } = req.body;
    if (!userId || !mesaj) return res.status(400).json({ basarili: false, mesaj: 'userId ve mesaj gerekli.' });
    const b = await Bildirim.create({ user: userId, tip, mesaj, link });
    res.status(201).json({ basarili: true, bildirim: b });
  } catch (err) { next(err); }
});

// PUT /api/bildirimler/:id/okundu — Bildirimi okundu yap
router.put('/:id/okundu', authMiddleware, async (req, res, next) => {
  try {
    const b = await Bildirim.findOneAndUpdate({ _id: req.params.id, user: req.kullanici._id }, { $set: { okundu: true } }, { new: true });
    if (!b) return res.status(404).json({ basarili: false, mesaj: 'Bildirim bulunamadı.' });
    res.json({ basarili: true });
  } catch (err) { next(err); }
});

module.exports = router;
