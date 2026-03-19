const express = require('express');
const router = express.Router();
const validator = require('../utils/validator');
const Ilan = require('../models/Ilan');
const Basvuru = require('../models/Basvuru');
const authMiddleware = require('../middleware/auth');

// GET /api/ilanlar — Tüm aktif ilanları getir
router.get('/', authMiddleware, async (req, res, next) => {
    try {
        const ilanlar = await Ilan.find({ aktifMi: true })
                                  .sort({ olusturmaTarihi: -1 })
                                  .populate('isveren', 'isim soyisim email');
        res.json({ basarili: true, ilanlar });
    } catch (err) { next(err); }
});

// GET /api/ilanlar/benimkiler — İşverenin kendi ilanları
router.get('/benimkiler', authMiddleware, async (req, res, next) => {
    try {
        const ilanlar = await Ilan.find({ isveren: req.kullanici._id }).sort({ olusturmaTarihi: -1 });
        res.json({ basarili: true, ilanlar });
    } catch (err) { next(err); }
});

// POST /api/ilanlar — Yeni ilan oluştur
router.post('/', authMiddleware, async (req, res, next) => {
    try {
        if (!req.kullanici.rol.includes('isveren')) {
            return res.status(403).json({ basarili: false, mesaj: 'İlan oluşturma yetkiniz yok.' });
        }
        
        // Validation
        const pozCheck = validator.validatePosition(req.body.pozisyon);
        if (!pozCheck.valid) return res.status(400).json({ basarili: false, mesaj: pozCheck.error });
        
        const salaryCheck = validator.validateSalary(req.body.minMaas);
        if (!salaryCheck.valid) return res.status(400).json({ basarili: false, mesaj: salaryCheck.error });
        
        const yeniIlan = await Ilan.create({ 
            ...req.body, 
            isveren: req.kullanici._id,
            pozisyon: validator.sanitizeString(req.body.pozisyon),
            aciklama: validator.sanitizeString(req.body.aciklama),
            konum: validator.sanitizeString(req.body.konum)
        });
        res.status(201).json({ basarili: true, ilan: yeniIlan });
    } catch (err) { next(err); }
});

// PUT /api/ilanlar/:id — İlan güncelle
router.put('/:id', authMiddleware, async (req, res, next) => {
    try {
        const ilan = await Ilan.findOneAndUpdate(
            { _id: req.params.id, isveren: req.kullanici._id },
            req.body,
            { new: true }
        );
        if (!ilan) return res.status(404).json({ basarili: false, mesaj: 'İlan bulunamadı veya yetkiniz yok.' });
        res.json({ basarili: true, ilan });
    } catch (err) { next(err); }
});

// DELETE /api/ilanlar/:id — İlan sil
router.delete('/:id', authMiddleware, async (req, res, next) => {
    try {
        const ilan = await Ilan.findOneAndDelete({ _id: req.params.id, isveren: req.kullanici._id });
        if (!ilan) return res.status(404).json({ basarili: false, mesaj: 'İlan bulunamadı.' });
        await Basvuru.deleteMany({ ilan: req.params.id });
        res.json({ basarili: true, mesaj: 'İlan ve ilgili başvurular silindi.' });
    } catch (err) { next(err); }
});

module.exports = router;
