// Auth + nav
sayfaAuthKontrol(true);
document.addEventListener('DOMContentLoaded', () => { navBaslat(); logoutBaslat(); });

// ── Veri ─────────────────────────────────────────────
const kullanici  = JSON.parse(localStorage.getItem('kullanici') || '{}');
let profilData   = {}; // Backend'den yüklenecek

// Backend'den profil bilgilerini al
async function profilGetirAPI() {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '../giris_ekrani/index.html'; return; }
    
    const authUrl = (typeof CONFIG !== 'undefined') ? CONFIG.AUTH_URL : 'http://localhost:3000/api/auth';
    try {
        const response = await fetch(`${authUrl}/profil`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        if (result.basarili) {
            profilData = result.profil;
            // localStorage'dan fallback için eski veriyi de tut ama API'deki kullan
            return profilData;
        }
    } catch(e) {
        console.error('Profil yüklenemedi:', e);
    }
    return null;
}

function profilGetir() { 
    return profilData || JSON.parse(localStorage.getItem('profilDetay') || '{}'); 
}

function profilKaydet(d) {
    // localStorage'a yazma - SADECE backend'e gönder
    const token = localStorage.getItem('token');
    if (!token) return;
    const authUrl = (typeof CONFIG !== 'undefined') ? CONFIG.AUTH_URL : 'http://localhost:3000/api/auth';
    fetch(`${authUrl}/profil`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
            isim:     d.ad,
            soyisim:  d.soyad,
            unvan:    d.unvan,
            konum:    d.konum,
            hakkimda: d.hakkimda,
            telefon:  d.iletisim?.telefon,
            sosyalMedya: {
                linkedin: d.iletisim?.linkedin,
                github:   d.iletisim?.github,
                web:      d.iletisim?.web
            },
            egitim:    d.egitim    || [],
            deneyim:   d.deneyim   || [],
            beceriler: d.beceriler || [],
            diller:    d.diller    || []
        })
    }).catch(() => {}); // sessiz hata
}

// ── Header ────────────────────────────────────────────
const { isim, soyad, adSoyad } = kullaniciAdiGetir();
document.getElementById('navUserName').textContent = adSoyad;
const savedAvatar = localStorage.getItem('profileAvatar');
const navAv = document.getElementById('navAvatarWrap');
if (savedAvatar) navAv.innerHTML = `<img src="${savedAvatar}">`;
else navAv.textContent = (isim || kullanici.email || 'K').charAt(0).toUpperCase();

// ── Avatar ────────────────────────────────────────────
const profilAvatarEl = document.getElementById('profilAvatar');
if (savedAvatar) profilAvatarEl.src = savedAvatar;

document.getElementById('avatarInput').addEventListener('change', function() {
    const file = this.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        profilAvatarEl.src = e.target.result;
        navAv.innerHTML = `<img src="${e.target.result}">`;
        localStorage.setItem('profileAvatar', e.target.result);
        toast('✅ Profil fotoğrafı güncellendi!');
    };
    reader.readAsDataURL(file);
});

// ── Banner ────────────────────────────────────────────
const savedBanner = localStorage.getItem('profileBanner');
if (savedBanner) document.getElementById('bannerEl').style.backgroundImage = `url(${savedBanner})`;

document.getElementById('bannerInput').addEventListener('change', function() {
    const file = this.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('bannerEl').style.backgroundImage = `url(${e.target.result})`;
        localStorage.setItem('profileBanner', e.target.result);
        toast('✅ Banner güncellendi!');
    };
    reader.readAsDataURL(file);
});

// ── Profil Temel Bilgileri Yükle ──────────────────────
function temelBilgileriYukle() {
    const pd = profilGetir();
    const ad = kullanici.isim ? `${kullanici.isim} ${kullanici.soyisim || ''}`.trim() : (profilData.isim ? `${profilData.isim} ${profilData.soyisim || ''}`.trim() : 'Ad Soyad');
    document.getElementById('profilAdi').textContent   = pd.ad     || ad;
    document.getElementById('profilUnvan').textContent = pd.unvan  || (profilData.bolum ? `${profilData.bolum} Mezunu` : 'Egemyo Mezunu');
    document.getElementById('profilKonum').textContent = pd.konum  || 'İzmir, Türkiye';

    // Tip rozeti göster
    const tip = pd.tip || kullanici.rol || 'mezun';
    const rozetEl = document.getElementById('profilTipRozeti');
    if (rozetEl) {
        rozetEl.textContent = tip === 'ogrenci' ? '📚 Aktif Öğrenci' : '🎓 Mezun';
        rozetEl.className   = `tip-rozet tip-${tip}`;
    }

    profilTamamlamaHesapla();
}

// ── Profil Tamamlama ──────────────────────────────────
function profilTamamlamaHesapla() {
    const pd = profilGetir();
    let puan = 0; const toplam = 6;
    if (kullanici.isim) puan++;
    if (pd.unvan || profilData.bolum) puan++;
    if (pd.iletisim?.email || kullanici.email) puan++;
    if (pd.hakkimda) puan++;
    if ((pd.egitim || []).length) puan++;
    if ((pd.beceriler || []).length) puan++;
    const yuzde = Math.round((puan / toplam) * 100);
    document.getElementById('tamamlamaYuzde').textContent = `%${yuzde}`;
    document.getElementById('barDolu').style.width = `${yuzde}%`;
}

// ── Profil Düzenle Modal ──────────────────────────────
document.getElementById('profilDuzenleBtn').addEventListener('click', () => {
    const pd = profilGetir();
    document.getElementById('fProfilAd').value    = kullanici.isim    || profilData.isim    || '';
    document.getElementById('fProfilSoyad').value = kullanici.soyisim || profilData.soyisim || '';
    document.getElementById('fProfilUnvan').value = pd.unvan  || '';
    document.getElementById('fProfilKonum').value = pd.konum  || '';
    document.getElementById('profil-modal').classList.add('show');
});
document.getElementById('profilModalKapat').addEventListener('click', () => document.getElementById('profil-modal').classList.remove('show'));
document.getElementById('profilModalIptal').addEventListener('click', () => document.getElementById('profil-modal').classList.remove('show'));
document.getElementById('profilModalKaydet').addEventListener('click', () => {
    const ad    = document.getElementById('fProfilAd').value.trim();
    const soyad = document.getElementById('fProfilSoyad').value.trim();
    if (!ad) { toast('⚠️ Ad zorunludur!'); return; }
    const guncel = { ...kullanici, isim: ad, soyisim: soyad };
    localStorage.setItem('kullanici', JSON.stringify(guncel));
    const pd = profilGetir();
    pd.unvan = document.getElementById('fProfilUnvan').value.trim();
    pd.konum = document.getElementById('fProfilKonum').value.trim();
    profilKaydet(pd);
    document.getElementById('navUserName').textContent = `${ad} ${soyad}`.trim();
    document.getElementById('profil-modal').classList.remove('show');
    temelBilgileriYukle();
    toast('✅ Profil güncellendi!');
});

// ── İletişim ──────────────────────────────────────────
function iletisimYukle() {
    const pd = profilGetir();
    const il = pd.iletisim || {};
    document.getElementById('goIletisimEmail').textContent   = il.email    || kullanici.email || '—';
    document.getElementById('goIletisimTelefon').textContent = il.telefon  || profilData.telefon || '—';
    document.getElementById('goIletisimLinkedin').textContent= il.linkedin || '—';
    document.getElementById('goIletisimWeb').textContent     = il.web      || '—';
}
document.getElementById('iletisimDuzenleBtn').addEventListener('click', () => {
    const pd = profilGetir(); const il = pd.iletisim || {};
    document.getElementById('fIletisimEmail').value   = il.email    || kullanici.email || '';
    document.getElementById('fIletisimTelefon').value = il.telefon  || profilData.telefon || '';
    document.getElementById('fIletisimLinkedin').value= il.linkedin || '';
    document.getElementById('fIletisimWeb').value     = il.web      || '';
    document.getElementById('iletisimForm').style.display = 'block';
    document.getElementById('iletisimDuzenleBtn').style.display = 'none';
});
document.getElementById('iletisimIptal').addEventListener('click', () => {
    document.getElementById('iletisimForm').style.display = 'none';
    document.getElementById('iletisimDuzenleBtn').style.display = '';
});
document.getElementById('iletisimKaydet').addEventListener('click', () => {
    const pd = profilGetir();
    pd.iletisim = {
        email:    document.getElementById('fIletisimEmail').value.trim(),
        telefon:  document.getElementById('fIletisimTelefon').value.trim(),
        linkedin: document.getElementById('fIletisimLinkedin').value.trim(),
        web:      document.getElementById('fIletisimWeb').value.trim(),
    };
    profilKaydet(pd);
    document.getElementById('iletisimForm').style.display = 'none';
    document.getElementById('iletisimDuzenleBtn').style.display = '';
    iletisimYukle(); profilTamamlamaHesapla();
    toast('✅ İletişim bilgileri kaydedildi!');
});

// ── Hakkımda ──────────────────────────────────────────
function hakkimdaYukle() {
    const pd = profilGetir();
    document.getElementById('goHakkimda').textContent = pd.hakkimda || 'Henüz bir tanıtım yazısı eklenmedi.';
}
document.getElementById('hakkimdaDuzenleBtn').addEventListener('click', () => {
    const pd = profilGetir();
    document.getElementById('fHakkimda').value = pd.hakkimda || '';
    document.getElementById('hakkimdaForm').style.display = 'block';
    document.getElementById('hakkimdaDuzenleBtn').style.display = 'none';
});
document.getElementById('hakkimdaIptal').addEventListener('click', () => {
    document.getElementById('hakkimdaForm').style.display = 'none';
    document.getElementById('hakkimdaDuzenleBtn').style.display = '';
});
document.getElementById('hakkimdaKaydet').addEventListener('click', () => {
    const pd = profilGetir();
    pd.hakkimda = document.getElementById('fHakkimda').value.trim();
    profilKaydet(pd);
    document.getElementById('hakkimdaForm').style.display = 'none';
    document.getElementById('hakkimdaDuzenleBtn').style.display = '';
    hakkimdaYukle(); profilTamamlamaHesapla();
    toast('✅ Hakkımda bölümü güncellendi!');
});

// ── Eğitim ────────────────────────────────────────────
function egitimYukle() {
    const pd = profilGetir();
    const liste = pd.egitim || [];
    const el = document.getElementById('egitimListesi');
    if (!liste.length) { el.innerHTML = '<p class="bos-alan">Henüz eğitim bilgisi eklenmedi.</p>'; return; }
    el.innerHTML = liste.map((e, i) => `
        <div class="zaman-item">
            <div class="zaman-ikon">🎓</div>
            <div class="zaman-bilgi">
                <div class="zaman-baslik">${e.okul}</div>
                <div class="zaman-alt">${e.bolum || ''}</div>
                <div class="zaman-sure">${e.baslangic || ''} ${e.bitis ? '— ' + e.bitis : ''}</div>
                ${e.aciklama ? `<div class="zaman-aciklama">${e.aciklama}</div>` : ''}
            </div>
            <button class="zaman-sil" onclick="egitimSil(${i})">🗑️</button>
        </div>
    `).join('');
}
window.egitimSil = function(i) {
    const pd = profilGetir(); pd.egitim.splice(i, 1); profilKaydet(pd); egitimYukle(); profilTamamlamaHesapla(); toast('🗑️ Eğitim silindi.');
};
document.getElementById('egitimEkleBtn').addEventListener('click', () => {
    document.getElementById('egitimForm').style.display = 'block';
    document.getElementById('egitimEkleBtn').style.display = 'none';
});
document.getElementById('egitimIptal').addEventListener('click', () => {
    document.getElementById('egitimForm').style.display = 'none';
    document.getElementById('egitimEkleBtn').style.display = '';
});
document.getElementById('egitimKaydet').addEventListener('click', () => {
    const okul = document.getElementById('fEgitimOkul').value.trim();
    if (!okul) { toast('⚠️ Okul adı zorunludur!'); return; }
    const pd = profilGetir();
    if (!pd.egitim) pd.egitim = [];
    pd.egitim.push({ okul, bolum: document.getElementById('fEgitimBolum').value.trim(), baslangic: document.getElementById('fEgitimBaslangic').value.trim(), bitis: document.getElementById('fEgitimBitis').value.trim(), aciklama: document.getElementById('fEgitimAciklama').value.trim() });
    profilKaydet(pd);
    ['fEgitimOkul','fEgitimBolum','fEgitimBaslangic','fEgitimBitis','fEgitimAciklama'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('egitimForm').style.display = 'none';
    document.getElementById('egitimEkleBtn').style.display = '';
    egitimYukle(); profilTamamlamaHesapla(); toast('✅ Eğitim eklendi!');
});

// ── Deneyim ───────────────────────────────────────────
function deneyimYukle() {
    const pd = profilGetir();
    const liste = pd.deneyim || [];
    const el = document.getElementById('deneyimListesi');
    if (!liste.length) { el.innerHTML = '<p class="bos-alan">Henüz iş deneyimi eklenmedi.</p>'; return; }
    el.innerHTML = liste.map((d, i) => `
        <div class="zaman-item">
            <div class="zaman-ikon">💼</div>
            <div class="zaman-bilgi">
                <div class="zaman-baslik">${d.pozisyon}</div>
                <div class="zaman-alt">${d.sirket}</div>
                <div class="zaman-sure">${d.baslangic || ''} ${d.bitis ? '— ' + d.bitis : ''}</div>
                ${d.aciklama ? `<div class="zaman-aciklama">${d.aciklama}</div>` : ''}
            </div>
            <button class="zaman-sil" onclick="deneyimSil(${i})">🗑️</button>
        </div>
    `).join('');
}
window.deneyimSil = function(i) {
    const pd = profilGetir(); pd.deneyim.splice(i, 1); profilKaydet(pd); deneyimYukle(); toast('🗑️ Deneyim silindi.');
};
document.getElementById('deneyimEkleBtn').addEventListener('click', () => {
    document.getElementById('deneyimForm').style.display = 'block';
    document.getElementById('deneyimEkleBtn').style.display = 'none';
});
document.getElementById('deneyimIptal').addEventListener('click', () => {
    document.getElementById('deneyimForm').style.display = 'none';
    document.getElementById('deneyimEkleBtn').style.display = '';
});
document.getElementById('deneyimKaydet').addEventListener('click', () => {
    const poz = document.getElementById('fDeneyimPozisyon').value.trim();
    const sir = document.getElementById('fDeneyimSirket').value.trim();
    if (!poz || !sir) { toast('⚠️ Pozisyon ve şirket zorunludur!'); return; }
    const pd = profilGetir();
    if (!pd.deneyim) pd.deneyim = [];
    pd.deneyim.push({ pozisyon: poz, sirket: sir, baslangic: document.getElementById('fDeneyimBaslangic').value.trim(), bitis: document.getElementById('fDeneyimBitis').value.trim(), aciklama: document.getElementById('fDeneyimAciklama').value.trim() });
    profilKaydet(pd);
    ['fDeneyimPozisyon','fDeneyimSirket','fDeneyimBaslangic','fDeneyimBitis','fDeneyimAciklama'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('deneyimForm').style.display = 'none';
    document.getElementById('deneyimEkleBtn').style.display = '';
    deneyimYukle(); toast('✅ Deneyim eklendi!');
});

// ── Beceriler ─────────────────────────────────────────
const seviyeLabels = { 1:'Başlangıç', 2:'Temel', 3:'Orta', 4:'İyi', 5:'Uzman' };

function beceriYukle() {
    const pd = profilGetir();
    const el = document.getElementById('goBeceriler');
    const detay = pd.becerilerDetay || [];
    const duzListe = pd.beceriler || [];

    if (!detay.length && !duzListe.length) {
        el.innerHTML = '<span class="bos-alan">Henüz beceri eklenmedi.</span>'; return;
    }

    if (detay.length) {
        el.innerHTML = detay.map(b => `
            <div class="beceri-seviyeli">
                <span class="beceri-tag">${b.ad}</span>
                <div class="beceri-bar-wrap">
                    ${[1,2,3,4,5].map(n => `<div class="beceri-bar-daire ${n <= b.seviye ? 'dolu' : ''}"></div>`).join('')}
                    <span class="beceri-seviye-yazi">${seviyeLabels[b.seviye] || ''}</span>
                </div>
            </div>
        `).join('');
    } else {
        el.innerHTML = duzListe.map(b => `<span class="beceri-tag">${b}</span>`).join('');
    }
}

// Beceri düzenleme — inline liste sistemi
let profilBeceriDuzenMod = false;

document.getElementById('beceriDuzenleBtn').addEventListener('click', () => {
    if (profilBeceriDuzenMod) return;
    profilBeceriDuzenMod = true;
    const pd = profilGetir();
    const detay = pd.becerilerDetay || (pd.beceriler || []).map(ad => ({ ad, seviye: 3 }));

    // Düzenleme alanını kullan (çift ID sorununu önlemek için)
    const el = document.getElementById('beceriDuzenAlan');
    el.innerHTML = detay.map((b, i) => `
        <div class="beceri-duzen-satir" data-index="${i}">
            <span class="beceri-duzen-adi">${b.ad}</span>
            <div class="beceri-duzen-seviye">
                ${[1,2,3,4,5].map(n => `
                    <button class="seviye-mini ${n <= b.seviye ? 'aktif' : ''}"
                        onclick="beceriSeviyeDegistir(${i}, ${n})" title="${seviyeLabels[n]}">${n}</button>
                `).join('')}
                <span class="seviye-mini-yazi" id="bsv-${i}">${seviyeLabels[b.seviye]}</span>
            </div>
            <button class="beceri-sil-btn" onclick="profilBeceriSil(${i})">🗑️</button>
        </div>
    `).join('') + `
        <div class="beceri-yeni-ekle">
            <input type="text" id="yeniBeceriAd" placeholder="Yeni beceri ekle...">
            <div class="beceri-yeni-seviye">
                ${[1,2,3,4,5].map(n => `
                    <button class="seviye-mini" id="ybs-${n}"
                        onclick="yeniBeceriSeviyeSec(${n})">${n}</button>
                `).join('')}
            </div>
            <button class="btn-kaydet" onclick="yeniBeceriEkle()" style="padding:6px 14px;font-size:12px;">+ Ekle</button>
        </div>
    `;

    document.getElementById('beceriForm').style.display = 'block';
    document.getElementById('beceriDuzenleBtn').style.display = 'none';
    document.getElementById('beceriDuzenleBtn').textContent = '✏️';
    // Yeni beceri için varsayılan seviye
    window._yeniBeceriSeviye = 3;
    document.getElementById('ybs-3').classList.add('aktif');
});

window.beceriSeviyeDegistir = function(i, seviye) {
    const pd = profilGetir();
    const detay = pd.becerilerDetay || (pd.beceriler || []).map(ad => ({ ad, seviye: 3 }));
    detay[i].seviye = seviye;
    pd.becerilerDetay = detay;
    pd.beceriler = detay.map(b => b.ad);
    profilKaydet(pd);
    // Butonları güncelle
    const satir = document.querySelector(`.beceri-duzen-satir[data-index="${i}"]`);
    if (satir) {
        satir.querySelectorAll('.seviye-mini').forEach((btn, idx) => {
            btn.classList.toggle('aktif', idx + 1 <= seviye);
        });
        const yazi = document.getElementById(`bsv-${i}`);
        if (yazi) yazi.textContent = seviyeLabels[seviye];
    }
    toast('✅ Seviye güncellendi!');
};

window.profilBeceriSil = function(i) {
    const pd = profilGetir();
    const detay = pd.becerilerDetay || (pd.beceriler || []).map(ad => ({ ad, seviye: 3 }));
    detay.splice(i, 1);
    pd.becerilerDetay = detay;
    pd.beceriler = detay.map(b => b.ad);
    profilKaydet(pd);
    // Sayfayı yeniden render et
    document.getElementById('beceriDuzenleBtn').style.display = '';
    profilBeceriDuzenMod = false;
    document.getElementById('beceriForm').style.display = 'none';
    beceriYukle();
    document.getElementById('beceriDuzenleBtn').click();
};

window.yeniBeceriSeviyeSec = function(seviye) {
    window._yeniBeceriSeviye = seviye;
    [1,2,3,4,5].forEach(n => {
        const btn = document.getElementById(`ybs-${n}`);
        if (btn) btn.classList.toggle('aktif', n <= seviye);
    });
};

window.yeniBeceriEkle = function() {
    const ad = document.getElementById('yeniBeceriAd').value.trim();
    if (!ad) return;
    const pd = profilGetir();
    const detay = pd.becerilerDetay || (pd.beceriler || []).map(b => ({ ad: b, seviye: 3 }));
    if (detay.find(b => b.ad.toLowerCase() === ad.toLowerCase())) {
        toast('⚠️ Bu beceri zaten var!'); return;
    }
    detay.push({ ad, seviye: window._yeniBeceriSeviye || 3 });
    pd.becerilerDetay = detay;
    pd.beceriler = detay.map(b => b.ad);
    profilKaydet(pd);
    // Formu yenile
    document.getElementById('beceriDuzenleBtn').style.display = '';
    profilBeceriDuzenMod = false;
    document.getElementById('beceriForm').style.display = 'none';
    beceriYukle();
    document.getElementById('beceriDuzenleBtn').click();
    toast('✅ Beceri eklendi!');
};

document.getElementById('beceriIptal').addEventListener('click', () => {
    profilBeceriDuzenMod = false;
    document.getElementById('beceriForm').style.display = 'none';
    document.getElementById('beceriDuzenleBtn').style.display = '';
    beceriYukle();
});

// beceriKaydet butonu artık kullanılmıyor ama hata vermesin
document.getElementById('beceriKaydet').addEventListener('click', () => {
    profilBeceriDuzenMod = false;
    document.getElementById('beceriForm').style.display = 'none';
    document.getElementById('beceriDuzenleBtn').style.display = '';
    beceriYukle(); profilTamamlamaHesapla(); toast('✅ Beceriler kaydedildi!');
});

// ── Yabancı Diller ────────────────────────────────────
const dilSeviyeLabels = { 1:'Başlangıç (A1)', 2:'Temel (A2-B1)', 3:'Orta (B2)', 4:'İyi (C1)', 5:'Akıcı (C2)' };

function dilYukle() {
    const pd = profilGetir();
    const liste = pd.diller || [];
    const el = document.getElementById('dilListesi');
    if (!liste.length) { el.innerHTML = '<p class="bos-alan">Henüz yabancı dil eklenmedi.</p>'; return; }
    el.innerHTML = liste.map((d, i) => `
        <div class="zaman-item">
            <div class="zaman-ikon">🌍</div>
            <div class="zaman-bilgi">
                <div class="zaman-baslik">${d.ad}</div>
                <div class="beceri-bar-wrap" style="margin-top:4px;">
                    ${[1,2,3,4,5].map(n => `<div class="beceri-bar-daire ${n <= d.seviye ? 'dolu-yesil' : ''}"></div>`).join('')}
                    <span class="beceri-seviye-yazi">${dilSeviyeLabels[d.seviye] || ''}</span>
                </div>
            </div>
            <button class="zaman-sil" onclick="dilSil(${i})">🗑️</button>
        </div>
    `).join('');
}
window.dilSil = function(i) {
    const pd = profilGetir(); pd.diller.splice(i, 1); profilKaydet(pd); dilYukle(); toast('🗑️ Dil silindi.');
};
document.getElementById('dilEkleBtn').addEventListener('click', () => {
    document.getElementById('dilForm').style.display = 'block';
    document.getElementById('dilEkleBtn').style.display = 'none';
});
document.getElementById('dilIptal').addEventListener('click', () => {
    document.getElementById('dilForm').style.display = 'none';
    document.getElementById('dilEkleBtn').style.display = '';
});
document.getElementById('dilKaydet').addEventListener('click', () => {
    const ad     = document.getElementById('fDilAd').value;
    const seviye = parseInt(document.getElementById('fDilSeviye').value);
    if (!ad) { toast('⚠️ Dil seçin!'); return; }
    const pd = profilGetir();
    if (!pd.diller) pd.diller = [];
    if (pd.diller.find(d => d.ad === ad)) { toast('⚠️ Bu dil zaten ekli!'); return; }
    pd.diller.push({ ad, seviye });
    profilKaydet(pd);
    document.getElementById('dilForm').style.display = 'none';
    document.getElementById('dilEkleBtn').style.display = '';
    dilYukle(); toast('✅ Dil eklendi!');
});

// ── Sertifikalar ──────────────────────────────────────
function sertifikaYukle() {
    const pd = profilGetir();
    const liste = pd.sertifikalar || [];
    const el = document.getElementById('sertifikaListesi');
    if (!liste.length) { el.innerHTML = '<p class="bos-alan">Henüz sertifika eklenmedi.</p>'; return; }
    el.innerHTML = liste.map((s, i) => `
        <div class="sertifika-item">
            <div class="sert-ikon">🏅</div>
            <div class="sert-bilgi">
                <div class="sert-ad">${s.ad}</div>
                <div class="sert-alt">${s.kurum || ''}${s.tarih ? ' · ' + s.tarih : ''}</div>
            </div>
            <button class="sertifika-sil" onclick="sertifikaSil(${i})">🗑️</button>
        </div>
    `).join('');
}
window.sertifikaSil = function(i) {
    const pd = profilGetir(); pd.sertifikalar.splice(i, 1); profilKaydet(pd); sertifikaYukle(); toast('🗑️ Sertifika silindi.');
};
document.getElementById('sertifikaEkleBtn').addEventListener('click', () => {
    document.getElementById('sertifikaForm').style.display = 'block';
    document.getElementById('sertifikaEkleBtn').style.display = 'none';
});
document.getElementById('sertifikaIptal').addEventListener('click', () => {
    document.getElementById('sertifikaForm').style.display = 'none';
    document.getElementById('sertifikaEkleBtn').style.display = '';
});
document.getElementById('sertifikaKaydet').addEventListener('click', () => {
    const ad = document.getElementById('fSertifikaAd').value.trim();
    if (!ad) { toast('⚠️ Sertifika adı zorunludur!'); return; }
    const pd = profilGetir();
    if (!pd.sertifikalar) pd.sertifikalar = [];
    pd.sertifikalar.push({ ad, kurum: document.getElementById('fSertifikaKurum').value.trim(), tarih: document.getElementById('fSertifikaTarih').value.trim() });
    profilKaydet(pd);
    ['fSertifikaAd','fSertifikaKurum','fSertifikaTarih'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('sertifikaForm').style.display = 'none';
    document.getElementById('sertifikaEkleBtn').style.display = '';
    sertifikaYukle(); toast('✅ Sertifika eklendi!');
});

// ── İstatistikler ─────────────────────────────────────
function istatistikYukle() {
    const basvurular = JSON.parse(localStorage.getItem('basvurular') || '[]');
    const konusmalar = JSON.parse(localStorage.getItem('konusmalar') || '[]');
    const ilanlar    = JSON.parse(localStorage.getItem('ilanlar') || '[]');
    document.getElementById('statBasvuru').textContent = basvurular.length;
    document.getElementById('statMesaj').textContent   = konusmalar.length;
    document.getElementById('statIlan').textContent    = ilanlar.length;
}

// Hamburger: config.js navBaslat() tarafından yönetilir

// ── Sayfa Yüklenirken Profil Bilgilerini API'den Al ──
document.addEventListener('DOMContentLoaded', async () => {
    await profilGetirAPI();
});


// ── Toast ─────────────────────────────────────────────
function toast(mesaj) {
    const t = document.getElementById('toast');
    t.textContent = mesaj; t.classList.add('goster');
    setTimeout(() => t.classList.remove('goster'), 3000);
}

// Logout: config.js logoutBaslat() tarafından yönetilir
// Modal dışı tıklama kapama (profile'a özgü modal)
window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('profil-modal')) document.getElementById('profil-modal').classList.remove('show');
});

// ── İlk Yükleme ───────────────────────────────────────
temelBilgileriYukle();
iletisimYukle();
hakkimdaYukle();
egitimYukle();
deneyimYukle();
beceriYukle();
dilYukle();
sertifikaYukle();
istatistikYukle();
