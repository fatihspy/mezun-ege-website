const express        = require('express');
const router         = express.Router();
const User           = require('../models/User');
const authMiddleware = require('../middleware/auth');

function regexEscape(str) {
    return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── GET /api/mezunlar ─────────────────────────────────
router.get('/', authMiddleware, async (req, res, next) => {
    try {
        const { arama, tip } = req.query;

        // pagination
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        let limit = Math.max(1, parseInt(req.query.limit || '20', 10));
        const MAX_LIMIT = 100;
        if (limit > MAX_LIMIT) limit = MAX_LIMIT;

        const filtre = {
            rol: { $in: ['mezun', 'ogrenci'] },
            profilTamamlandi: true,
            _id: { $ne: req.kullanici._id }
        };

        if (tip && (tip === 'mezun' || tip === 'ogrenci')) {
            filtre.rol = tip;
        }

        if (arama) {
            const aramaGuvenli = regexEscape(arama.substring(0, 100));
            filtre.$or = [
                { isim:              { $regex: aramaGuvenli, $options: 'i' } },
                { soyisim:           { $regex: aramaGuvenli, $options: 'i' } },
                { unvan:             { $regex: aramaGuvenli, $options: 'i' } },
                { 'beceriler.ad':    { $regex: aramaGuvenli, $options: 'i' } }
            ];
        }

        const skip = (page - 1) * limit;

        // total count for pagination UI
        const toplam = await User.countDocuments(filtre);

        const mezunlar = await User.find(filtre)
            .select('isim soyisim rol unvan konum hakkimda beceriler diller egitim sosyalMedya telefon olusturmaTarihi')
            .sort({ olusturmaTarihi: -1 })
            .skip(skip)
            .limit(limit);

        res.json({ basarili: true, mezunlar, toplam, page, limit });
    } catch (err) { next(err); }
});

module.exports = router;
