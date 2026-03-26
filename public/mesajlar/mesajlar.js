// ── Mesajlar Sayfası Frontend Logic ──────────────────────────────────────

let aktifKarsiKullaniciId = null;
let aktifKarsiKullanici = null;

// ── BAŞLATMA ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    await sayfaAuthKontrol();
    navBaslat();
    logoutBaslat();
    
    konusmalarıYukle();
    
    // Buton event listeners
    document.getElementById('yeniMesajBtn')?.addEventListener('click', yeniMesajModalAc);
    document.getElementById('bosYeniMesajBtn')?.addEventListener('click', yeniMesajModalAc);
    document.getElementById('yeniMesajKapat')?.addEventListener('click', yeniMesajModalKapat);
    document.getElementById('yeniMesajIptal')?.addEventListener('click', yeniMesajModalKapat);
    document.getElementById('yeniMesajGonder')?.addEventListener('click', yeniMesajGonder);
    document.getElementById('gonderBtn')?.addEventListener('click', mesajGonder);
    
    // Arama input'u
    const kisiArama = document.getElementById('kisiAramaInput');
    kisiArama?.addEventListener('input', (e) => kisiAra(e.target.value));
    
    // Modal dışına tıklayınca kapat
    document.getElementById('yeni-mesaj-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'yeni-mesaj-modal') yeniMesajModalKapat();
    });
    
    // Mezunlar sayfasından gelen kişiyi kontrol et
    const secilenMezun = sessionStorage.getItem('secilenMezunMesaj');
    if (secilenMezun) {
        try {
            const mezun = JSON.parse(secilenMezun);
            sessionStorage.removeItem('secilenMezunMesaj');
            
            // Modal'ı aç ve kişiyi seç
            yeniMesajModalAc();
            setTimeout(() => {
                window.seciliKisId = mezun._id;
                window.seciliKisAdi = `${mezun.isim} ${mezun.soyisim}`;
                document.getElementById('kisiAramaInput').value = window.seciliKisAdi;
                document.getElementById('ilkMesaj').focus();
            }, 100);
        } catch (err) {
            console.error('Seçilen mezun parsing hatası:', err);
        }
    }
});

// ── KONUŞMALARI YÜKLE ───────────────────────────────────────────────────

async function konusmalarıYukle() {
    try {
        const res = await apiFetch(CONFIG.API_URL + '/mesajlar/konusmalar');
        if (!res) return;
        const data = await res.json();
        
        if (!data.basarili) {
            toastGoster('Konuşmalar yüklenemedi', 'hata');
            return;
        }
        
        const listesi = document.getElementById('konusmaListesi');
        listesi.innerHTML = '';
        
        if (!data.konusmalar || data.konusmalar.length === 0) {
            listesi.innerHTML = '<div style="padding:20px; text-align:center; color:#a0aec0;">Henüz konuşma yok</div>';
            return;
        }
        
        data.konusmalar.forEach(k => {
            const sonMesaj = k.mesajlar[k.mesajlar.length - 1];
            const okunmadiText = k.okunmadi > 0 ? `<span class="isv-k-badge">${k.okunmadi}</span>` : '';
            const adSoyad = `${k.karsiKullanici.isim || ''} ${k.karsiKullanici.soyisim || ''}`.trim() || 'Kullanıcı';
            const sonMetin = (sonMesaj?.metin || '').trim() || 'Henüz mesaj yok';
            
            const item = document.createElement('div');
            item.className = 'konusma-item' + (aktifKarsiKullaniciId === k.karsiKullanici._id.toString() ? ' aktif' : '');
            item.innerHTML = `
                <div class="konusma-info">
                    <div class="isv-k-ad">${escapeHtml(adSoyad)}</div>
                    <div class="isv-k-son">${escapeHtml(sonMetin.substring(0, 60))}</div>
                </div>
                ${okunmadiText}
            `;
            item.style.cursor = 'pointer';
            item.addEventListener('click', () => konusmaSec(k.karsiKullanici, item));
            listesi.appendChild(item);
        });
    } catch (err) {
        console.error('Konuşmaları yükle hatası:', err);
        toastGoster('Hata: ' + err.message, 'hata');
    }
}

// ── KONUŞMA SEÇ ─────────────────────────────────────────────────────────

async function konusmaSec(karsiKullanici, secilenItem = null) {
    aktifKarsiKullaniciId = karsiKullanici._id;
    aktifKarsiKullanici = karsiKullanici;
    
    // Aktif konuşmayı işaretle
    document.querySelectorAll('.konusma-item').forEach(item => {
        item.classList.remove('aktif');
    });
    secilenItem?.classList.add('aktif');
    
    // Boş durumu gizle, chat alanını aç
    document.getElementById('bosKonusma').style.display = 'none';
    document.getElementById('chatAlan').style.display = 'flex';
    
    // Chat header'ını güncelle
    const avatar = karsiKullanici.isim?.charAt(0).toUpperCase() || 'K';
    document.getElementById('chatAvatar').textContent = avatar;
    document.getElementById('chatKisiAdi').textContent = `${karsiKullanici.isim} ${karsiKullanici.soyisim}`;
    document.getElementById('chatKisiRol').textContent = karsiKullanici.rol || 'Kullanıcı';
    
    // Mesajları yükle
    await mesajlarıYukle();
    
    // Konuşmayı okundu işaretle
    await markaOkundu();
}

// ── MESAJLARI YÜKLE ────────────────────────────────────────────────────

async function mesajlarıYukle() {
    try {
        const res = await apiFetch(CONFIG.API_URL + '/mesajlar/konusmalar');
        if (!res) return;
        const data = await res.json();
        
        if (!data.basarili || !data.konusmalar) return;
        
        const konusma = data.konusmalar.find(k => k.karsiKullanici._id === aktifKarsiKullaniciId);
        if (!konusma) return;
        
        const mesajlarAlan = document.getElementById('mesajlarAlan');
        mesajlarAlan.innerHTML = '';
        
        const kullanici = JSON.parse(localStorage.getItem('kullanici') || '{}');
        const benimId = kullanici.id || kullanici._id;
        
        konusma.mesajlar.forEach(m => {
            const gonderenId = m.gonderen?._id || m.gonderen;
            const benGonderdim = String(gonderenId) === String(benimId);
            const div = document.createElement('div');
            div.className = benGonderdim ? 'isv-msg giden' : 'isv-msg gelen';
            div.innerHTML = `
                <div class="isv-msg-balon">${escapeHtml(m.metin)}</div>
                <div class="isv-msg-zaman">${new Date(m.tarih).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
            `;
            mesajlarAlan.appendChild(div);
        });
        
        // Alt'a kaydır
        mesajlarAlan.scrollTop = mesajlarAlan.scrollHeight;
    } catch (err) {
        console.error('Mesajları yükle hatası:', err);
    }
}

// ── YENİ MESAJ MODAL ────────────────────────────────────────────────────

function yeniMesajModalAc() {
    document.getElementById('yeni-mesaj-modal').classList.add('show');
    document.getElementById('kisiAramaInput').focus();
    document.getElementById('kisiAramaInput').value = '';
    document.getElementById('ilkMesaj').value = '';
    document.getElementById('kisiAramaSonuclari').innerHTML = '';
    document.getElementById('kisiAramaSonuclari').style.display = 'none';
}

function yeniMesajModalKapat() {
    document.getElementById('yeni-mesaj-modal').classList.remove('show');
}

// ── KİŞİ ARA ────────────────────────────────────────────────────────────

async function kisiAra(q) {
    if (!q || q.trim().length < 2) {
        document.getElementById('kisiAramaSonuclari').style.display = 'none';
        return;
    }
    
    try {
        const res = await apiFetch(CONFIG.API_URL + '/mesajlar/ara?q=' + encodeURIComponent(q));
        if (!res) return;
        const data = await res.json();
        
        const sonuclar = document.getElementById('kisiAramaSonuclari');
        
        if (!data.basarili || !data.kisiler || data.kisiler.length === 0) {
            sonuclar.innerHTML = '<div style="padding:12px; color:#a0aec0;">Kişi bulunamadı</div>';
            sonuclar.style.display = 'block';
            return;
        }
        
        sonuclar.innerHTML = data.kisiler.map(k => `
            <div style="padding:12px; cursor:pointer; border-bottom:1px solid #f0f0f0; transition:background 0.2s;" 
                 onmouseover="this.style.background='#f8f9fa'" 
                 onmouseout="this.style.background=''" 
                 onclick="kisiSec('${k._id}', '${escapeHtml(k.isim)} ${escapeHtml(k.soyisim)}')">
                <strong>${escapeHtml(k.isim)} ${escapeHtml(k.soyisim)}</strong><br>
                <small style="color:#718096;">${escapeHtml(k.email)}</small>
            </div>
        `).join('');
        sonuclar.style.display = 'block';
    } catch (err) {
        console.error('Kişi arama hatası:', err);
        toastGoster('Hata: ' + err.message, 'hata');
    }
}

function kisiSec(kisId, kisAdi) {
    window.seciliKisId = kisId;
    window.seciliKisAdi = kisAdi;
    document.getElementById('kisiAramaInput').value = kisAdi;
    document.getElementById('kisiAramaSonuclari').style.display = 'none';
    document.getElementById('ilkMesaj').focus();
}

// ── YENİ MESAJ GÖNDER ───────────────────────────────────────────────────

async function yeniMesajGonder() {
    if (!window.seciliKisId) {
        toastGoster('Lütfen bir kişi seçin', 'uyari');
        return;
    }
    
    const metin = document.getElementById('ilkMesaj').value.trim();
    if (!metin) {
        toastGoster('Lütfen bir mesaj yazın', 'uyari');
        return;
    }
    
    try {
        const res = await apiFetch(CONFIG.API_URL + '/mesajlar/' + window.seciliKisId, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ metin })
        });
        
        if (!res) return;
        const data = await res.json();
        
        if (!data.basarili) {
            toastGoster('Mesaj gönderilemedi: ' + data.mesaj, 'hata');
            return;
        }
        
        toastGoster('Mesaj gönderildi!', 'basarı');
        yeniMesajModalKapat();
        
        // Konuşmaları yenile
        konusmalarıYukle();
        
        window.seciliKisId = null;
        window.seciliKisAdi = null;
    } catch (err) {
        console.error('Yeni mesaj gönder hatası:', err);
        toastGoster('Hata: ' + err.message, 'hata');
    }
}

// ── MESAJ GÖNDER ────────────────────────────────────────────────────────

async function mesajGonder() {
    if (!aktifKarsiKullaniciId) return;
    
    const metin = document.getElementById('mesajInput').value.trim();
    if (!metin) return;
    
    try {
        const res = await apiFetch(CONFIG.API_URL + '/mesajlar/' + aktifKarsiKullaniciId, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ metin })
        });
        
        if (!res) return;
        const data = await res.json();
        
        if (!data.basarili) {
            toastGoster('Mesaj gönderilemedi', 'hata');
            return;
        }
        
        document.getElementById('mesajInput').value = '';
        await mesajlarıYukle();
    } catch (err) {
        console.error('Mesaj gönder hatası:', err);
        toastGoster('Hata: ' + err.message, 'hata');
    }
}

// ── İŞARET OKUNDU ───────────────────────────────────────────────────────

async function markaOkundu() {
    try {
        await apiFetch(CONFIG.API_URL + '/mesajlar/' + aktifKarsiKullaniciId + '/okundu', { method: 'PUT' });
    } catch (err) {
        console.error('İşaret okundu hatası:', err);
    }
}

// ── KONUŞMA SİL ─────────────────────────────────────────────────────────

function konusmaySil() {
    document.getElementById('silKonusmaModal').classList.add('show');
}

async function konusmaSilOnayla() {
    if (!aktifKarsiKullaniciId) return;
    
    try {
        // Kişinin tüm mesajlarını sil (backend'de gerekirse yap)
        // Şimdilik sadece UI'dan kaldır
        document.getElementById('silKonusmaModal').classList.remove('show');
        aktifKarsiKullaniciId = null;
        aktifKarsiKullanici = null;
        
        document.getElementById('bosKonusma').style.display = 'block';
        document.getElementById('chatAlan').style.display = 'none';
        
        await konusmalarıYukle();
        toastGoster('Konuşma silindi', 'basarı');
    } catch (err) {
        console.error('Konuşma sil hatası:', err);
        toastGoster('Hata: ' + err.message, 'hata');
    }
}

// ── YARDIMCI FUNCTIONS ──────────────────────────────────────────────────

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function toastGoster(mesaj, tip = 'bilgi') {
    const toast = document.getElementById('toastBildirim');
    if (!toast) return;
    
    const bgColor = tip === 'basarı' ? '#48bb78' : tip === 'hata' ? '#e53e3e' : '#0077b5';
    toast.innerHTML = `
        <div style="background:${bgColor}; color:white; padding:14px 18px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.15); animation:slideIn 0.3s ease;">
            ${mesaj}
        </div>
    `;
    toast.style.display = 'block';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, 4000);
}