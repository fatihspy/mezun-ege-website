const express = require('express');
const router = express.Router();
const Basvuru = require('../models/Basvuru');
const jwt = require('jsonwebtoken');

// GET /api/dosya/cv/:basvuruId?type=basvuru&token=... — CV'yi indir
router.get('/cv/:basvuruId', async (req, res, next) => {
    try {
        const basvuruId = req.params.basvuruId;
        const { type, token } = req.query;

        // Token doğrula
        let kullanici = null;
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const User = require('../models/User');
                kullanici = await User.findById(decoded.id).select('-password');
            } catch (err) {
                console.error('Token doğrulama hatası:', err.message);
                return res.status(401).json({ basarili: false, mesaj: 'Geçersiz token.' });
            }
        }

        if (!kullanici) {
            return res.status(401).json({ basarili: false, mesaj: 'Oturum bulunamadı. Lütfen giriş yapın.' });
        }

        if (type === 'basvuru') {
            // Başvuru tarafından CV'yi indir
            const basvuru = await Basvuru.findById(basvuruId).populate('isveren', '_id');
            if (!basvuru || !basvuru.cvBase64) {
                return res.status(404).json({ basarili: false, mesaj: 'CV bulunamadı.' });
            }

            console.log('Basvuru isveren:', basvuru.isveren._id, 'Kullanici:', kullanici._id);

            // İşveren kontrolü - sadece ilgili işveren CV indirebilir
            const isverenMatch = basvuru.isveren._id.toString() === kullanici._id.toString();
            const isAdmin = kullanici.rol && kullanici.rol.includes('admin');
            
            if (!isverenMatch && !isAdmin) {
                return res.status(403).json({ basarili: false, mesaj: 'Yetkiniz yok.' });
            }

            // Base64'ten buffer'a çevir
            const base64Data = basvuru.cvBase64.split(',')[1] || basvuru.cvBase64;
            const binaryData = Buffer.from(base64Data, 'base64');

            // Headers ayarla
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="cv_${basvuruId}.pdf"`);
            res.send(binaryData);
        }
    } catch (err) {
        console.error('CV indirme hatası:', err);
        next(err);
    }
});

module.exports = router;
