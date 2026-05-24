const logger = require('./logger');

// Resend API üzerinden mail gönder
async function sendMail({ to, subject, html }) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        logger.warn('RESEND_API_KEY tanımlı değil — mail gönderilmedi.');
        return;
    }

    const from = process.env.MAIL_FROM || 'Egemyo Mezun <onboarding@resend.dev>';

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ from, to, subject, html })
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Resend API hatası: ${res.status} — ${err}`);
    }

    const data = await res.json();
    logger.info('Mail gönderildi:', { to, id: data.id });
    return data;
}

function verifyMailer() {
    if (!process.env.RESEND_API_KEY) return Promise.reject(new Error('RESEND_API_KEY eksik'));
    return Promise.resolve(true);
}

async function dogrulamaKoduGonder(email, kod) {
    await sendMail({
        to: email,
        subject: 'Egemyo Mezun — Giriş Doğrulama Kodu',
        html: mailSablonu('Giriş Doğrulama Kodu', '#0077b5', kod, '10 dakika',
            'Sisteme giriş yapmak için aşağıdaki doğrulama kodunu kullanın.')
    });
}

async function sifreBelirlemeKoduGonder(email, kod) {
    await sendMail({
        to: email,
        subject: 'Egemyo Mezun — Şifre Belirleme Kodu',
        html: mailSablonu('🔐 Şifre Belirleme Kodu', '#00a652', kod, '15 dakika',
            'Hesabınız için şifre belirlemek üzere aşağıdaki doğrulama kodunu kullanın.')
    });
}

async function emailVerificationCodeGonder(email, kod) {
    await sendMail({
        to: email,
        subject: 'Egemyo Mezun — Email Doğrulama Kodu',
        html: mailSablonu('✉️ Email Doğrulama Kodu', '#0077b5', kod, '10 dakika',
            'Kayıt işlemini tamamlamak için aşağıdaki 6 haneli doğrulama kodunu kullanın.')
    });
}

async function passwordResetCodeGonder(email, kod) {
    logger.info('Şifre sıfırlama maili gönderiliyor:', { email });
    await sendMail({
        to: email,
        subject: 'Egemyo Mezun — Şifre Sıfırlama Kodu',
        html: mailSablonu('🔐 Şifre Sıfırlama Kodu', '#ff6b6b', kod, '15 dakika',
            'Şifrenizi sıfırlamak için aşağıdaki 6 haneli kodu kullanın.')
    });
    logger.info('Şifre sıfırlama maili gönderildi:', { email });
}

function mailSablonu(baslik, renk, kod, sure, aciklama) {
    return `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f8f9fa;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
            <h2 style="color:#0077b5;margin:0;">Egemyo Mezun</h2>
        </div>
        <div style="background:white;border-radius:12px;padding:28px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
            <h3 style="color:#1a202c;margin-top:0;">${baslik}</h3>
            <p style="color:#718096;line-height:1.6;">${aciklama} Bu kod <strong>${sure}</strong> geçerlidir.</p>
            <div style="text-align:center;margin:28px 0;">
                <div style="display:inline-block;background:${renk};color:white;font-size:40px;font-weight:700;
                    letter-spacing:14px;padding:18px 36px;border-radius:12px;font-family:monospace;">
                    ${kod}
                </div>
            </div>
            <p style="color:#a0aec0;font-size:13px;margin-bottom:0;">
                Bu maili siz istemediyseniz, güvende olduğunuzu bilmenizi isteriz — kodu kimseyle paylaşmayın.
            </p>
        </div>
        <p style="text-align:center;color:#a0aec0;font-size:12px;margin-top:20px;">
            © ${new Date().getFullYear()} Egemyo Mezun Sistemi
        </p>
    </div>`;
}

module.exports = { dogrulamaKoduGonder, sifreBelirlemeKoduGonder, emailVerificationCodeGonder, passwordResetCodeGonder, verifyMailer };
