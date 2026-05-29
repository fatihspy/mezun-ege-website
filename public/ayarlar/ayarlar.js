// Auth kontrolü
(async function() {
    try {
        const res = await fetch((typeof CONFIG !== 'undefined' ? CONFIG.AUTH_URL : 'http://localhost:3000/api/auth') + '/ben', { credentials: 'include' });
        const veri = await res.json();
        if (!veri.basarili) { window.location.href = '../giris_ekrani/index.html'; }
    } catch(e) {
        // ağ hatası durumunda yönlendirme yapma
    }
})();

// ── Nav Avatar ─────────────────────────────────────────
(function() {
    const kullanici   = JSON.parse(localStorage.getItem('kullanici') || '{}');
    const savedAvatar = localStorage.getItem('profileAvatar');
    const navAv = document.getElementById('navAvatarWrap');
    if (!navAv) return;
    if (savedAvatar) {
        navAv.innerHTML = '<img src="' + savedAvatar + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
    } else {
        navAv.textContent = (kullaniciAdiGetir().isim || kullanici.email || 'K').charAt(0).toUpperCase();
    }
})();

// ── Kullanıcı Bilgisi ─────────────────────────────────
const kullanici = JSON.parse(localStorage.getItem('kullanici') || '{}');
const profilData = JSON.parse(localStorage.getItem('profilDoldurma') || '{}');

const navUserName = document.getElementById('navUserName');
if (navUserName && kullanici.isim) {
    navUserName.textContent = `${kullanici.isim} ${kullanici.soyisim || ''}`.trim();
}

// ── Avatar Yükle ──────────────────────────────────────
const buyukAvatar = document.getElementById('buyukAvatar');
const savedAvatar = localStorage.getItem('profileAvatar');

function avatarGuncelle(src) {
    if (src) {
        buyukAvatar.innerHTML = `<img src="${src}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    } else {
        const ad = kullanici.isim || 'K';
        buyukAvatar.textContent = ad.charAt(0).toUpperCase();
    }
}
avatarGuncelle(savedAvatar);

// Fotoğraf değiştir
document.getElementById('avatarInput').addEventListener('change', function() {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        localStorage.setItem('profileAvatar', e.target.result);
        avatarGuncelle(e.target.result);
        toastGoster('✅ Profil fotoğrafı güncellendi!');
    };
    reader.readAsDataURL(file);
});

// ── Hesap Bilgilerini Yükle ───────────────────────────
document.getElementById('hesapAdi').textContent =
    kullanici.isim ? `${kullanici.isim} ${kullanici.soyisim || ''}`.trim() : 'Ad Soyad';
document.getElementById('hesapRol').textContent =
    kullanici.rol === 'mezun' ? 'Mezun' : kullanici.rol === 'isveren' ? 'İşveren' : 'Öğrenci';

document.getElementById('ayarIsim').value    = kullanici.isim    || profilData.isim    || '';
document.getElementById('ayarSoyisim').value = kullanici.soyisim || profilData.soyisim || '';
document.getElementById('ayarEmail').value   = kullanici.email   || '';
document.getElementById('ayarTelefon').value = profilData.telefon || '';
telefonMaskUygula('ayarTelefon');
document.getElementById('ayarHakkimda').value= profilData.hakkimda || '';

// Hesap kaydet
document.getElementById('hesapKaydet').addEventListener('click', () => {
    const guncel = {
        ...kullanici,
        isim:    document.getElementById('ayarIsim').value.trim(),
        soyisim: document.getElementById('ayarSoyisim').value.trim(),
        email:   document.getElementById('ayarEmail').value.trim(),
    };
    localStorage.setItem('kullanici', JSON.stringify(guncel));

    const guncelProfil = {
        ...profilData,
        isim:     guncel.isim,
        soyisim:  guncel.soyisim,
        telefon:  document.getElementById('ayarTelefon').value.trim(),
        hakkimda: document.getElementById('ayarHakkimda').value.trim(),
    };
    localStorage.setItem('profilDoldurma', JSON.stringify(guncelProfil));

    document.getElementById('hesapAdi').textContent = `${guncel.isim} ${guncel.soyisim}`.trim();
    if (navUserName) navUserName.textContent = `${guncel.isim} ${guncel.soyisim}`.trim();
    toastGoster('✅ Hesap bilgileri kaydedildi!');
});

// ── Güvenlik Sekmesi — Giriş mailini göster ───────────
const girisMailiEl = document.getElementById('girisMailiGoster');
if (girisMailiEl && kullanici.email) {
    girisMailiEl.textContent = kullanici.email;
}

// ── Bildirim Tercihlerini Yükle/Kaydet ───────────────
const bildirimAyarlari = JSON.parse(localStorage.getItem('bildirimAyarlari') || '{}');
const bildirimIds = ['bildirim-mesaj','bildirim-ilan','bildirim-basvuru','bildirim-ozet','bildirim-push','bildirim-ses'];

bildirimIds.forEach(id => {
    const el = document.getElementById(id);
    if (bildirimAyarlari[id] !== undefined) el.checked = bildirimAyarlari[id];
});

document.getElementById('bildirimKaydet').addEventListener('click', () => {
    const ayarlar = {};
    bildirimIds.forEach(id => { ayarlar[id] = document.getElementById(id).checked; });
    localStorage.setItem('bildirimAyarlari', JSON.stringify(ayarlar));
    toastGoster('✅ Bildirim tercihleri kaydedildi!');
});

// ── Gizlilik Ayarlarını Yükle/Kaydet ─────────────────
const gizlilikAyarlari = JSON.parse(localStorage.getItem('gizlilikAyarlari') || '{}');
const gizlilikIds = ['gizlilik-profil','gizlilik-email','gizlilik-telefon','gizlilik-mesaj'];

gizlilikIds.forEach(id => {
    const el = document.getElementById(id);
    if (gizlilikAyarlari[id] !== undefined) el.checked = gizlilikAyarlari[id];
});

document.getElementById('gizlilikKaydet').addEventListener('click', () => {
    const ayarlar = {};
    gizlilikIds.forEach(id => { ayarlar[id] = document.getElementById(id).checked; });
    localStorage.setItem('gizlilikAyarlari', JSON.stringify(ayarlar));
    toastGoster('✅ Gizlilik ayarları kaydedildi!');
});

// ── Hesap Sil ─────────────────────────────────────────
document.getElementById('hesapSilBtn').addEventListener('click', () => {
    const metin = document.getElementById('silOnayMetin').value;
    if (metin !== 'HESABIMI SİL') { toastGoster('⚠️ Onay metnini doğru yazın!'); return; }
    document.getElementById('sil-modal').classList.add('show');
});

document.getElementById('silIptal').addEventListener('click', () => {
    document.getElementById('sil-modal').classList.remove('show');
});

document.getElementById('silOnayla').addEventListener('click', () => {
    // Tüm kullanıcı verilerini sil ama önce giriş ekranına git
    const anahtarlar = Object.keys(localStorage);
    anahtarlar.forEach(k => localStorage.removeItem(k));
    window.location.href = '../giris_ekrani/index.html';
});

// ── Sekme Geçişleri ───────────────────────────────────
document.querySelectorAll('.sekme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.sekme-btn').forEach(b => b.classList.remove('aktif'));
        document.querySelectorAll('.sekme-panel').forEach(p => p.classList.remove('aktif'));
        btn.classList.add('aktif');
        document.getElementById(`sekme-${btn.dataset.sekme}`).classList.add('aktif');
    });
});

// ── Toast Bildirimi ───────────────────────────────────
function toastGoster(mesaj) {
    const toast = document.getElementById('toast');
    toast.textContent = mesaj;
    toast.classList.add('goster');
    setTimeout(() => toast.classList.remove('goster'), 3000);
}

// Logout ve hamburger: config.js logoutBaslat() / navBaslat() tarafından yönetilir
// Ayarlara özgü modal kapama
window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('sil-modal')) document.getElementById('sil-modal').classList.remove('show');
});

// ═══════════════════════════════════════════════════════
// ŞİFRE DEĞIŞTIR FUNCTIONS
// ═══════════════════════════════════════════════════════

const API_URL = (typeof CONFIG !== 'undefined') ? CONFIG.AUTH_URL : 'http://localhost:3000/api/auth';

function toggleSifre(fieldId) {
    const input = document.getElementById(fieldId);
    input.type = input.type === 'password' ? 'text' : 'password';
}

function sifreFormSifirlat() {
    document.getElementById('eskiSifre').value = '';
    document.getElementById('yeniSifre').value = '';
    document.getElementById('yeniSifreTekrar').value = '';
    document.getElementById('sifreHata').innerHTML = '';
    document.getElementById('sifreBasarisi').innerHTML = '';
}

async function sifreDegistir() {
    const oldPassword = document.getElementById('eskiSifre').value.trim();
    const newPassword = document.getElementById('yeniSifre').value.trim();
    const newPasswordRetry = document.getElementById('yeniSifreTekrar').value.trim();
    const hataEl = document.getElementById('sifreHata');
    const basariEl = document.getElementById('sifreBasarisi');
    
    hataEl.innerHTML = '';
    basariEl.innerHTML = '';

    // Validasyon
    if (!oldPassword) {
        hataEl.innerHTML = '<div style="color:#e53e3e;background:#fff5f5;padding:12px;border-radius:8px;border-left:4px solid #e53e3e;">Lütfen eski şifrenizi girin.</div>';
        return;
    }

    if (!newPassword) {
        hataEl.innerHTML = '<div style="color:#e53e3e;background:#fff5f5;padding:12px;border-radius:8px;border-left:4px solid #e53e3e;">Lütfen yeni şifrenizi girin.</div>';
        return;
    }

    if (newPassword.length < 8) {
        hataEl.innerHTML = '<div style="color:#e53e3e;background:#fff5f5;padding:12px;border-radius:8px;border-left:4px solid #e53e3e;">Şifre minimum 8 karakter olmalı.</div>';
        return;
    }

    if (!/[A-Z]/.test(newPassword)) {
        hataEl.innerHTML = '<div style="color:#e53e3e;background:#fff5f5;padding:12px;border-radius:8px;border-left:4px solid #e53e3e;">Şifre en az 1 büyük harf içermeli.</div>';
        return;
    }

    if (!/[0-9]/.test(newPassword)) {
        hataEl.innerHTML = '<div style="color:#e53e3e;background:#fff5f5;padding:12px;border-radius:8px;border-left:4px solid #e53e3e;">Şifre en az 1 rakam içermeli.</div>';
        return;
    }

    if (!newPasswordRetry) {
        hataEl.innerHTML = '<div style="color:#e53e3e;background:#fff5f5;padding:12px;border-radius:8px;border-left:4px solid #e53e3e;">Lütfen şifrenizi tekrar girin.</div>';
        return;
    }

    if (newPassword !== newPasswordRetry) {
        hataEl.innerHTML = '<div style="color:#e53e3e;background:#fff5f5;padding:12px;border-radius:8px;border-left:4px solid #e53e3e;">Şifreler eşleşmiyor.</div>';
        return;
    }

    // API çağrısı
    const btn = event.target;
    btn.disabled = true;
    const btnText = btn.textContent;
    btn.textContent = '⏳ Güncelleniyor...';

    try {
        const response = await fetch(`${API_URL}/change-password`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ oldPassword, newPassword })
        });

        const data = await response.json();

        if (data.basarili) {
            basariEl.innerHTML = '<div style="color:#276749;background:#f0fdf4;padding:12px;border-radius:8px;border-left:4px solid #22c55e;">✅ ' + data.mesaj + '</div>';
            sifreFormSifirlat();
            setTimeout(() => {
                sifreFormSifirlat();
                btn.disabled = false;
                btn.textContent = btnText;
            }, 2000);
        } else {
            hataEl.innerHTML = '<div style="color:#e53e3e;background:#fff5f5;padding:12px;border-radius:8px;border-left:4px solid #e53e3e;">' + data.mesaj + '</div>';
            btn.disabled = false;
            btn.textContent = btnText;
        }
    } catch (error) {
        hataEl.innerHTML = '<div style="color:#e53e3e;background:#fff5f5;padding:12px;border-radius:8px;border-left:4px solid #e53e3e;">Hata: ' + error.message + '</div>';
        btn.disabled = false;
        btn.textContent = btnText;
    }
}
