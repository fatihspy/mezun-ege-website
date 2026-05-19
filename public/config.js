// ── Merkezi Konfigürasyon ─────────────────────────────
// Sunucu adresi değişirse sadece buradan güncelle

const _BASE = window.location.origin; // otomatik: localhost:3000 veya cloudflare URL
const CONFIG = {
    API_URL:  _BASE + '/api',
    AUTH_URL: _BASE + '/api/auth',
    BASE_URL: _BASE,
};

// Global fetch wrapper: default to sending cookies unless explicitly overridden
;(function() {
    if (typeof window === 'undefined' || !window.fetch) return;
    const _origFetch = window.fetch.bind(window);
    window.fetch = function(input, init) {
        init = init || {};
        if (typeof init.credentials === 'undefined') init.credentials = 'include';
        return _origFetch(input, init);
    };
})();

// Node.js ortamında (test için)
if (typeof module !== 'undefined') module.exports = CONFIG;

// ── Token Expire Kontrolü ─────────────────────────────
// Tüm sayfalarda fetch çağrılarını sarmalar
// 401 alınca otomatik çıkış yapar
async function apiFetch(url, options = {}) {
    // ensure cookies are sent for cookie-based auth
    options.credentials = options.credentials || 'include';
    const res = await fetch(url, options);
    if (res.status === 401) {
        // Token geçersiz veya süresi dolmuş — temizle ve giriş sayfasına gönder
        ['token','beniHatirla'].forEach(k => localStorage.removeItem(k));
        // Giriş ekranının konumunu bul
        const depth = window.location.pathname.split('/').filter(Boolean).length;
        const base  = depth > 1 ? '../'.repeat(depth - 1) : './';
        window.location.href = base + 'giris_ekrani/index.html';
        return null;
    }
    return res;
}

// ── Kullanıcı Adını Al ────────────────────────────────
// kullanici objesi, profilDetay ve profilDoldurma'dan isim okur
function kullaniciAdiGetir() {
    const k  = JSON.parse(localStorage.getItem('kullanici')  || '{}');
    const pd = JSON.parse(localStorage.getItem('profilDetay')|| '{}');
    const pf = JSON.parse(localStorage.getItem('profilDoldurma') || '{}');

    const tamAdKaynak = (
        k.adSoyad || k.tamAd || k.name ||
        pd.adSoyad || pd.tamAd || pd.name ||
        pf.adSoyad || pf.tamAd || pf.name ||
        ''
    ).toString().trim();

    const adParca = tamAdKaynak ? tamAdKaynak.split(/\s+/).filter(Boolean) : [];
    const tamAddanIsim = adParca.length ? adParca[0] : '';
    const tamAddanSoyad = adParca.length > 1 ? adParca.slice(1).join(' ') : '';

    // Farkli sayfalarda ve eski kayitlarda alan adlari degisebildigi icin
    // isim/soyisim'i tum olasi anahtarlardan topla.
    const isim = (
        k.isim || k.ad ||
        pd.isim || pd.ad ||
        pf.isim || pf.ad ||
        tamAddanIsim ||
        ''
    ).toString().trim();

    const soyad = (
        k.soyisim || k.soyad ||
        pd.soyisim || pd.soyad ||
        pf.soyisim || pf.soyad ||
        tamAddanSoyad ||
        ''
    ).toString().trim();

    return { isim, soyad, adSoyad: isim ? `${isim} ${soyad}`.trim() : '' };
}

// ── Bildirim Sistemi ──────────────────────────────────
// Tüm sayfalarda çalışır, localStorage'daki değişiklikleri izler

const BILDIRIM_KEY = 'bekleyenBildirimler';

async function apiBildirimEkle(tip, mesaj, link) {
    try {
        // try to post to backend; backend will persist and notify device(s)
        await fetch(CONFIG.API_URL + '/bildirimler', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: (JSON.parse(localStorage.getItem('kullanici')|| '{}').id || null), tip, mesaj, link })
        });
    } catch (e) {
        // ignore network errors — fallback to localStorage
    }
}

function bildirimEkle(tip, mesaj, link) {
    // try server-side persist (best-effort) then fallback to localStorage
    apiBildirimEkle(tip, mesaj, link);
    const bildirimler = JSON.parse(localStorage.getItem(BILDIRIM_KEY) || '[]');
    bildirimler.unshift({
        id: Date.now(),
        tip,   // 'basvuru' | 'mesaj' | 'sistem'
        mesaj,
        link,
        tarih: new Date().toLocaleString('tr-TR'),
        okundu: false
    });
    // Max 20 bildirim tut
    if (bildirimler.length > 20) bildirimler.splice(20);
    localStorage.setItem(BILDIRIM_KEY, JSON.stringify(bildirimler));
    bildirimZiliniGuncelle();
}

function bildirimZiliniGuncelle() {
    const zil = document.getElementById('bildirimZili');
    if (!zil) return;
    const bildirimler = JSON.parse(localStorage.getItem(BILDIRIM_KEY) || '[]');
    const okunmamis = bildirimler.filter(b => !b.okundu).length;
    const badge = zil.querySelector('.zil-badge');
    if (badge) {
        badge.textContent = okunmamis;
        badge.style.display = okunmamis > 0 ? 'flex' : 'none';
    }
}

function bildirimPanelAc() {
    const panel = document.getElementById('bildirimPanel');
    if (!panel) return;
    const bildirimler = JSON.parse(localStorage.getItem(BILDIRIM_KEY) || '[]');

    panel.innerHTML = bildirimler.length ? bildirimler.map(b => `
        <div class="bildirim-item ${b.okundu ? '' : 'okunmamis'}" onclick="bildirimAc(${b.id})">
            <span class="bildirim-tip-ikon">${b.tip === 'basvuru' ? '📋' : b.tip === 'mesaj' ? '💬' : '🔔'}</span>
            <div class="bildirim-bilgi">
                <div class="bildirim-mesaj">${b.mesaj}</div>
                <div class="bildirim-tarih">${b.tarih}</div>
            </div>
        </div>
    `).join('') : '<div class="bildirim-bos">Bildirim yok 🎉</div>';

    panel.classList.toggle('show');

    // Hepsini okundu yap
    bildirimler.forEach(b => b.okundu = true);
    localStorage.setItem(BILDIRIM_KEY, JSON.stringify(bildirimler));
    bildirimZiliniGuncelle();
}

// Try to load notifications from server on load and merge into localStorage
async function bildirimleriYukle() {
    try {
        const res = await fetch(CONFIG.API_URL + '/bildirimler');
        if (!res.ok) return;
        const data = await res.json();
        if (!data.basarili) return;
        const server = data.bildirimler || [];
        const local = JSON.parse(localStorage.getItem(BILDIRIM_KEY) || '[]');
        // merge, favor server items, remove duplicates by id or mesaj/tarih
        const merged = [...server.map(s => ({ id: s._id, tip: s.tip, mesaj: s.mesaj, link: s.link, tarih: new Date(s.tarih).toLocaleString('tr-TR'), okundu: s.okundu })), ...local];
        // uniq by mesaj+tarih
        const seen = new Set();
        const uniq = [];
        for (const b of merged) {
            const k = (b.id || '') + '|' + b.mesaj + '|' + b.tarih;
            if (seen.has(k)) continue;
            seen.add(k);
            uniq.push(b);
            if (uniq.length >= 50) break;
        }
        localStorage.setItem(BILDIRIM_KEY, JSON.stringify(uniq));
        bildirimZiliniGuncelle();
    } catch (e) {
        // ignore
    }
}

window.bildirimAc = function(id) {
    const bildirimler = JSON.parse(localStorage.getItem(BILDIRIM_KEY) || '[]');
    const b = bildirimler.find(x => x.id === id);
    if (b && b.link) window.location.href = b.link;
};

// Sayfa yüklenince zili güncelle
document.addEventListener('DOMContentLoaded', () => { bildirimZiliniGuncelle(); bildirimleriYukle(); });

// ── Gerçek Zamanlı Polling ────────────────────────────
// Her 10 saniyede bildirim sayısını kontrol eder,
// aktif mesaj sayfasındaysa yeni mesajları da çeker.

(function() {
    let _sonKontrol = new Date().toISOString();
    let _pollingTimer = null;

    async function _pollingTur() {
        try {
            // 1. Okunmamış bildirim sayısını çek
            const res = await fetch(
                CONFIG.API_URL + '/bildirimler/okunmamis-sayisi?since=' + encodeURIComponent(_sonKontrol),
                { credentials: 'include' }
            );
            if (!res.ok) return;
            const data = await res.json();
            _sonKontrol = new Date().toISOString();

            if (data.sayi > 0) {
                // Çanı güncelle
                const badge = document.querySelector('.zil-badge');
                if (badge) {
                    const mevcut = parseInt(badge.textContent || '0', 10);
                    badge.textContent = mevcut + data.sayi;
                    badge.style.display = 'flex';
                }
                // localStorage'daki bildirimleri sunucudan yenile
                if (typeof bildirimleriYukle === 'function') bildirimleriYukle();
            }

            // 2. Mesaj sayfasındaysak aktif sohbeti güncelle
            if (typeof aktifKarsiKullaniciId !== 'undefined' && aktifKarsiKullaniciId) {
                if (typeof mesajlarıYukle === 'function') mesajlarıYukle();
            }
            // İşveren sayfasındaysak
            if (typeof isvAktifKarsiId !== 'undefined' && isvAktifKarsiId) {
                if (typeof isvKonusmaAc === 'function') isvKonusmaAc(isvAktifKarsiId, false);
            }
        } catch (e) { /* sessizce geç */ }
    }

    function pollingBaslat() {
        if (_pollingTimer) return;
        _pollingTimer = setInterval(_pollingTur, 10000); // 10 saniye
    }

    function pollingDurdur() {
        clearInterval(_pollingTimer);
        _pollingTimer = null;
    }

    // Sayfa görünür olduğunda çalış, arka planda duraksın
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) pollingDurdur();
        else { pollingBaslat(); _pollingTur(); }
    });

    document.addEventListener('DOMContentLoaded', pollingBaslat);
    window.pollingBaslat = pollingBaslat;
    window.pollingDurdur = pollingDurdur;
})();

// ── Auth Kontrolü (Token + Backend doğrulama) ─────────
// tokenOnly=true → sadece varlık kontrolü (hızlı), false → backend'e sorar (güvenli)
async function sayfaAuthKontrol(tokenOnly = false) {
    // For cookie-based auth we must consult the backend.
    // If tokenOnly=true we perform a lightweight check and do NOT redirect on failure.
    try {
        const res = await fetch(CONFIG.AUTH_URL + '/ben', { credentials: 'include' });
        if (!res.ok) {
            if (tokenOnly) return null;
            const depth = window.location.pathname.split('/').filter(Boolean).length;
            const base  = depth > 1 ? '../'.repeat(depth - 1) : './';
            window.location.href = base + 'giris_ekrani/index.html';
            return null;
        }
        const veri = await res.json();
        if (!veri.basarili) {
            if (tokenOnly) return null;
            const depth = window.location.pathname.split('/').filter(Boolean).length;
            const base  = depth > 1 ? '../'.repeat(depth - 1) : './';
            window.location.href = base + 'giris_ekrani/index.html';
            return null;
        }
        // Güncel kullanıcı bilgisini storage'a yaz
        localStorage.setItem('kullanici', JSON.stringify(veri.kullanici));
        return veri.kullanici;
    } catch(e) {
        console.warn('Auth kontrolü yapılamadı:', e.message);
        if (tokenOnly) return null;
        const depth = window.location.pathname.split('/').filter(Boolean).length;
        const base  = depth > 1 ? '../'.repeat(depth - 1) : './';
        window.location.href = base + 'giris_ekrani/index.html';
        return null;
    }
}

// ── Nav Başlatıcı ─────────────────────────────────────
// Tüm sayfalardaki ortak nav avatar + kullanıcı adı + hamburger menü
function navBaslat() {
    const kullanici = JSON.parse(localStorage.getItem('kullanici') || '{}');
    const { isim, adSoyad } = kullaniciAdiGetir();
    const savedAvatar = localStorage.getItem('profileAvatar');

    const navAv = document.getElementById('navAvatarWrap');
    if (navAv) {
        if (savedAvatar) {
            navAv.innerHTML = `<img src="${savedAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
            navAv.textContent = (isim || kullanici.email || 'K').charAt(0).toUpperCase();
        }
    }

    const navUserName = document.getElementById('navUserName');
    if (navUserName) navUserName.textContent = adSoyad || kullanici.email || '';

    // Hamburger menü (sidebar veya mobilMenu)
    const hamburger = document.getElementById('hamburger');
    const mobilMenu = document.getElementById('mobilMenu') || document.getElementById('sidebar');
    if (hamburger && mobilMenu) {
        hamburger.addEventListener('click', () => mobilMenu.classList.toggle('acik'));
        document.addEventListener('click', (e) => {
            if (!hamburger.contains(e.target) && !mobilMenu.contains(e.target)) {
                mobilMenu.classList.remove('acik');
            }
        });
    }
}

// ── Logout Başlatıcı ──────────────────────────────────
// Tüm sayfalardaki ortak çıkış akışı
function logoutBaslat() {
    const logoutBtn    = document.querySelector('.logout-btn');
    const modal        = document.getElementById('logout-modal');
    const successModal = document.getElementById('success-modal');
    const confirmBtn   = document.getElementById('confirm-logout');
    const cancelBtn    = document.getElementById('cancel-logout');
    const okBtn        = document.getElementById('ok-success');

    if (!logoutBtn || !modal) return;

    const girisSayfasi = (() => {
        const depth = window.location.pathname.split('/').filter(Boolean).length;
        const base  = depth > 1 ? '../'.repeat(depth - 1) : './';
        return base + 'giris_ekrani/index.html';
    })();

    logoutBtn.addEventListener('click', () => modal.classList.add('show'));
    cancelBtn?.addEventListener('click', () => modal.classList.remove('show'));

    confirmBtn?.addEventListener('click', async () => {
        modal.classList.remove('show');
        try {
            await fetch(CONFIG.AUTH_URL + '/cikis', { method: 'POST', credentials: 'include' });
        } catch(e) {}
        ['token', 'beniHatirla', 'kullanici', 'profilTamamlandi'].forEach(k => localStorage.removeItem(k));
        if (successModal) {
            successModal.classList.add('show');
            setTimeout(() => { window.location.href = girisSayfasi; }, 2000);
        } else {
            window.location.href = girisSayfasi;
        }
    });

    okBtn?.addEventListener('click', () => { window.location.href = girisSayfasi; });

    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('show');
        if (e.target === successModal) { window.location.href = girisSayfasi; }
    });
}
