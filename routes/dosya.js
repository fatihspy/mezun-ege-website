const express = require('express');
const router  = require('express').Router();
const Basvuru = require('../models/Basvuru');
const jwt     = require('jsonwebtoken');
const logger  = require('../utils/logger');
const cookieParser = require('cookie-parser');
const fs = require('fs/promises');
const path = require('path');

const uploadsRoot = path.resolve(__dirname, '..', 'uploads');

function resolveCvPath(cvUrl) {
    if (!cvUrl) return null;
    const relativePath = cvUrl.startsWith('/') ? cvUrl.slice(1) : cvUrl;
    const absolutePath = path.resolve(__dirname, '..', relativePath);
    if (!absolutePath.startsWith(uploadsRoot + path.sep) && absolutePath !== uploadsRoot) {
        return null;
    }
    return absolutePath;
}

// GET /api/dosya/cv/:basvuruId?type=basvuru&token=... — CV'yi indir
router.get('/cv/:basvuruId', async (req, res, next) => {
    try {
        const basvuruId = req.params.basvuruId;
        const { type } = req.query;

        // Accept token passed as query (legacy) OR cookie 'token' OR Authorization header
        let token = req.query.token || (req.cookies && req.cookies.token) || (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);
        let kullanici = null;
        if (!token) return res.status(401).json({ basarili: false, mesaj: 'Oturum bulunamadı. Lütfen giriş yapın.' });
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const User = require('../models/User');
            kullanici = await User.findById(decoded.id).select('-password');
        } catch (err) {
            logger.warn('CV indirme: geçersiz token', { error: err.message });
            return res.status(401).json({ basarili: false, mesaj: 'Geçersiz token.' });
        }

        if (type === 'basvuru') {
            const basvuru = await Basvuru.findById(basvuruId).populate('isveren', '_id');
            if (!basvuru) {
                return res.status(404).json({ basarili: false, mesaj: 'CV bulunamadı.' });
            }

            // Sadece ilgili işveren CV'yi indirebilir
            const isverenMatch = basvuru.isveren._id.toString() === kullanici._id.toString();
            if (!isverenMatch) {
                return res.status(403).json({ basarili: false, mesaj: 'Yetkiniz yok.' });
            }

            const cvPath = resolveCvPath(basvuru.cvUrl);
            if (!cvPath) {
                return res.status(404).json({ basarili: false, mesaj: 'CV bulunamadı.' });
            }

            try {
                await fs.access(cvPath);
            } catch {
                return res.status(404).json({ basarili: false, mesaj: 'CV dosyası bulunamadı.' });
            }

            return res.download(cvPath, `cv_${basvuruId}.pdf`);
        }
    } catch (err) {
        logger.error('CV indirme hatası:', { error: err.message });
        next(err);
    }
});

module.exports = router;
