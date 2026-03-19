const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host:   process.env.MAIL_HOST,
    port:   parseInt(process.env.MAIL_PORT),
    secure: false,
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    }
});

async function dogrulamaKoduGonder(email, kod) {
    await transporter.sendMail({
        from:    process.env.MAIL_FROM,
        to:      email,
        subject: 'Egemyo Mezun — Giriş Doğrulama Kodu',
        html: `
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f8f9fa;border-radius:16px;">
                <div style="text-align:center;margin-bottom:24px;">
                    <h2 style="color:#0077b5;margin:0;">Egemyo Mezun</h2>
                </div>
                <div style="background:white;border-radius:12px;padding:28px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                    <h3 style="color:#1a202c;margin-top:0;">Giriş Doğrulama Kodu</h3>
                    <p style="color:#718096;line-height:1.6;">
                        Sisteme giriş yapmak için aşağıdaki doğrulama kodunu kullanın.
                        Bu kod <strong>10 dakika</strong> geçerlidir.
                    </p>
                    <div style="text-align:center;margin:28px 0;">
                        <div style="display:inline-block;background:#0077b5;color:white;font-size:36px;font-weight:700;
                            letter-spacing:12px;padding:16px 32px;border-radius:12px;">
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
            </div>
        `
    });
}

async function sifreBelirlemeKoduGonder(email, kod) {
    await transporter.sendMail({
        from:    process.env.MAIL_FROM,
        to:      email,
        subject: 'Egemyo Mezun — Şifre Belirleme Kodu',
        html: `
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f8f9fa;border-radius:16px;">
                <div style="text-align:center;margin-bottom:24px;">
                    <h2 style="color:#0077b5;margin:0;">Egemyo Mezun</h2>
                </div>
                <div style="background:white;border-radius:12px;padding:28px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                    <h3 style="color:#1a202c;margin-top:0;">🔐 Şifre Belirleme Kodu</h3>
                    <p style="color:#718096;line-height:1.6;">
                        Hesabınız için şifre belirlemek üzere aşağıdaki doğrulama kodunu kullanın.
                        Bu kod <strong>15 dakika</strong> geçerlidir.
                    </p>
                    <div style="text-align:center;margin:28px 0;">
                        <div style="display:inline-block;background:#00a652;color:white;font-size:36px;font-weight:700;
                            letter-spacing:12px;padding:16px 32px;border-radius:12px;">
                            ${kod}
                        </div>
                    </div>
                    <p style="color:#718096;line-height:1.6;margin-top:20px;">
                        <strong>Önemli:</strong> Kodu kopyalayıp şifre belirleme formuna yapıştırın.
                        Ardından güvenli bir şifre seçin (en az 8 karakter, 1 büyük harf, 1 rakam).
                    </p>
                    <p style="color:#a0aec0;font-size:13px;margin-bottom:0;">
                        Bu maili siz istemediyseniz, bu e-postayı yoksayabilirsiniz.
                    </p>
                </div>
                <p style="text-align:center;color:#a0aec0;font-size:12px;margin-top:20px;">
                    © ${new Date().getFullYear()} Egemyo Mezun Sistemi
                </p>
            </div>
        `
    });
}

async function emailVerificationCodeGonder(email, kod) {
    await transporter.sendMail({
        from: process.env.MAIL_FROM,
        to: email,
        subject: 'Egemyo Mezun — Email Doğrulama Kodu',
        html: `
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f8f9fa;border-radius:16px;">
                <div style="text-align:center;margin-bottom:24px;">
                    <h2 style="color:#0077b5;margin:0;">Egemyo Mezun</h2>
                </div>
                <div style="background:white;border-radius:12px;padding:28px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                    <h3 style="color:#1a202c;margin-top:0;">✉️ Email Doğrulama Kodu</h3>
                    <p style="color:#718096;line-height:1.6;">
                        Kayıt işlemini tamamlamak için aşağıdaki 6 haneli doğrulama kodunu kullanın.
                        Bu kod <strong>10 dakika</strong> geçerlidir.
                    </p>
                    <div style="text-align:center;margin:28px 0;">
                        <div style="display:inline-block;background:#0077b5;color:white;font-size:48px;font-weight:700;
                            letter-spacing:16px;padding:20px 40px;border-radius:12px;font-family:monospace;">
                            ${kod}
                        </div>
                    </div>
                    <p style="color:#718096;line-height:1.6;margin-top:20px;">
                        <strong>Not:</strong> Kodu kopyalayıp doğrulama sayfasına yapıştırın.
                    </p>
                    <p style="color:#a0aec0;font-size:13px;margin-bottom:0;">
                        Bu maili siz istemediyseniz, güvenli olun — kodu kimseyle paylaşmayın.
                    </p>
                </div>
                <p style="text-align:center;color:#a0aec0;font-size:12px;margin-top:20px;">
                    © ${new Date().getFullYear()} Egemyo Mezun Sistemi
                </p>
            </div>
        `
    });
}

async function passwordResetCodeGonder(email, kod) {
    await transporter.sendMail({
        from: process.env.MAIL_FROM,
        to: email,
        subject: 'Egemyo Mezun — Şifre Sıfırlama Kodu',
        html: `
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f8f9fa;border-radius:16px;">
                <div style="text-align:center;margin-bottom:24px;">
                    <h2 style="color:#0077b5;margin:0;">Egemyo Mezun</h2>
                </div>
                <div style="background:white;border-radius:12px;padding:28px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                    <h3 style="color:#1a202c;margin-top:0;">🔐 Şifre Sıfırlama Kodu</h3>
                    <p style="color:#718096;line-height:1.6;">
                        Şifrenizi sıfırlamak için aşağıdaki 6 haneli kodu kullanın.
                        Bu kod <strong>15 dakika</strong> geçerlidir.
                    </p>
                    <div style="text-align:center;margin:28px 0;">
                        <div style="display:inline-block;background:#ff6b6b;color:white;font-size:48px;font-weight:700;
                            letter-spacing:16px;padding:20px 40px;border-radius:12px;font-family:monospace;">
                            ${kod}
                        </div>
                    </div>
                    <p style="color:#718096;line-height:1.6;margin-top:20px;">
                        <strong>Önemli:</strong> Kodu sıfırlama sayfasına yapıştırın ve yeni bir güvenli şifre belirleyin.
                    </p>
                    <p style="color:#a0aec0;font-size:13px;margin-top:16px;margin-bottom:0;">
                        ⚠️ Bu isteği siz yapmadıysanız, bu e-postayı yoksayabilirsiniz. Hesabınız güvende kalacaktır.
                    </p>
                </div>
                <p style="text-align:center;color:#a0aec0;font-size:12px;margin-top:20px;">
                    © ${new Date().getFullYear()} Egemyo Mezun Sistemi
                </p>
            </div>
        `
    });
}

module.exports = { dogrulamaKoduGonder, sifreBelirlemeKoduGonder, emailVerificationCodeGonder, passwordResetCodeGonder };
