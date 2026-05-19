const express       = require('express');
const router        = express.Router();
const User          = require('../models/User');
const authMiddleware = require('../middleware/auth');
const validator     = require('../utils/validator');

// Ensure `beceriler` array contains objects with `ad` field; sanitize entries
function sanitizeBeceriler(input) {
    if (!Array.isArray(input)) return [];
    return input
        .filter(b => b && typeof b === 'object' && (b.ad || b.name))
        .map(b => ({
            ad:    validator.sanitizeString(b.ad || b.name || ''),
            seviye: validator.sanitizeString(b.seviye || b.level || '')
        }))
        .filter(x => x.ad);
}

// Build a consistent profile/user DTO used across endpoints
function buildProfileObject(kullanici) {
    if (!kullanici) return {};
    return {
        id:               kullanici._id,
        email:            kullanici.email,
        rol:              kullanici.rol,
        isim:             kullanici.isim,
        soyisim:          kullanici.soyisim,
        unvan:            kullanici.unvan,
        konum:            kullanici.konum,
        hakkimda:         kullanici.hakkimda,
        telefon:          kullanici.telefon,
        sirketAdi:        kullanici.sirketAdi,
        adres:            kullanici.adres,
        slogan:           kullanici.slogan,
        calisanSayisi:    kullanici.calisanSayisi,
        isTurleri:        kullanici.isTurleri  || [],
        bolumler:         kullanici.bolumler   || [],
        egitim:           kullanici.egitim     || [],
        deneyim:          kullanici.deneyim    || [],
        beceriler:        kullanici.beceriler  || [],
        diller:           kullanici.diller     || [],
        sosyalMedya:      kullanici.sosyalMedya || {},
        profilTamamlandi: kullanici.profilTamamlandi
    };
}

// ── POST /api/profil/tamamla ──────────────────────────
router.post('/tamamla', authMiddleware, async (req, res, next) => {
    try {
        const veri = req.body;

        const adCheck = validator.validateName(veri.ad, 'Ad');
        if (!adCheck.valid) return res.status(400).json({ basarili: false, mesaj: adCheck.error });

        const soyadCheck = validator.validateName(veri.soyad, 'Soyadı');
        if (!soyadCheck.valid) return res.status(400).json({ basarili: false, mesaj: soyadCheck.error });

        const telefonCheck = validator.validatePhone(veri.iletisim?.telefon, false);
        if (!telefonCheck.valid) return res.status(400).json({ basarili: false, mesaj: telefonCheck.error });

        const sirketAdi     = validator.sanitizeString(veri.sirketAdi || veri.ad);
        const calisanSayisi = validator.sanitizeString(veri.calisanSayisi);

        // Use partial $set update and enable validators to ensure schema rules are applied
        const setPayload = {
            profilTamamlandi: true,
            isim:     sirketAdi || validator.sanitizeString(veri.ad),
            soyisim:  validator.sanitizeString(veri.soyad),
            rol:      veri.tip === 'ogrenci' ? 'ogrenci' : (req.kullanici.rol === 'isveren' ? 'isveren' : 'mezun'),
            unvan:    validator.sanitizeString(veri.unvan),
            konum:    validator.sanitizeString(veri.konum),
            hakkimda: validator.sanitizeLongText(veri.hakkimda),
            telefon:  veri.iletisim?.telefon ? String(veri.iletisim.telefon).substring(0, 20) : '',
            sirketAdi,
            adres:    validator.sanitizeString(veri.adres),
            slogan:   validator.sanitizeString(veri.slogan),
            calisanSayisi,
            isTurleri: Array.isArray(veri.isTurleri)
                ? veri.isTurleri.map(x => validator.sanitizeString(x)).filter(Boolean)
                : [],
            bolumler: Array.isArray(veri.bolumler)
                ? veri.bolumler.map(x => validator.sanitizeString(x)).filter(Boolean)
                : [],
            sosyalMedya: {
                linkedin: validator.sanitizeString(veri.iletisim?.linkedin) || '',
                github:   validator.sanitizeString(veri.iletisim?.github)   || '',
                web:      validator.sanitizeString(veri.iletisim?.web)      || ''
            },
            egitim:   veri.egitim        || [],
            deneyim:  veri.deneyim       || [],
            beceriler: sanitizeBeceriler(veri.beceriler),
            diller:   veri.diller        || []
        };

        const kullanici = await User.findByIdAndUpdate(req.kullanici._id, { $set: setPayload }, { new: true, runValidators: true });

        res.json({
            basarili: true,
            mesaj: 'Profil başarıyla kaydedildi.',
            kullanici: buildProfileObject(kullanici)
        });
    } catch (err) { next(err); }
});

// ── PUT /api/profil/guncelle ──────────────────────────
router.put('/guncelle', authMiddleware, async (req, res, next) => {
    try {
        const veri      = req.body;
        const guncelleme = {};

        if (veri.isim !== undefined) {
            const check = validator.validateName(veri.isim, 'Ad');
            if (!check.valid) return res.status(400).json({ basarili: false, mesaj: check.error });
            guncelleme.isim = validator.sanitizeString(veri.isim);
        }
        if (veri.soyisim !== undefined) {
            const check = validator.validateName(veri.soyisim, 'Soyadı');
            if (!check.valid) return res.status(400).json({ basarili: false, mesaj: check.error });
            guncelleme.soyisim = validator.sanitizeString(veri.soyisim);
        }
        if (veri.telefon !== undefined) {
            const check = validator.validatePhone(veri.telefon, false);
            if (!check.valid) return res.status(400).json({ basarili: false, mesaj: check.error });
            guncelleme.telefon = veri.telefon ? String(veri.telefon).substring(0, 20) : '';
        }

        if (veri.unvan        !== undefined) guncelleme.unvan        = validator.sanitizeString(veri.unvan);
        if (veri.konum        !== undefined) guncelleme.konum        = validator.sanitizeString(veri.konum);
        if (veri.hakkimda     !== undefined) guncelleme.hakkimda     = validator.sanitizeLongText(veri.hakkimda);
        if (veri.sirketAdi    !== undefined) guncelleme.sirketAdi    = validator.sanitizeString(veri.sirketAdi);
        if (veri.adres        !== undefined) guncelleme.adres        = validator.sanitizeString(veri.adres);
        if (veri.slogan       !== undefined) guncelleme.slogan       = validator.sanitizeString(veri.slogan);
        if (veri.calisanSayisi !== undefined) guncelleme.calisanSayisi = validator.sanitizeString(veri.calisanSayisi);

        if (veri.isTurleri !== undefined) {
            guncelleme.isTurleri = Array.isArray(veri.isTurleri)
                ? veri.isTurleri.map(x => validator.sanitizeString(x)).filter(Boolean)
                : [];
        }
        if (veri.bolumler !== undefined) {
            guncelleme.bolumler = Array.isArray(veri.bolumler)
                ? veri.bolumler.map(x => validator.sanitizeString(x)).filter(Boolean)
                : [];
        }

        if (veri.sosyalMedya !== undefined) guncelleme.sosyalMedya = veri.sosyalMedya;
        if (veri.egitim      !== undefined) guncelleme.egitim      = veri.egitim;
        if (veri.deneyim     !== undefined) guncelleme.deneyim     = veri.deneyim;
        if (veri.beceriler   !== undefined) guncelleme.beceriler   = sanitizeBeceriler(veri.beceriler);
        if (veri.diller      !== undefined) guncelleme.diller      = veri.diller;
        if (veri.tip         !== undefined) {
            guncelleme.rol = veri.tip === 'ogrenci' ? 'ogrenci' : 'mezun';
        }

        // Use $set to perform a partial update and enable validators
        const kullanici = await User.findByIdAndUpdate(
            req.kullanici._id, { $set: guncelleme }, { new: true, runValidators: true }
        );

        res.json({
            basarili: true,
            mesaj: 'Profil güncellendi.',
            kullanici: buildProfileObject(kullanici),
            profil: buildProfileObject(kullanici)
        });
    } catch (err) { next(err); }
});

// ── GET /api/profil/ben ───────────────────────────────
router.get('/ben', authMiddleware, async (req, res, next) => {
    try {
        const kullanici = await User.findById(req.kullanici._id).select('-password');
        if (!kullanici) {
            return res.status(404).json({ basarili: false, mesaj: 'Kullanıcı bulunamadı.' });
        }
        res.json({ basarili: true, profil: buildProfileObject(kullanici) });
    } catch (err) { next(err); }
});

module.exports = router;
