const express  = require('express');
const jwt       = require('jsonwebtoken');
const bcrypt    = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const User      = require('../models/User');
const authMiddleware = require('../middleware/auth');
const validator = require('../utils/validator');
const { emailVerificationCodeGonder, passwordResetCodeGonder } = require('../utils/mailer');

const router = express.Router();

const tokenOlustur = (id) => jwt.sign(
    { id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
);

const OKUL_DOMAIN = process.env.OKUL_MAIL_DOMAIN || 'ogrenci.ege.edu.tr';

// ═══ HELPER FUNCTIONS ═══
const generateVerificationCode = () => Math.floor(100000 + Math.random() * 900000).toString();

// Rate limiter - Giriş/Kayıt denemeleri
const girisLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 10,
    message: { basarili: false, mesaj: 'Çok fazla başarısız deneme. 15 dakika sonra tekrar deneyin.' }
});

// ========== YENİ ŞİFRE SİSTEMİ ==========

// POST /api/auth/kayit — Yeni kullanıcı kaydı (email + şifre)
router.post('/kayit', girisLimiter, async (req, res, next) => {
    try {
        const { email, sifre, istenenRol } = req.body;
        
        // Email validasyonu
        const emailCheck = validator.validateEmail(email);
        if (!emailCheck.valid) return res.status(400).json({ basarili: false, mesaj: emailCheck.error });

        // Şifre validasyonu
        const sifreCheck = validator.validatePassword(sifre);
        if (!sifreCheck.valid) return res.status(400).json({ basarili: false, mesaj: sifreCheck.error });

        const emailTemiz = email.toLowerCase().trim();
        const okulMailiMi = emailTemiz.endsWith('@' + OKUL_DOMAIN);

        // Rol belirleme
        let rol;
        if (istenenRol === 'isveren') {
            rol = 'isveren';
        } else if (okulMailiMi) {
            rol = 'mezun';
        } else {
            return res.status(403).json({
                basarili: false,
                mesaj: `Mezun/öğrenci kaydı için @${OKUL_DOMAIN} uzantılı okul mailinizi kullanmalısınız.`
            });
        }

        // Email zaten mevcut mu?
        const mevcutKullanici = await User.findOne({ email: emailTemiz });
        if (mevcutKullanici) {
            return res.status(409).json({ basarili: false, mesaj: 'Bu e-posta adı zaten kayıtlı.' });
        }

        // Şifreyi bcrypt ile hashle
        const tuz = await bcrypt.genSalt(10);
        const sifreHash = await bcrypt.hash(sifre, tuz);

        // Email doğrulama kodu oluştur
        const verificationCode = generateVerificationCode();
        const verificationExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 dakika

        // Yeni kullanıcı oluştur
        const yeniKullanici = await User.create({
            email: emailTemiz,
            password: sifreHash,
            rol: rol,
            profilTamamlandi: false,
            emailVerified: false,
            emailVerificationCode: verificationCode,
            emailVerificationCodeExpiry: verificationExpiry,
            sonGiris: new Date()
        });

        // Email doğrulama kodu gönder
        try {
            await emailVerificationCodeGonder(emailTemiz, verificationCode);
        } catch (emailErr) {
            console.error('Email gönderme hatası:', emailErr);
            // Email hatası olsa bile devam et - kullanıcı yeniden gönder düğmesini kullanabilir
        }

        // Token oluştur (limited süreli, email doğrulama gerekli)
        const token = tokenOlustur(yeniKullanici._id);

        // Kayıt sonrası yönlendirme
        let yonlendirme;
        if (rol === 'isveren') {
            yonlendirme = '/profil_doldurma_isveren/profil_doldurma_isveren.html';
        } else if (rol === 'mezun') {
            yonlendirme = '/profil_doldurma/profil_doldurma.html';
        }

        res.json({
            basarili: true,
            mesaj: 'Kayıt başarılı! Lütfen profilinizi tamamlayın.',
            yonlendirme,
            token,
            emailVerificationRequired: true,
            kullanici: {
                id: yeniKullanici._id,
                email: yeniKullanici.email,
                rol: yeniKullanici.rol,
                profilTamamlandi: yeniKullanici.profilTamamlandi,
                emailVerified: yeniKullanici.emailVerified
            }
        });
    } catch (err) { next(err); }
});

// POST /api/auth/giris — Kullanıcı girişi (email + şifre)
router.post('/giris', girisLimiter, async (req, res, next) => {
    try {
        const { email, sifre } = req.body;

        // Email validasyonu
        const emailCheck = validator.validateEmail(email);
        if (!emailCheck.valid) return res.status(400).json({ basarili: false, mesaj: emailCheck.error });

        if (!sifre) return res.status(400).json({ basarili: false, mesaj: 'Şifre zorunludur.' });

        const emailTemiz = email.toLowerCase().trim();

        // Kullanıcı var mı?
        const kullanici = await User.findOne({ email: emailTemiz });
        if (!kullanici) {
            return res.status(401).json({ basarili: false, mesaj: 'E-posta veya şifre hatalı.' });
        }

        // Şifre doğru mu?
        const sifreGecerli = await bcrypt.compare(sifre, kullanici.password);
        if (!sifreGecerli) {
            return res.status(401).json({ basarili: false, mesaj: 'E-posta veya şifre hatalı.' });
        }

        // Son giriş zamanını güncelle
        kullanici.sonGiris = new Date();
        await kullanici.save();

        // Token oluştur
        const token = tokenOlustur(kullanici._id);

        res.json({
            basarili: true,
            mesaj: 'Giriş başarılı!',
            token,
            kullanici: {
                id: kullanici._id,
                email: kullanici.email,
                rol: kullanici.rol,
                isim: kullanici.isim,
                soyisim: kullanici.soyisim,
                profilTamamlandi: kullanici.profilTamamlandi
            }
        });
    } catch (err) { next(err); }
});

// POST /api/auth/sifre-kodu-gonder — Eski kullanıcılar için şifre belirleme kodu
router.post('/sifre-kodu-gonder', girisLimiter, async (req, res, next) => {
    try {
        const { email } = req.body;

        // Email validasyonu
        const emailCheck = validator.validateEmail(email);
        if (!emailCheck.valid) return res.status(400).json({ basarili: false, mesaj: emailCheck.error });

        const emailTemiz = email.toLowerCase().trim();

        // Kullanıcı var mı?
        const kullanici = await User.findOne({ email: emailTemiz });
        if (!kullanici) {
            return res.status(404).json({ basarili: false, mesaj: 'Bu e-posta adresi kayıtlı değil.' });
        }

        // Kod oluştur ve kaydet
        const kod = Math.floor(100000 + Math.random() * 900000).toString();
        kullanici.sifreBelirlemeKodu = kod;
        kullanici.sifreBelirlemeKoduSonAmi = new Date(Date.now() + 15 * 60 * 1000); // 15 dakika
        await kullanici.save();

        // Email gönder (console'a da log et)
        try {
            const { sifreBelirlemeKoduGonder } = require('../utils/mailer');
            await sifreBelirlemeKoduGonder(emailTemiz, kod);
        } catch (e) {
            console.error('Mail gönderilemedi:', e.message);
            console.log('\n🔐 ŞİFRE BELİRLEME KODU [' + emailTemiz + ']: ' + kod + '\n');
        }

        res.json({
            basarili: true,
            mesaj: 'Şifre belirleme kodu gönderildi. E-postanızı kontrol edin.',
            email: emailTemiz
        });
    } catch (err) { next(err); }
});

// POST /api/auth/sifre-kodu-dogrula — Şifre belirleme kodunu doğrula
router.post('/sifre-kodu-dogrula', girisLimiter, async (req, res, next) => {
    try {
        const { email, kod } = req.body;

        // Validasyon
        const emailCheck = validator.validateEmail(email);
        if (!emailCheck.valid) return res.status(400).json({ basarili: false, mesaj: emailCheck.error });
        if (!kod) return res.status(400).json({ basarili: false, mesaj: 'Kod zorunludur.' });

        const emailTemiz = email.toLowerCase().trim();
        const kullanici = await User.findOne({ email: emailTemiz });

        if (!kullanici) {
            return res.status(404).json({ basarili: false, mesaj: 'Kullanıcı bulunamadı.' });
        }

        // Kod doğrulaması
        if (kullanici.sifreBelirlemeKodu !== kod) {
            return res.status(401).json({ basarili: false, mesaj: 'Kod hatalı.' });
        }

        if (!kullanici.sifreBelirlemeKoduSonAmi || kullanici.sifreBelirlemeKoduSonAmi < new Date()) {
            return res.status(401).json({ basarili: false, mesaj: 'Kodun süresi dolmuş. Yeni kod isteyin.' });
        }

        // Kod doğrulandı - Şifre belirleme için temporary token oluştur
        const tempToken = tokenOlustur(kullanici._id);

        res.json({
            basarili: true,
            mesaj: 'Kod doğrulandı. Şifrenizi belirleyebilirsiniz.',
            token: tempToken,
            email: emailTemiz
        });
    } catch (err) { next(err); }
});

// POST /api/auth/sifre-belirle — Eski kullanıcılar için şifre belirleme (Migration)
router.post('/sifre-belirle', authMiddleware, async (req, res, next) => {
    try {
        const { yeniSifre } = req.body;

        // Şifre validasyonu
        const sifreCheck = validator.validatePassword(yeniSifre);
        if (!sifreCheck.valid) return res.status(400).json({ basarili: false, mesaj: sifreCheck.error });

        // Kullanıcıyı bul
        const kullanici = await User.findById(req.kullanici._id);
        if (!kullanici) {
            return res.status(404).json({ basarili: false, mesaj: 'Kullanıcı bulunamadı.' });
        }

        // Yeni şifreyi hashle ve kaydet
        const tuz = await bcrypt.genSalt(10);
        const sifreHash = await bcrypt.hash(yeniSifre, tuz);
        
        kullanici.password = sifreHash;
        // Legacy alanları temizle
        kullanici.dogrulamaKodu = undefined;
        kullanici.dogrulamaKoduSonAmi = undefined;
        
        await kullanici.save();

        res.json({
            basarili: true,
            mesaj: 'Şifre başarıyla belirlendi. Artık şifrenizle giriş yapabilirsiniz.'
        });
    } catch (err) { next(err); }
});

// GET /api/auth/ben
router.get('/ben', authMiddleware, (req, res) => {
    res.json({
        basarili: true,
        kullanici: {
            id: req.kullanici._id, email: req.kullanici.email,
            rol: req.kullanici.rol, isim: req.kullanici.isim,
            soyisim: req.kullanici.soyisim, profilTamamlandi: req.kullanici.profilTamamlandi
        }
    });
});

// POST /api/auth/profil-tamamla
router.post('/profil-tamamla', authMiddleware, async (req, res, next) => {
    try {
        const veri = req.body;
        
        // Validation
        const adCheck = validator.validateName(veri.ad, 'Ad');
        if (!adCheck.valid) return res.status(400).json({ basarili: false, mesaj: adCheck.error });
        
        const soyadCheck = validator.validateName(veri.soyad, 'Soyadı');
        if (!soyadCheck.valid) return res.status(400).json({ basarili: false, mesaj: soyadCheck.error });
        
        const telefonCheck = validator.validatePhone(veri.iletisim?.telefon, false);
        if (!telefonCheck.valid) return res.status(400).json({ basarili: false, mesaj: telefonCheck.error });
        
        const sirketAdi = validator.sanitizeString(veri.sirketAdi || veri.ad);
        const calisanSayisi = validator.sanitizeString(veri.calisanSayisi);

        const kullanici = await User.findByIdAndUpdate(req.kullanici._id, {
            profilTamamlandi: true,
            isim: sirketAdi || validator.sanitizeString(veri.ad),
            soyisim: validator.sanitizeString(veri.soyad),
            rol: veri.tip === 'ogrenci' ? 'ogrenci' : (req.kullanici.rol === 'isveren' ? 'isveren' : 'mezun'),
            unvan: validator.sanitizeString(veri.unvan), 
            konum: validator.sanitizeString(veri.konum), 
            hakkimda: validator.sanitizeString(veri.hakkimda),
            telefon: veri.iletisim?.telefon ? String(veri.iletisim.telefon).substring(0, 20) : '',
            sirketAdi,
            adres: validator.sanitizeString(veri.adres),
            slogan: validator.sanitizeString(veri.slogan),
            calisanSayisi,
            isTurleri: Array.isArray(veri.isTurleri) ? veri.isTurleri.map(x => validator.sanitizeString(x)).filter(Boolean) : [],
            bolumler: Array.isArray(veri.bolumler) ? veri.bolumler.map(x => validator.sanitizeString(x)).filter(Boolean) : [],
            sosyalMedya: { 
                linkedin: validator.sanitizeString(veri.iletisim?.linkedin) || '', 
                github: validator.sanitizeString(veri.iletisim?.github) || '', 
                web: validator.sanitizeString(veri.iletisim?.web) || '' 
            },
            egitim: veri.egitim || [], 
            deneyim: veri.deneyim || [],
            beceriler: veri.becerilerDetay || [], 
            diller: veri.diller || []
        }, { new: true, runValidators: false });
        res.json({ 
            basarili: true, 
            mesaj: 'Profil başarıyla kaydedildi.',
            kullanici: {
                id: kullanici._id, 
                email: kullanici.email, 
                rol: kullanici.rol,
                isim: kullanici.isim, 
                sirketAdi: kullanici.sirketAdi,
                soyisim: kullanici.soyisim, 
                profilTamamlandi: kullanici.profilTamamlandi
            }
        });
    } catch (err) { next(err); }
});

// PUT /api/auth/profil-guncelle — Profil sayfasından güncelleme
router.put('/profil-guncelle', authMiddleware, async (req, res, next) => {
    try {
        const veri = req.body;
        const guncelleme = {};
        
        // Validation ile sanitize
        if (veri.isim !== undefined) {
            const check = validator.validateName(veri.isim, 'Ad');
            if (!check.valid) return res.status(400).json({ basarili: false, mesaj: check.error });
            guncelleme.isim = validator.sanitizeString(veri.isim);
        }
        if (veri.soyisim  !== undefined) {
            const check = validator.validateName(veri.soyisim, 'Soyadı');
            if (!check.valid) return res.status(400).json({ basarili: false, mesaj: check.error });
            guncelleme.soyisim = validator.sanitizeString(veri.soyisim);
        }
        if (veri.telefon  !== undefined) {
            const check = validator.validatePhone(veri.telefon, false);
            if (!check.valid) return res.status(400).json({ basarili: false, mesaj: check.error });
            guncelleme.telefon = veri.telefon ? String(veri.telefon).substring(0, 20) : '';
        }
        if (veri.unvan    !== undefined) guncelleme.unvan    = validator.sanitizeString(veri.unvan);
        if (veri.konum    !== undefined) guncelleme.konum    = validator.sanitizeString(veri.konum);
        if (veri.hakkimda !== undefined) guncelleme.hakkimda = validator.sanitizeString(veri.hakkimda);
        if (veri.sirketAdi !== undefined) guncelleme.sirketAdi = validator.sanitizeString(veri.sirketAdi);
        if (veri.adres !== undefined) guncelleme.adres = validator.sanitizeString(veri.adres);
        if (veri.slogan !== undefined) guncelleme.slogan = validator.sanitizeString(veri.slogan);
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
        if (veri.egitim   !== undefined) guncelleme.egitim   = veri.egitim;
        if (veri.deneyim  !== undefined) guncelleme.deneyim  = veri.deneyim;
        if (veri.beceriler!== undefined) guncelleme.beceriler= veri.beceriler;
        if (veri.diller   !== undefined) guncelleme.diller   = veri.diller;
        if (veri.tip      !== undefined) {
            guncelleme.rol = veri.tip === 'ogrenci' ? 'ogrenci' : 'mezun';
        }

        const kullanici = await User.findByIdAndUpdate(
            req.kullanici._id, guncelleme, { new: true, runValidators: false }
        );
        res.json({ basarili: true, mesaj: 'Profil güncellendi.', kullanici: {
            id: kullanici._id, email: kullanici.email, rol: kullanici.rol,
            isim: kullanici.isim,
            soyisim: kullanici.soyisim,
            sirketAdi: kullanici.sirketAdi,
            calisanSayisi: kullanici.calisanSayisi,
            profilTamamlandi: kullanici.profilTamamlandi
        }});
    } catch (err) { next(err); }
});

// Regex injection önlemi: özel karakterleri escape et
function regexEscape(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET /api/auth/mezunlar — Mezun dizini
router.get('/mezunlar', authMiddleware, async (req, res, next) => {
    try {
        const { arama, bolum, tip } = req.query;
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
                { isim:    { $regex: aramaGuvenli, $options: 'i' } },
                { soyisim: { $regex: aramaGuvenli, $options: 'i' } },
                { unvan:   { $regex: aramaGuvenli, $options: 'i' } },
                { 'beceriler.ad': { $regex: aramaGuvenli, $options: 'i' } }
            ];
        }

        const mezunlar = await User.find(filtre)
            .select('isim soyisim rol unvan konum hakkimda beceriler diller egitim sosyalMedya telefon olusturmaTarihi')
            .sort({ olusturmaTarihi: -1 })
            .limit(100);

        res.json({ basarili: true, mezunlar });
    } catch (err) { next(err); }
});

// GET /api/auth/profil — Kullanıcı profil bilgilerini getir
router.get('/profil', authMiddleware, async (req, res, next) => {
    try {
        const kullanici = await User.findById(req.user.id).select('-password');
        if (!kullanici) {
            return res.status(404).json({ basarili: false, mesaj: 'Kullanıcı bulunamadı.' });
        }
        res.json({
            basarili: true,
            profil: {
                id: kullanici._id,
                email: kullanici.email,
                rol: kullanici.rol,
                isim: kullanici.isim,
                soyisim: kullanici.soyisim,
                unvan: kullanici.unvan,
                konum: kullanici.konum,
                hakkimda: kullanici.hakkimda,
                telefon: kullanici.telefon,
                sirketAdi: kullanici.sirketAdi,
                adres: kullanici.adres,
                slogan: kullanici.slogan,
                calisanSayisi: kullanici.calisanSayisi,
                isTurleri: kullanici.isTurleri || [],
                bolumler: kullanici.bolumler || [],
                egitim: kullanici.egitim || [],
                deneyim: kullanici.deneyim || [],
                beceriler: kullanici.beceriler || [],
                diller: kullanici.diller || [],
                sosyalMedya: kullanici.sosyalMedya || {},
                profilTamamlandi: kullanici.profilTamamlandi
            }
        });
    } catch (err) { next(err); }
});

// PUT /api/auth/profil — Kullanıcı profil bilgilerini güncelle
router.put('/profil', authMiddleware, async (req, res, next) => {
    try {
        const { isim, soyisim, unvan, konum, hakkimda, telefon, sirketAdi, adres, slogan, calisanSayisi, isTurleri, bolumler, egitim, deneyim, beceriler, diller, sosyalMedya, profilTamamlandi } = req.body;

        const kullanici = await User.findByIdAndUpdate(
            req.user.id,
            {
                isim: isim || undefined,
                soyisim: soyisim || undefined,
                unvan: unvan || undefined,
                konum: konum || undefined,
                hakkimda: hakkimda || undefined,
                telefon: telefon || undefined,
                sirketAdi: sirketAdi || undefined,
                adres: adres || undefined,
                slogan: slogan || undefined,
                calisanSayisi: calisanSayisi || undefined,
                isTurleri: isTurleri !== undefined ? isTurleri : undefined,
                bolumler: bolumler !== undefined ? bolumler : undefined,
                egitim: egitim !== undefined ? egitim : undefined,
                deneyim: deneyim !== undefined ? deneyim : undefined,
                beceriler: beceriler !== undefined ? beceriler : undefined,
                diller: diller !== undefined ? diller : undefined,
                sosyalMedya: sosyalMedya !== undefined ? sosyalMedya : undefined,
                profilTamamlandi: profilTamamlandi !== undefined ? profilTamamlandi : undefined
            },
            { new: true, runValidators: true }
        ).select('-password');

        res.json({
            basarili: true,
            mesaj: 'Profil güncellendi.',
            profil: {
                id: kullanici._id,
                email: kullanici.email,
                rol: kullanici.rol,
                isim: kullanici.isim,
                soyisim: kullanici.soyisim,
                unvan: kullanici.unvan,
                konum: kullanici.konum,
                hakkimda: kullanici.hakkimda,
                telefon: kullanici.telefon,
                sirketAdi: kullanici.sirketAdi,
                adres: kullanici.adres,
                slogan: kullanici.slogan,
                calisanSayisi: kullanici.calisanSayisi,
                isTurleri: kullanici.isTurleri || [],
                bolumler: kullanici.bolumler || [],
                egitim: kullanici.egitim || [],
                deneyim: kullanici.deneyim || [],
                beceriler: kullanici.beceriler || [],
                diller: kullanici.diller || [],
                sosyalMedya: kullanici.sosyalMedya || {},
                profilTamamlandi: kullanici.profilTamamlandi
            }
        });
    } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════
// EMAIL VERIFICATION & PASSWORD RESET ENDPOINTS
// ═══════════════════════════════════════════════════════

// POST /api/auth/verify-email — Email doğrulama kodunu kontrol et
router.post('/verify-email', authMiddleware, async (req, res, next) => {
    try {
        const { code } = req.body;
        if (!code || code.length !== 6) {
            return res.status(400).json({ basarili: false, mesaj: 'Geçersiz kod formatı.' });
        }

        const kullanici = await User.findById(req.kullanici._id);
        if (!kullanici) {
            return res.status(404).json({ basarili: false, mesaj: 'Kullanıcı bulunamadı.' });
        }

        // Zaten doğrulanmış mı?
        if (kullanici.emailVerified) {
            return res.json({ basarili: true, mesaj: 'Email zaten doğrulanmış.' });
        }

        // Kod uyuşuyor mu?
        if (kullanici.emailVerificationCode !== code) {
            return res.status(400).json({ basarili: false, mesaj: 'Hatalı doğrulama kodu.' });
        }

        // Kod süresi dolmuş mu?
        if (new Date() > kullanici.emailVerificationCodeExpiry) {
            return res.status(400).json({ basarili: false, mesaj: 'Doğrulama kodu süresi dolmuş. Yeni kod isteyin.' });
        }

        // Email doğrulandı
        kullanici.emailVerified = true;
        kullanici.emailVerificationCode = undefined;
        kullanici.emailVerificationCodeExpiry = undefined;
        await kullanici.save();

        res.json({
            basarili: true,
            mesaj: 'Email başarıyla doğrulandı! 🎉 Artık tüm özellikleri kullanabilirsiniz.',
            emailVerified: true
        });
    } catch (err) { next(err); }
});

// POST /api/auth/resend-verification-code — Yeni doğrulama kodu gönder
router.post('/resend-verification-code', authMiddleware, async (req, res, next) => {
    try {
        const kullanici = await User.findById(req.kullanici._id);
        if (!kullanici) {
            return res.status(404).json({ basarili: false, mesaj: 'Kullanıcı bulunamadı.' });
        }

        // Yeni kod oluştur
        const verificationCode = generateVerificationCode();
        const verificationExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 dakika

        kullanici.emailVerificationCode = verificationCode;
        kullanici.emailVerificationCodeExpiry = verificationExpiry;
        await kullanici.save();

        // Email gönder
        try {
            await emailVerificationCodeGonder(kullanici.email, verificationCode);
        } catch (emailErr) {
            console.error('Email gönderme hatası:', emailErr);
            console.log('\n📧 EMAIL DOĞRULAMA KODU [' + kullanici.email + ']: ' + verificationCode + '\n');
        }

        res.json({
            basarili: true,
            mesaj: 'Yeni doğrulama kodu gönderildi. Email adresinizi kontrol edin.'
        });
    } catch (err) { next(err); }
});

// POST /api/auth/forgot-password — Şifre sıfırla (kod gönder)
router.post('/forgot-password', girisLimiter, async (req, res, next) => {
    try {
        const { email } = req.body;
        console.log('🟢 /forgot-password çağrısı alındı. Email:', email);

        const emailCheck = validator.validateEmail(email);
        if (!emailCheck.valid) {
            return res.status(400).json({ basarili: false, mesaj: emailCheck.error });
        }

        const emailTemiz = email.toLowerCase().trim();
        const kullanici = await User.findOne({ email: emailTemiz });
        console.log('🟢 Kullanıcı bulundu mu?', !!kullanici);
        
        if (!kullanici) {
            // Güvenlik: var olmayan email için de başarılı dön
            return res.json({
                basarili: true,
                mesaj: 'Şifre sıfırlama kodu gönderildi (eğer bu emaile ait hesap varsa)'
            });
        }

        // Şifre sıfırla kodu oluştur
        const resetCode = generateVerificationCode();
        const resetExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 dakika
        console.log('🟢 Reset kodu oluşturuldu:', resetCode);

        kullanici.passwordResetCode = resetCode;
        kullanici.passwordResetCodeExpiry = resetExpiry;
        await kullanici.save();
        console.log('🟢 Kullanıcı kaydedildi');

        // Email gönder
        try {
            console.log('🟢 Mail gönderme başladı...');
            await passwordResetCodeGonder(emailTemiz, resetCode);
            console.log('🟢 Mail gönderme tamamlandı');
        } catch (emailErr) {
            console.error('❌ Email gönderme hatası:', emailErr.message);
            console.error('Detaylı hata:', emailErr);
            console.log('\n🔐 ŞİFRE SIFIRLA KODU [' + emailTemiz + ']: ' + resetCode + '\n');
        }

        res.json({
            basarili: true,
            mesaj: 'Şifre sıfırlama kodu gönderildi. Email adresinizi kontrol edin.'
        });
    } catch (err) { 
        console.error('🔴 forgot-password error:', err.message);
        next(err); 
    }
});

// POST /api/auth/reset-password — Yeni şifre belirle
router.post('/reset-password', async (req, res, next) => {
    try {
        const { email, code, newPassword } = req.body;

        const emailCheck = validator.validateEmail(email);
        if (!emailCheck.valid) {
            return res.status(400).json({ basarili: false, mesaj: emailCheck.error });
        }

        const sifreCheck = validator.validatePassword(newPassword);
        if (!sifreCheck.valid) {
            return res.status(400).json({ basarili: false, mesaj: sifreCheck.error });
        }

        if (!code || code.length !== 6) {
            return res.status(400).json({ basarili: false, mesaj: 'Geçersiz kod formatı.' });
        }

        const emailTemiz = email.toLowerCase().trim();
        const kullanici = await User.findOne({ email: emailTemiz });
        
        if (!kullanici) {
            return res.status(404).json({ basarili: false, mesaj: 'Bu emaile ait hesap bulunamadı.' });
        }

        // Kod uyuşuyor mu?
        if (kullanici.passwordResetCode !== code) {
            return res.status(400).json({ basarili: false, mesaj: 'Hatalı sıfırlama kodu.' });
        }

        // Kod süresi dolmuş mu?
        if (new Date() > kullanici.passwordResetCodeExpiry) {
            return res.status(400).json({ basarili: false, mesaj: 'Sıfırlama kodu süresi dolmuş. Yeni kod isteyin.' });
        }

        // Yeni şifre hash'le
        const tuz = await bcrypt.genSalt(10);
        const sifreHash = await bcrypt.hash(newPassword, tuz);

        kullanici.password = sifreHash;
        kullanici.passwordResetCode = undefined;
        kullanici.passwordResetCodeExpiry = undefined;
        await kullanici.save();

        res.json({
            basarili: true,
            mesaj: 'Şifreniz başarıyla değiştirildi. Lütfen yeni şifre ile giriş yapın.'
        });
    } catch (err) { next(err); }
});

// POST /api/auth/change-password — Şifre değişim (giriş yapılmış user)
router.post('/change-password', authMiddleware, async (req, res, next) => {
    try {
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({ basarili: false, mesaj: 'Eski ve yeni şifre gerekli.' });
        }

        const sifreCheck = validator.validatePassword(newPassword);
        if (!sifreCheck.valid) {
            return res.status(400).json({ basarili: false, mesaj: sifreCheck.error });
        }

        const kullanici = await User.findById(req.kullanici._id);
        if (!kullanici) {
            return res.status(404).json({ basarili: false, mesaj: 'Kullanıcı bulunamadı.' });
        }

        // Eski şifre doğru mu?
        const sifreDoruMu = await bcrypt.compare(oldPassword, kullanici.password);
        if (!sifreDoruMu) {
            return res.status(401).json({ basarili: false, mesaj: 'Eski şifre yanlış.' });
        }

        // Yeni şifre aynı mı?
        const ayniMi = await bcrypt.compare(newPassword, kullanici.password);
        if (ayniMi) {
            return res.status(400).json({ basarili: false, mesaj: 'Yeni şifre eski şifre ile aynı olamaz.' });
        }

        // Yeni şifre hash'le
        const tuz = await bcrypt.genSalt(10);
        const sifreHash = await bcrypt.hash(newPassword, tuz);

        kullanici.password = sifreHash;
        await kullanici.save();

        res.json({
            basarili: true,
            mesaj: 'Şifreniz başarıyla değiştirildi.'
        });
    } catch (err) { next(err); }
});

// POST /api/auth/cikis
router.post('/cikis', authMiddleware, (req, res) => {
    res.json({ basarili: true, mesaj: 'Çıkış başarılı.' });
});

module.exports = router;
