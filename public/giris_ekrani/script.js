const API_URL = (typeof CONFIG !== 'undefined') ? CONFIG.AUTH_URL : 'http://localhost:3000/api/auth';

// ── State ─────────────────────────────────────────────
let aktifRol  = 'mezun';
let girisMaili = '';
let geriSayimId = null;
let kayitRol  = 'mezun';  // Kayıt formunda seçili rol

// ── Zaten giriş yapıldıysa yönlendir (cookie-based auth) ─────────────────
fetch(`${API_URL}/ben`, { credentials: 'include' })
    .then(r => r.json())
    .then(veri => {
        if (veri.basarili) {
            const profilTamamlandi = veri.kullanici.profilTamamlandi || localStorage.getItem('profilTamamlandi') === 'true';
            if (profilTamamlandi) {
                localStorage.setItem('profilTamamlandi', 'true');
            } else {
                localStorage.removeItem('profilTamamlandi');
            }
            localStorage.setItem('kullanici', JSON.stringify(veri.kullanici));
            yonlendir(veri.kullanici.rol, profilTamamlandi);
        }
    }).catch(() => {});


// ── Sekme Geçişi ──────────────────────────────────────
window.sekmeGec = function(rol) {
    aktifRol = rol;
    document.querySelectorAll('.sekme').forEach(s => s.classList.remove('aktif'));
    document.getElementById(`sekme-${rol}`).classList.add('aktif');

    if (rol === 'mezun') {
        document.getElementById('girisBaslik').textContent  = 'Hoş Geldin!';
        document.getElementById('girisSloganı').textContent = 'Okul mailinizle güvenli giriş yapın';
        document.getElementById('mailLabel').textContent    = 'Okul E-posta Adresi';
        document.getElementById('mailInput').placeholder   = 'ad.soyad@ogrenci.ege.edu.tr';
        document.getElementById('mailIpucu').textContent   = '@ogrenci.ege.edu.tr uzantılı okul mailinizi girin';
    } else {
        document.getElementById('girisBaslik').textContent  = 'İşveren Girişi';
        document.getElementById('girisSloganı').textContent = 'Kurumsal mailinizle giriş yapın';
        document.getElementById('mailLabel').textContent    = 'Kurumsal E-posta';
        document.getElementById('mailInput').placeholder   = 'ad@sirket.com';
        document.getElementById('mailIpucu').textContent   = 'Herhangi bir kurumsal mail adresi kullanabilirsiniz';
    }
};

// ── Form Türü Geçişi (Giriş ↔ Kayıt) ──────────────────
window.formTuruGec = function(turanew) {
    const girisForm = document.getElementById('girisFormu');
    const kayitForm = document.getElementById('kayitFormu');
    const sekmeGiris = document.getElementById('sekme-giris');
    const sekmeKayit = document.getElementById('sekme-kayit');
    const rolSecici = document.getElementById('rolSeciciKayit');

    if (turanew === 'giris') {
        // Giriş formunu göster
        if (girisForm) girisForm.style.display = 'block';
        kayitForm.style.display = 'none';
        
        // Sadece giriş formu adımlarını sıfırla
        girisForm.querySelectorAll('.giris-adim').forEach(el => el.classList.remove('aktif'));
        const adimMail = document.getElementById('adim-mail');
        if (adimMail) adimMail.classList.add('aktif');
        
        sekmeGiris.classList.add('aktif');
        sekmeKayit.classList.remove('aktif');
        rolSecici.style.display = 'none';
        
        // Formları sıfırla
        document.getElementById('mailInput').value = '';
        document.getElementById('sifreInput').value = '';
        document.getElementById('kodGonderBtn').disabled = false;
        
    } else if (turanew === 'kayit') {
        // Kayıt formunu göster
        if (girisForm) girisForm.style.display = 'none';
        kayitForm.style.display = 'block';
        
        // Kayıt formu adımını aktif yap
        kayitForm.querySelectorAll('.giris-adim').forEach(el => el.classList.remove('aktif'));
        const adimKayitEmail = document.getElementById('adim-kayit-email');
        if (adimKayitEmail) adimKayitEmail.classList.add('aktif');
        
        sekmeKayit.classList.add('aktif');
        sekmeGiris.classList.remove('aktif');
        rolSecici.style.display = 'flex';
        
        // Formları sıfırla
        document.getElementById('kayitMailInput').value = '';
        document.getElementById('kayitSifreInput').value = '';
        document.getElementById('kayitSifreTekrarInput').value = '';
        document.getElementById('kayitBtn').disabled = false;
        document.getElementById('kayitHata').style.display = 'none';
    }
};

// ── Kayıt Rol Seçimi ───────────────────────────────────
window.rolSecKayit = function(rol) {
    kayitRol = rol;
    document.querySelectorAll('.rol-btn').forEach(btn => btn.classList.remove('aktif'));
    document.getElementById(`rol-${rol}-kayit`).classList.add('aktif');
};

// ── Kayıt Şifre Toggle ─────────────────────────────────
window.kayitSifreyiToggleEt = function(inputId) {
    const input = document.getElementById(inputId);
    const btn = input.parentElement.querySelector('button.toggle-sifre');
    if (input.type === 'password') {
        input.type = 'text';
        if (btn) btn.textContent = '🙈';
    } else {
        input.type = 'password';
        if (btn) btn.textContent = '👁️';
    }
};

// ── Kod Gönder (Mail formunu devam ettir) ────────────────────────────────────
document.getElementById('kodGonderBtn').addEventListener('click', mailGonder);
document.getElementById('mailInput').addEventListener('keydown', e => { if (e.key === 'Enter') mailGonder(); });

async function mailGonder() {
    const mail   = document.getElementById('mailInput').value.trim();
    const hataEl = document.getElementById('mailHata');
    const btn    = document.getElementById('kodGonderBtn');
    const yazi   = document.getElementById('kodGonderBtnYazi');

    hataEl.style.display = 'none';

    // FormValidator ile validasyon
    if (typeof FormValidator !== 'undefined') {
        const check = FormValidator.validateLoginEmail(mail);
        if (!check.valid) { hataGoster(hataEl, check.error); return; }
    } else {
        if (!mail) { hataGoster(hataEl, 'E-posta adresinizi girin.'); return; }
        if (!mail.includes('@')) { hataGoster(hataEl, 'Geçerli bir e-posta girin.'); return; }
    }

    btn.disabled = true;
    yazi.textContent = 'Devam Ediliyor...';

    try {
        const controller = new AbortController();
        const timeoutId  = setTimeout(() => controller.abort(), 30000);

        // Frontend'de validation - gerçek API çağrısı yapma, sadece formata devam et
        girisMaili = mail;
        adimGec('kod');
        document.getElementById('mailOzet').innerHTML = `📧 <strong>${mail}</strong>`;
        document.getElementById('kodAciklama').textContent = 'Şifrenizi girin';
        document.getElementById('sifreInput').focus();
        
        clearTimeout(timeoutId);
        btn.disabled = false;
        yazi.textContent = 'Devam Et →';
    } catch(e) {
        hataGoster(hataEl, '⚠️ Beklenmeyen hata.');
        btn.disabled = false;
        yazi.textContent = 'Devam Et →';
    }
}

// ── Şifre Toggling ────────────────────────────────────
window.sifreyiToggleEt = function(inputId) {
    const input = inputId ? document.getElementById(inputId) : document.getElementById('sifreInput');
    const btn = input.parentElement.querySelector('button.toggle-sifre');
    if (input.type === 'password') {
        input.type = 'text';
        if (btn) btn.textContent = '🙈';
    } else {
        input.type = 'password';
        if (btn) btn.textContent = '👁️';
    }
};

// ── Giriş Yap (Şifre ile) ──────────────────────────────────
document.getElementById('dogrulaBtn').addEventListener('click', girisYap);
document.getElementById('sifreInput').addEventListener('keydown', e => { if (e.key === 'Enter') girisYap(); });

async function girisYap() {
    const email  = girisMaili;
    const sifre  = document.getElementById('sifreInput').value;
    const hataEl = document.getElementById('kodHata');
    const btn    = document.getElementById('dogrulaBtn');
    const yazi   = document.getElementById('dogrulaBtnYazi');
    const beniHatirla = document.getElementById('beniHatirla')?.checked ?? true;

    hataEl.style.display = 'none';

    // Validasyon
    if (!sifre) { 
        hataGoster(hataEl, 'Şifre zorunludur.');
        return; 
    }

    btn.disabled = true;
    yazi.textContent = 'Giriş Yapılıyor...';

    try {
        const controller = new AbortController();
        const timeoutId  = setTimeout(() => controller.abort(), 30000);

        const yanit = await fetch(`${API_URL}/giris`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, sifre }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const veri = await yanit.json();

        if (veri.basarili) {
            const eskiKullanici = JSON.parse(localStorage.getItem('kullanici') || '{}');
            const yeniRol = veri.kullanici.rol;
            const eskiRol = eskiKullanici.rol;

            const farkliKullanici = eskiKullanici.email &&
                                    eskiKullanici.email !== veri.kullanici.email &&
                                    eskiRol === yeniRol;

            const ilkGiris = !eskiKullanici.email;

            if (farkliKullanici || ilkGiris) {
                const temizlenecekler = ['profilDetay','profilDoldurma','profileAvatar','profileBanner',
                    'konusmalar','ilanlar','basvurular','bildirimAyarlari',
                    'gizlilikAyarlari','profilTamamlandi'];
                if (yeniRol.includes('isveren') || farkliKullanici) {
                    temizlenecekler.push('isverenAyarlar','isverenIlanlar','isverenBasvurular');
                }
                temizlenecekler.forEach(k => localStorage.removeItem(k));
            }

            // Server sets auth cookie; do not store token in localStorage
            localStorage.setItem('kullanici', JSON.stringify(veri.kullanici));
            localStorage.setItem('beniHatirla', beniHatirla ? 'true' : 'false');

            const profilTamamlandi = veri.kullanici.profilTamamlandi || localStorage.getItem('profilTamamlandi') === 'true';
            if (profilTamamlandi) {
                localStorage.setItem('profilTamamlandi', 'true');
            } else {
                localStorage.removeItem('profilTamamlandi');
            }

            yazi.textContent = '✅ Yönlendiriliyorsunuz...';
            setTimeout(() => {
                const hedef = veri.kullanici.rol.includes('isveren')
                    ? (profilTamamlandi ? '../isveren/isveren.html' : '../profil_doldurma_isveren/profil_doldurma_isveren.html')
                    : (!profilTamamlandi ? '../profil_doldurma/profil_doldurma.html' : '../dashboard/dashboard.html');
                window.location.href = hedef;
            }, 800);
        } else if (yanit.status === 403 && veri.emailVerificationRequired) {
            // Email doğrulanmamış — doğrulama sayfasına yönlendir
            // server sets temp token cookie when needed
            hataGoster(hataEl, veri.mesaj);
            setTimeout(() => { window.location.href = '../dogrulama/dogrulama.html'; }, 1500);
            btn.disabled = false;
            yazi.textContent = 'Giriş Yap →';
        } else if (yanit.status === 401) {
            // 401 = Yanlış şifre VEYA şifre belirlenmeyen eski kullanıcı
            document.getElementById('sifreInput').classList.add('hatali');
            setTimeout(() => document.getElementById('sifreInput').classList.remove('hatali'), 600);
            document.getElementById('sifreInput').value = '';
            
            if (veri.mesaj && (veri.mesaj.includes('E-posta veya şifre') || veri.mesaj.includes('password'))) {
                // Yanlış şifre
                document.getElementById('sifreInput').focus();
                hataGoster(hataEl, veri.mesaj || 'Giriş başarısız.');
            } else {
                // Eski kullanıcı - şifre belirlemek gerek
                const hataHTML = veri.mesaj + '<br><button class="link-btn" onclick="sifreKoduGonder()" style="display:block; margin-top:12px;">🔐 Şifre Belirleme Kodu Gönder</button>';
                hataEl.innerHTML = hataHTML;
                hataEl.style.display = 'block';
            }
            
            btn.disabled = false;
            yazi.textContent = 'Giriş Yap →';
        }
    } catch(e) {
        hataGoster(hataEl, '⚠️ Sunucuya ulaşılamıyor.');
        btn.disabled = false;
        yazi.textContent = 'Giriş Yap →';
    }
}

// ── Şifre Belirleme (Token ile) ──────────────────────
document.getElementById('sifreBelirleBtn')?.addEventListener('click', sifreBelirleFonksiyon);
document.getElementById('yeniSifreInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') sifreBelirleFonksiyon(); });

async function sifreBelirleFonksiyon() {
    const yeniSifre = document.getElementById('yeniSifreInput').value;
    const hataEl = document.getElementById('sifreBelirleHata');
    const btn = document.getElementById('sifreBelirleBtn');
    const yazi = document.getElementById('sifreBelirleYazi');

    hataEl.style.display = 'none';

    // Validasyon
    if (!yeniSifre) {
        hataGoster(hataEl, 'Şifre zorunludur.');
        return;
    }
    if (yeniSifre.length < 8) {
        hataGoster(hataEl, 'Şifre minimum 8 karakter olmalı.');
        return;
    }

    btn.disabled = true;
    yazi.textContent = 'Belirleniyor...';

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const yanit = await fetch(`${API_URL}/sifre-belirle`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ yeniSifre }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const veri = await yanit.json();

        if (veri.basarili) {
            yazi.textContent = '✅ Şifre Belirlendi!';
            setTimeout(() => {
                localStorage.setItem('profilTamamlandi', 'false');
                const kullanici = JSON.parse(localStorage.getItem('kullanici') || '{}');
                window.location.href = kullanici.rol?.includes('isveren')
                    ? '../profil_doldurma_isveren/profil_doldurma_isveren.html'
                    : '../profil_doldurma/profil_doldurma.html';
            }, 800);
        } else {
            console.error('Şifre belirleme hatası:', veri);
            hataGoster(hataEl, veri.mesaj || 'Şifre belirlenemedi. Sayfayı yenile ve tekrar dene.');
            btn.disabled = false;
            yazi.textContent = 'Şifreyi Belirle →';
        }
    } catch(e) {
        hataGoster(hataEl, '⚠️ Sunucuya ulaşılamıyor.');
        btn.disabled = false;
        yazi.textContent = 'Şifreyi Belirle →';
    }
}

// ── Geri Dön ──────────────────────────────────────────
window.geriDon = function() {
    adimGec('mail');
    document.getElementById('sifreInput').value = '';
    document.getElementById('yeniSifreInput').value = '';
    document.getElementById('sifreKoduInput').value = '';
    document.getElementById('kodHata').style.display = 'none';
    document.getElementById('sifreKoduHata').style.display = 'none';
    document.getElementById('sifreBelirleHata').style.display = 'none';
    clearInterval(geriSayimSifreKoduId);
    document.getElementById('mailInput').focus();
};

// ── Şifre Belirleme Kodu Gönder ────────────────────────
window.sifreKoduGonder = async function() {
    const email = girisMaili;
    const hataEl = document.getElementById('sifreKoduHata');
    
    hataEl.style.display = 'none';
    
    if (!email) {
        hataGoster(hataEl, 'E-posta adresi bulunamadı.');
        return;
    }

    adimGec('sifre-kod');
            document.getElementById('mailOzet3').innerHTML = `📧 <strong>${email}</strong>`;
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const yanit = await fetch(`${API_URL}/sifre-kodu-gonder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const veri = await yanit.json();

        if (!veri.basarili) {
            adimGec('kod');
            hataGoster(document.getElementById('kodHata'), veri.mesaj || 'Kod gönderilemedi.');
        } else {
            console.log('✅ Şifre belirleme kodu gönderildi');
            geriSayimBaslatSifreKodu(60);
        }
    } catch(e) {
        hataGoster(hataEl, '⚠️ Sunucuya ulaşılamıyor.');
        adimGec('kod');
    }
};

// ── Şifre Kodu Doğrula ────────────────────────────────
document.getElementById('sifreKoduDogrulaBtn')?.addEventListener('click', sifreKoduDogrula);
document.getElementById('sifreKoduInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') sifreKoduDogrula(); });

async function sifreKoduDogrula() {
    const email = girisMaili;
    const kod = document.getElementById('sifreKoduInput').value.trim();
    const hataEl = document.getElementById('sifreKoduHata');
    const btn = document.getElementById('sifreKoduDogrulaBtn');
    const yazi = document.getElementById('sifreKoduDogrulaBtnYazi');

    hataEl.style.display = 'none';

    if (!kod) {
        hataGoster(hataEl, 'Kodu girin.');
        return;
    }

    if (kod.length !== 6) {
        hataGoster(hataEl, '6 haneli kodu tam girin.');
        return;
    }

    btn.disabled = true;
    yazi.textContent = 'Doğrulanıyor...';

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const yanit = await fetch(`${API_URL}/sifre-kodu-dogrula`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, kod }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const veri = await yanit.json();

        if (veri.basarili) {
            // Server sets temp token cookie; no localStorage token needed
            
            adimGec('sifre-belirle');
            document.getElementById('mailOzet2').innerHTML = `📧 <strong>${email}</strong>`;
            document.getElementById('yeniSifreInput').focus();
            
            btn.disabled = false;
            yazi.textContent = 'Kodu Doğrula →';
        } else {
            document.getElementById('sifreKoduInput').classList.add('hatali');
            setTimeout(() => document.getElementById('sifreKoduInput').classList.remove('hatali'), 600);
            document.getElementById('sifreKoduInput').value = '';
            document.getElementById('sifreKoduInput').focus();
            hataGoster(hataEl, veri.mesaj || 'Kod doğrulama başarısız.');
            btn.disabled = false;
            yazi.textContent = 'Kodu Doğrula →';
        }
    } catch(e) {
        hataGoster(hataEl, '⚠️ Sunucuya ulaşılamıyor.');
        btn.disabled = false;
        yazi.textContent = 'Kodu Doğrula →';
    }
}

// ── Yeni Şifre Kodu İste ──────────────────────────────
window.yeniSifreKoduIste = async function() {
    document.getElementById('yeniSifreKoduBtn').style.display = 'none';
    await sifreKoduGonder();
};

let geriSayimSifreKoduId = null;

function geriSayimBaslatSifreKodu(saniye) {
    clearInterval(geriSayimSifreKoduId);
    const el = document.getElementById('yeniSifreKoduBtn');
    el.style.display = 'none';
    let kalan = saniye;
    
    geriSayimSifreKoduId = setInterval(() => {
        kalan--;
        if (kalan <= 0) {
            clearInterval(geriSayimSifreKoduId);
            el.style.display = 'inline';
        }
    }, 1000);
}

// ── Yardımcılar ───────────────────────────────────────
function adimGec(adim) {
    document.querySelectorAll('.giris-adim').forEach(a => a.classList.remove('aktif'));
    document.getElementById(`adim-${adim}`).classList.add('aktif');
}

function yonlendir(rol, profilTamamlandi) {
    const tamamlandi = profilTamamlandi !== undefined
        ? profilTamamlandi
        : localStorage.getItem('profilTamamlandi') === 'true';

    if (rol.includes('isveren')) {
        window.location.href = tamamlandi
            ? '../isveren/isveren.html'
            : '../profil_doldurma_isveren/profil_doldurma_isveren.html';
    } else if (!tamamlandi) window.location.href = '../profil_doldurma/profil_doldurma.html';
    else window.location.href = '../dashboard/dashboard.html';
}

// ── Hata Gösterici ─────────────────────────────────────
function hataGoster(el, mesaj) {
    if (!el) return;
    el.style.display = 'block';
    el.textContent = mesaj || 'Bir hata oluştu.';
}

// ── KAYIT IŞLEVI ────────────────────────────────────────

// Kayıt buton event listener'ı
if (document.getElementById('kayitBtn')) {
    document.getElementById('kayitBtn').addEventListener('click', kayitYap);
    document.getElementById('kayitMailInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') kayitYap(); });
}

async function kayitYap() {
    const email = document.getElementById('kayitMailInput').value.trim();
    const sifre = document.getElementById('kayitSifreInput').value;
    const sifreTekrar = document.getElementById('kayitSifreTekrarInput').value;
    const hataEl = document.getElementById('kayitHata');
    const btn = document.getElementById('kayitBtn');
    const yazi = document.getElementById('kayitBtnYazi');

    hataEl.style.display = 'none';

    // Validasyonlar
    if (!email) { hataGoster(hataEl, 'E-posta adresinizi girin.'); return; }
    if (!email.includes('@')) { hataGoster(hataEl, 'Geçerli bir e-posta girin.'); return; }
    
    if (!sifre) { hataGoster(hataEl, 'Şifre zorunludur.'); return; }
    if (sifre.length < 8) { hataGoster(hataEl, 'Şifre minimum 8 karakter olmalı.'); return; }
    
    if (!/[A-Z]/.test(sifre)) { hataGoster(hataEl, 'Şifre en az 1 büyük harf içermeli.'); return; }
    if (!/[0-9]/.test(sifre)) { hataGoster(hataEl, 'Şifre en az 1 rakam içermeli.'); return; }
    
    if (!sifreTekrar) { hataGoster(hataEl, 'Şifrenizi tekrar girin.'); return; }
    if (sifre !== sifreTekrar) { hataGoster(hataEl, 'Şifreler eşleşmiyor.'); return; }

    // Okul maili kontrolü (Mezun/Öğrenci için)
    if (kayitRol === 'mezun') {
        const OKUL_DOMAIN = 'ogrenci.ege.edu.tr';
        if (!email.endsWith('@' + OKUL_DOMAIN)) {
            hataGoster(hataEl, `Mezun/Öğrenci kaydı için @${OKUL_DOMAIN} uzantılı okul mailiniz gereklidir.`);
            return;
        }
    }

    btn.disabled = true;
    yazi.textContent = 'Kayıt Yapılıyor...';

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const yanit = await fetch(`${API_URL}/kayit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, sifre, istenenRol: kayitRol }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const veri = await yanit.json();

        if (veri.basarili) {
            // Kayıt başarılı - Eski profil verilerini temizle, yeni kullanıcı için boş başla
            const temizlenecekler = [
                'profilDetay','profilDoldurma','profileAvatar','profileBanner',
                'konusmalar','ilanlar','basvurular','bildirimAyarlari',
                'gizlilikAyarlari','profilTamamlandi',
                'isverenAyarlar','isverenIlanlar','isverenBasvurular'
            ];
            temizlenecekler.forEach(k => localStorage.removeItem(k));

            // Server sets auth cookie; store only user info in localStorage
            localStorage.setItem('kullanici', JSON.stringify(veri.kullanici));
            localStorage.setItem('email', veri.kullanici.email);
            localStorage.setItem('beniHatirla', 'true');
            localStorage.removeItem('profilTamamlandi');

            yazi.textContent = '✅ Kayıt Başarılı!';
            setTimeout(() => {
                // Email doğrulama gerekli mi?
                if (veri.emailVerificationRequired) {
                    window.location.href = '../dogrulama/dogrulama.html';
                } else {
                    const hedef = veri.kullanici.rol.includes('isveren')
                        ? '../profil_doldurma_isveren/profil_doldurma_isveren.html'
                        : '../profil_doldurma/profil_doldurma.html';
                    window.location.href = hedef;
                }
            }, 800);
        } else if (yanit.status === 409) {
            // E-posta zaten kayıtlı
            hataGoster(hataEl, veri.mesaj || 'Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin.');
            btn.disabled = false;
            yazi.textContent = 'Hesap Oluştur →';
        } else {
            hataGoster(hataEl, veri.mesaj || 'Kayıt başarısız. Lütfen tekrar deneyin.');
            btn.disabled = false;
            yazi.textContent = 'Hesap Oluştur →';
        }
    } catch(e) {
        hataGoster(hataEl, '⚠️ Sunucuya ulaşılamıyor: ' + e.message);
        btn.disabled = false;
        yazi.textContent = 'Hesap Oluştur →';
    }
}

// ═══════════════════════════════════════════════════════
// ŞİFREM İ UNUTTUM FUNCTIONS
// ═══════════════════════════════════════════════════════

function sifremiUnuttumAc() {
    const modal = document.getElementById('sifremiUnuttumModal');
    modal.style.display = 'flex';
    document.getElementById('sifremiUnuttumEmail').focus();
}

function sifremiUnuttumKapat() {
    const modal = document.getElementById('sifremiUnuttumModal');
    modal.style.display = 'none';
    document.getElementById('sifremiUnuttumEmail').value = '';
    document.getElementById('sifremiUnuttumHata').style.display = 'none';
}

// Modal dışında tıkladığında kapatma
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('sifremiUnuttumModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) sifremiUnuttumKapat();
        });
    }
});

async function sifremiUnuttumGonder() {
    const email = document.getElementById('sifremiUnuttumEmail').value.trim();
    const hataEl = document.getElementById('sifremiUnuttumHata');
    const btn = event.target;

    hataEl.style.display = 'none';

    if (!email) {
        hataEl.textContent = 'Lütfen e-posta adresinizi girin.';
        hataEl.style.display = 'block';
        return;
    }

    if (!email.includes('@')) {
        hataEl.textContent = 'Lütfen geçerli bir e-posta girin.';
        hataEl.style.display = 'block';
        return;
    }

    btn.disabled = true;
    btn.textContent = '⏳ Gönderiliyor...';

    try {
        const response = await fetch(`${API_URL}/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (data.basarili) {
            // Başarılı - kullanıcıyı reset-password sayfasına yönlendir
            sessionStorage.setItem('resetEmail', email);
            localStorage.removeItem('token'); // Token silinse (reset sırasında gerekli değil)
            // Reset password page'ine git
            hataEl.style.color = '#22c55e';
            hataEl.style.background = '#f0fdf4';
            hataEl.style.borderLeftColor = '#22c55e';
            hataEl.textContent = '✅ ' + data.mesaj;
            hataEl.style.display = 'block';
            
            setTimeout(() => {
                sifremiUnuttumKapat();
                // Reset password page'e geçiş
                window.location.href = '../sifre-sifirla/sifre-sifirla.html';
            }, 2000);
        } else {
            hataEl.textContent = data.mesaj || 'Bir hata oluştu.';
            hataEl.style.display = 'block';
        }
    } catch (err) {
        hataEl.textContent = 'Bağlantı hatası: ' + err.message;
        hataEl.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Kodu Gönder';
    }
}