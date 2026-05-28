const express  = require('express');
const jwt       = require('jsonwebtoken');
const bcrypt    = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const User      = require('../models/User');
const authMiddleware = require('../middleware/auth');
const validator = require('../utils/validator');
const { emailVerificationCodeGonder, passwordResetCodeGonder } = require('../utils/mailer');
const logger    = require('../utils/logger');

const router = express.Router();

// Helper: set auth cookie (httpOnly) alongside returning token in body
function setAuthCookie(res, token) {
    try {
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        };
        res.cookie('token', token, cookieOptions);
    } catch (e) { logger.warn('setAuthCookie failed', { error: e.message }); }
}

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

        // Email doğrulama kodunu arka planda gönder (kullanıcıyı beklettirme)
        const emailSent = true;
        emailVerificationCodeGonder(emailTemiz, verificationCode).catch(emailErr => {
            logger.error(`Kayıt email gönderilemedi: ${emailErr?.message || emailErr?.toString() || JSON.stringify(emailErr)}`);
        });

        // Token oluştur (limited süreli, email doğrulama gerekli)
        const token = tokenOlustur(yeniKullanici._id);

        // Kayıt sonrası yönlendirme
        let yonlendirme;
        if (rol === 'isveren') {
            yonlendirme = '/profil_doldurma_isveren/profil_doldurma_isveren.html';
        } else if (rol === 'mezun') {
            yonlendirme = '/profil_doldurma/profil_doldurma.html';
        }

        // set cookie for browser-based auth (non-breaking: token still returned in body)
        try { setAuthCookie(res, token); } catch (e) {}

        res.json({
            basarili: true,
            mesaj: 'Kayıt başarılı! Lütfen profilinizi tamamlayın.',
            yonlendirme,
            token,
            emailVerificationRequired: true,
            emailSent,
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

        // Email doğrulanmış mı?
        if (!kullanici.emailVerified) {
            const token = tokenOlustur(kullanici._id);
            return res.status(403).json({
                basarili: false,
                mesaj: 'E-posta adresiniz henüz doğrulanmamış. Lütfen gelen kutunuzu kontrol edin.',
                emailVerificationRequired: true,
                token
            });
        }

        // Son giriş zamanını güncelle
        kullanici.sonGiris = new Date();
        await kullanici.save();

        // Token oluştur
        const token = tokenOlustur(kullanici._id);

        // set cookie for browser-based auth (non-breaking)
        try { setAuthCookie(res, token); } catch (e) {}

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
        let emailSent = true;
        try {
            const { sifreBelirlemeKoduGonder } = require('../utils/mailer');
            sifreBelirlemeKoduGonder(emailTemiz, kod).catch(e => logger.error(`Mail gönderilemedi: ${e?.message || e?.toString() || 'Bilinmeyen hata'}`));
            logger.info('Şifre belirleme kodu gönderildi:', { email: emailTemiz });
        } catch (e) {
            emailSent = false;
            logger.error('Şifre belirleme kodu gönderilemedi:', { email: emailTemiz, error: e.message });
            logger.info('Şifre belirleme kodu (fallback):', { email: emailTemiz, kod });
        }

        res.json({
            basarili: true,
            mesaj: 'Şifre belirleme kodu oluşturuldu. E-postanızı kontrol edin.',
            email: emailTemiz,
            emailSent
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

        try { setAuthCookie(res, tempToken); } catch (e) {}
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
        let emailSent = true;
        try {
            emailVerificationCodeGonder(kullanici.email, verificationCode).catch(e => logger.error(`Mail gönderilemedi: ${e?.message || e?.toString() || 'Bilinmeyen hata'}`));
        } catch (emailErr) {
            emailSent = false;
            logger.error('Doğrulama kodu yeniden gönderilemedi:', { email: kullanici.email, error: emailErr.message });
            logger.info('Email doğrulama kodu (fallback):', { email: kullanici.email, verificationCode });
        }

        res.json({
            basarili: true,
            mesaj: 'Yeni doğrulama kodu oluşturuldu.',
            emailSent
        });
    } catch (err) { next(err); }
});

// POST /api/auth/forgot-password — Şifre sıfırla (kod gönder)
router.post('/forgot-password', girisLimiter, async (req, res, next) => {
    try {
        const { email } = req.body;
        logger.info('Şifre sıfırlama talebi:', { email });

        const emailCheck = validator.validateEmail(email);
        if (!emailCheck.valid) {
            return res.status(400).json({ basarili: false, mesaj: emailCheck.error });
        }

        const emailTemiz = email.toLowerCase().trim();
        const kullanici = await User.findOne({ email: emailTemiz });
        
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

        kullanici.passwordResetCode = resetCode;
        kullanici.passwordResetCodeExpiry = resetExpiry;
        await kullanici.save();

        // Email gönder
        let emailSent = true;
        try {
            passwordResetCodeGonder(emailTemiz, resetCode).catch(e => logger.error(`Mail gönderilemedi: ${e?.message || e?.toString() || 'Bilinmeyen hata'}`));
            logger.info('Şifre sıfırlama kodu gönderildi:', { email: emailTemiz });
        } catch (emailErr) {
            emailSent = false;
            logger.error('Şifre sıfırlama emaili gönderilemedi:', { email: emailTemiz, error: emailErr.message });
            logger.info('Şifre sıfırlama kodu (fallback):', { email: emailTemiz, resetCode });
        }

        res.json({
            basarili: true,
            mesaj: 'Şifre sıfırlama kodu oluşturuldu. Email adresinizi kontrol edin.',
            emailSent
        });
    } catch (err) { 
        logger.error('forgot-password hatası:', { error: err.message });
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
    try { res.clearCookie('token'); } catch (e) { /* ignore */ }
    res.json({ basarili: true, mesaj: 'Çıkış başarılı.' });
});

module.exports = router;
