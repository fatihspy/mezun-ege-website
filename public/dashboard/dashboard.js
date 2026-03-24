const API_URL = (typeof CONFIG !== 'undefined') ? CONFIG.AUTH_URL : 'http://localhost:3000/api/auth';

// ── Backend'den kullanıcı profilini çek ──────────────
let profilCache = null;
async function getProfilData() {
    if (profilCache) return profilCache;
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/profil`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();
        if (result.basarili) {
            profilCache = result.profil;
            return result.profil;
        }
    } catch(e) { console.error('Profil yüklenemedi:', e); }
    return {};
}

// ── Yardımcı Fonksiyon: İsim Getirme ──────────────────
async function kullaniciAdiGetir() {
    const profil = await getProfilData();

    const k  = JSON.parse(localStorage.getItem('kullanici') || '{}');
    const pd = JSON.parse(localStorage.getItem('profilDetay') || '{}');
    const pf = JSON.parse(localStorage.getItem('profilDoldurma') || '{}');

    const tamAdKaynak = (
        profil.adSoyad || profil.tamAd || profil.name ||
        k.adSoyad || k.tamAd || k.name ||
        pd.adSoyad || pd.tamAd || pd.name ||
        pf.adSoyad || pf.tamAd || pf.name ||
        ''
    ).toString().trim();

    const adParca = tamAdKaynak ? tamAdKaynak.split(/\s+/).filter(Boolean) : [];
    const tamAddanIsim = adParca.length ? adParca[0] : '';
    const tamAddanSoyad = adParca.length > 1 ? adParca.slice(1).join(' ') : '';

    const isim = (
        profil.isim || profil.ad ||
        k.isim || k.ad ||
        pd.isim || pd.ad ||
        pf.isim || pf.ad ||
        tamAddanIsim ||
        ''
    ).toString().trim() || 'Kullanıcı';

    const soyad = (
        profil.soyisim || profil.soyad ||
        k.soyisim || k.soyad ||
        pd.soyisim || pd.soyad ||
        pf.soyisim || pf.soyad ||
        tamAddanSoyad ||
        ''
    ).toString().trim();

    const adSoyad = soyad ? `${isim} ${soyad}` : isim;
    return { isim, soyad, adSoyad, profil };
}

// ── Gerçek Auth Kontrolü ───────────────────────────────
(async function() {
    const token = localStorage.getItem('token');
    if (!token) { 
        window.location.href = '../giris_ekrani/index.html'; 
        return; 
    }

    try {
        // Token'ı backend'e sorarak doğrula
        const res = await fetch(`${API_URL}/ben`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const veri = await res.json();
        
        if (!veri.basarili) {
            localStorage.removeItem('token');
            window.location.href = '../giris_ekrani/index.html';
        }
    } catch (e) {
        console.error("Sunucu bağlantı hatası:", e);
    }
})();

document.addEventListener('DOMContentLoaded', async function() {

    // ── Kullanıcı bilgisi - Backend'den çek ──────────
    const { isim, soyad, adSoyad, profil } = await kullaniciAdiGetir();

    // Ortak navBaslat() localStorage'daki kullanici objesini okudugu icin,
    // dashboard'da cikan isim/soyisim'i buraya senkronla.
    const localKullanici = JSON.parse(localStorage.getItem('kullanici') || '{}');
    const senkronIsim = (profil.isim || profil.ad || localKullanici.isim || localKullanici.ad || isim || '').toString().trim();
    const senkronSoyisim = (profil.soyisim || profil.soyad || localKullanici.soyisim || localKullanici.soyad || soyad || '').toString().trim();
    localStorage.setItem('kullanici', JSON.stringify({
        ...localKullanici,
        isim: senkronIsim,
        soyisim: senkronSoyisim
    }));

    const gorunenAd = `${senkronIsim} ${senkronSoyisim}`.trim() || adSoyad || 'Kullanıcı';
    document.getElementById('navUserName').textContent  = gorunenAd;
    document.getElementById('hosgeldinAdi').textContent = senkronIsim || isim || 'Kullanıcı';

    // Avatar - Backend'den resim çekiliyorsa burada gösterilecek (ilerde avatar upload feature)
    const navAvatar = document.getElementById('navAvatarWrap');
    if (profil.avatar) {
        navAvatar.innerHTML = `<img src="${profil.avatar}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid #0077b5;">`;
    } else {
        navAvatar.textContent = (senkronIsim || isim || 'K').charAt(0).toUpperCase();
    }

    // Tarih
    document.getElementById('bugunTarih').textContent = new Date().toLocaleDateString('tr-TR', { weekday:'long', day:'numeric', month:'long' });

    // ── Kullanıcı Tipi ──────────────────────────────
    const kullaniciTip = profil.tip || (profil.rol && profil.rol[0]) || 'mezun';
    const ogrenciMi = kullaniciTip === 'ogrenci' || (profil.rol && profil.rol.includes('ogrenci'));

    // Hoş geldin mesajını tipe göre ayarla
    const hosgeldinBannerP = document.querySelector('.hosgeldin-banner p');
    if (hosgeldinBannerP) {
        hosgeldinBannerP.innerHTML = ogrenciMi
            ? `Bugün <span id="bugunTarih2"></span> — Staj fırsatları seni bekliyor! 🎯`
            : `Bugün <span id="bugunTarih2"></span> — Yeni fırsatlar seni bekliyor!`;
        const t2 = document.getElementById('bugunTarih2');
        if (t2) t2.textContent = new Date().toLocaleDateString('tr-TR', { weekday:'long', day:'numeric', month:'long' });
    }

    // Rozet ekle
    const hosgeldinSol = document.querySelector('.hosgeldin-sol');
    if (hosgeldinSol) {
        const rozetDiv = document.createElement('div');
        rozetDiv.style.cssText = 'margin-top:8px;';
        rozetDiv.innerHTML = ogrenciMi
            ? '<span style="background:rgba(255,255,255,0.2);color:white;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:600;">📚 Aktif Öğrenci</span>'
            : '<span style="background:rgba(255,255,255,0.2);color:white;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:600;">🎓 Mezun</span>';
        hosgeldinSol.appendChild(rozetDiv);
    }

    // İlan butonu metnini tipe göre değiştir
    const kesfetBtn = document.querySelector('.btn-kesfet');
    if (kesfetBtn && ogrenciMi) {
        kesfetBtn.textContent = '🎯 Staj İlanlarını Keşfet';
        kesfetBtn.href = '../ilanlar/ilanlar.html?tip=staj';
    }

    // ── Özet Kartları — Backend'den çek ───────────────
    const apiUrl  = (typeof CONFIG !== 'undefined') ? CONFIG.API_URL  : 'http://localhost:3000/api';
    const tkn     = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${tkn}` };

    // Paralel çek
    let veriIlanlar = null, veriBasvurular = null, veriMesajlar = null;
    try {
        const [r1, r2, r3] = await Promise.allSettled([
            fetch(`${apiUrl}/ilanlar`,               { headers }),
            fetch(`${apiUrl}/basvurular/benimkiler`,  { headers }),
            fetch(`${apiUrl}/mesajlar/konusmalar`,    { headers })
        ]);
        if (r1.status === 'fulfilled' && r1.value.ok) veriIlanlar    = await r1.value.json();
        if (r2.status === 'fulfilled' && r2.value.ok) veriBasvurular = await r2.value.json();
        if (r3.status === 'fulfilled' && r3.value.ok) veriMesajlar   = await r3.value.json();
    } catch(e) {}

    // İlanlar sayısı
    if (veriIlanlar && veriIlanlar.ilanlar) {
        document.getElementById('aktifIlanSayisi').textContent = veriIlanlar.ilanlar.length;
        sonIlanlarGoster(veriIlanlar.ilanlar);
    } else {
        document.getElementById('aktifIlanSayisi').textContent = 0;
    }

    // Başvurular sayısı
    if (veriBasvurular && veriBasvurular.basvurular) {
        document.getElementById('basvuruSayisi').textContent = veriBasvurular.basvurular.length;
    } else {
        document.getElementById('basvuruSayisi').textContent = 0;
    }

    // Mesajlar — okunmamış sayısı
    if (veriMesajlar && veriMesajlar.konusmalar) {
        const okunmamis = veriMesajlar.konusmalar.reduce((t, k) => t + (k.okunmadi || 0), 0);
        document.getElementById('mesajSayisi').textContent = okunmamis;
    } else {
        document.getElementById('mesajSayisi').textContent = 0;
    }

    // Profil tamamlama — Backend profilinden oku (pd değişkeni kaldırıldı, profil objesi kullanılıyor)
    const tamamlananlar = [
        profil.isim,
        profil.bolum || (profil.egitim && profil.egitim[0] && profil.egitim[0].bolum),
        profil.hakkimda,
        (profil.beceriler || []).length,
        profil.telefon || (profil.sosyalMedya && profil.sosyalMedya.linkedin),
        (profil.egitim || []).length,
    ].filter(Boolean).length;
    
    // Yüzde hesaplama hatasını önleme (0 bölü vb.)
    const yuzde = Math.round((tamamlananlar / 6) * 100) || 0; 
    document.getElementById('profilYuzde').textContent = `%${yuzde}`;

    // Onboarding — eksik adımları göster
    const onboardingEl = document.getElementById('onboardingPanel');
    if (onboardingEl && yuzde < 100) {
        const adimlar = [
            { tamam: !!profil.isim, metin: 'Adını ekle', link: '../profile/profile.html' },
            { tamam: !!(profil.bolum || (profil.egitim && profil.egitim[0])), metin: 'Bölüm bilgini ekle', link: '../profile/profile.html' },
            { tamam: !!profil.hakkimda, metin: '"Hakkımda" bölümünü doldur', link: '../profile/profile.html' },
            { tamam: !!(profil.beceriler && profil.beceriler.length), metin: 'En az bir beceri ekle', link: '../profile/profile.html' },
            { tamam: !!(profil.telefon || (profil.sosyalMedya && profil.sosyalMedya.linkedin)), metin: 'İletişim bilgilerini ekle', link: '../profile/profile.html' },
            { tamam: !!(profil.egitim && profil.egitim.length), metin: 'Eğitim bilgini ekle', link: '../profile/profile.html' },
        ];
        const eksikler = adimlar.filter(a => !a.tamam).slice(0, 3);
        onboardingEl.innerHTML = `
            <div class="onboarding-kart">
                <div class="onboarding-baslik">
                    <span>🚀 Profilini Güçlendir</span>
                    <span class="onboarding-yuzde">%${yuzde} tamamlandı</span>
                </div>
                <div class="onboarding-bar"><div class="onboarding-bar-dolu" style="width:${yuzde}%"></div></div>
                <div class="onboarding-adimlar">
                    ${eksikler.map(a => `
                        <a href="${a.link}" class="onboarding-adim">
                            <span class="adim-ikon">⬜</span>
                            <span>${a.metin}</span>
                            <span class="adim-ok">→</span>
                        </a>
                    `).join('')}
                </div>
            </div>
        `;
        onboardingEl.style.display = 'block';
    } else if (onboardingEl) {
        onboardingEl.style.display = 'none';
    }

    // ── Son İlanlar ───────────────────────────────────
    // (sonIlanlarGoster fonksiyonu ile dolduruldu)

    // ── Son Mesajlar ──────────────────────────────────
    const sonMesajlarEl = document.getElementById('sonMesajlar');
    if (veriMesajlar) {
        const konusmalar = (veriMesajlar.konusmalar || []).slice(0, 3);
        if (!konusmalar.length) {
            sonMesajlarEl.innerHTML = '<div class="bos-panel">Henüz mesaj yok. <a href="../mesajlar/mesajlar.html">Mesajlara git →</a></div>';
        } else {
            sonMesajlarEl.innerHTML = konusmalar.map(k => {
                const kisi = k.karsiKullanici;
                const ad   = kisi ? `${kisi.isim || ''} ${kisi.soyisim || ''}`.trim() : 'Kullanıcı';
                const son  = k.mesajlar[k.mesajlar.length - 1];
                return `
                    <div class="mini-kart" onclick="window.location.href='../mesajlar/mesajlar.html'">
                        <div class="mini-kart-ikon mesaj-ikon">${ad.charAt(0).toUpperCase()}</div>
                        <div class="mini-kart-bilgi">
                            <div class="mini-kart-baslik">${ad}</div>
                            <div class="mini-kart-alt">${son ? son.metin.substring(0, 40) : ''}</div>
                        </div>
                        ${k.okunmadi ? `<span class="okunmadi-dot">${k.okunmadi}</span>` : ''}
                    </div>
                `;
            }).join('');
        }
    } else {
        sonMesajlarEl.innerHTML = '<div class="bos-panel">Mesajlar yüklenemedi.</div>';
    }

    // ── Son Başvurular ────────────────────────────────
    const sonBasvurularEl = document.getElementById('sonBasvurular');
    if (veriBasvurular) {
        const basvurular = (veriBasvurular.basvurular || []).slice(0, 3);
        if (!basvurular.length) {
            sonBasvurularEl.innerHTML = '<div class="bos-panel">Henüz başvuru yok. <a href="../ilanlar/ilanlar.html">İlanlara bak →</a></div>';
        } else {
            sonBasvurularEl.innerHTML = basvurular.map(b => `
                <div class="mini-kart" onclick="window.location.href='../basvurular/basvurular.html'">
                    <div class="mini-kart-ikon basvuru-ikon">${(b.ilan?.sirket || 'B').charAt(0).toUpperCase()}</div>
                    <div class="mini-kart-bilgi">
                        <div class="mini-kart-baslik">${b.ilan?.pozisyon || ''}</div>
                        <div class="mini-kart-alt">${b.ilan?.sirket || ''}</div>
                    </div>
                    <span class="durum-badge durum-${b.durum}">${durumLabel(b.durum)}</span>
                </div>
            `).join('');
        }
    } else {
        sonBasvurularEl.innerHTML = '<div class="bos-panel">Henüz başvuru yok. <a href="../ilanlar/ilanlar.html">İlanlara bak →</a></div>';
    }

    // ── Yardımcılar ───────────────────────────────────
    function sonIlanlarGoster(ilanlar) {
        const el = document.getElementById('sonIlanlar');
        if (!el) return;
        const liste = ilanlar.slice(0, 4);
        if (!liste.length) {
            el.innerHTML = '<div class="bos-panel">Henüz ilan yok. <a href="../ilanlar/ilanlar.html">İlanlara git →</a></div>';
        } else {
            el.innerHTML = liste.map(i => `
                <div class="mini-kart" onclick="window.location.href='../ilanlar/ilanlar.html'">
                    <div class="mini-kart-ikon">${(i.sirket || 'İ').charAt(0).toUpperCase()}</div>
                    <div class="mini-kart-bilgi">
                        <div class="mini-kart-baslik">${i.pozisyon}</div>
                        <div class="mini-kart-alt">${i.sirket} · ${i.konum || ''}</div>
                    </div>
                    <span class="mini-badge tur-${i.tur}">${turLabel(i.tur)}</span>
                </div>
            `).join('');
        }
    }
    function turLabel(tur) {
        return { tam:'Tam Zam.', yari:'Yarı Zam.', staj:'Staj', uzaktan:'Uzaktan' }[tur] || tur;
    }
    function durumLabel(durum) {
        return { beklemede:'Beklemede', gorusme:'Görüşme', reddedildi:'Reddedildi', kabul:'Kabul' }[durum] || durum;
    }

    // ── Nav + Logout (config.js ortak fonksiyonlar) ───
    navBaslat();
    logoutBaslat();
});