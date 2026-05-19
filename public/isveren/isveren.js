const API_URL = (typeof CONFIG !== 'undefined') ? CONFIG.API_URL : 'http://localhost:3000/api';

// Auth kontrolü — sadece işveren girebilir
(async function() {
    const kullanici = JSON.parse(localStorage.getItem('kullanici') || '{}');
    try {
        const res = await fetch(CONFIG.AUTH_URL + '/ben', { credentials: 'include' });
        const veri = await res.json();
        if (!veri.basarili) { window.location.href = '../giris_ekrani/index.html'; return; }
        if (!kullanici.rol?.includes('isveren')) { window.location.href = '../dashboard/dashboard.html'; }
    } catch(e) {
        // ağ hatası durumunda yönlendirilmeyebilir
    }
})();

document.addEventListener('DOMContentLoaded', () => { navBaslat(); });

// ── Kullanıcı & UI ────────────────────────────────────
// cookie-based auth; no local token required
const token = null;
let kullanici = JSON.parse(localStorage.getItem('kullanici') || '{}');

function aktifSirketAdi() {
    return (kullanici.sirketAdi || kullanici.isim || '').trim();
}

function normMetin(val) {
    return String(val || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function selectDegeriAyarla(selectEl, hamDeger, esAnlamliMap = {}) {
    if (!selectEl || !hamDeger) return false;

    const adaylar = [hamDeger];
    const normHam = normMetin(hamDeger);
    if (esAnlamliMap[normHam]) adaylar.push(esAnlamliMap[normHam]);

    for (const aday of adaylar) {
        const normAday = normMetin(aday);
        for (const opt of selectEl.options) {
            if (normMetin(opt.value) === normAday || normMetin(opt.text) === normAday) {
                selectEl.value = opt.value;
                return true;
            }
        }
    }

    return false;
}

document.getElementById('bugunTarih').textContent = new Date().toLocaleDateString('tr-TR', { weekday:'long', day:'numeric', month:'long' });

// Backend'den güncel profili çek, UI'ı güncelle
(async function profilYukle() {
    try {
        const res = await fetch(CONFIG.API_URL + '/profil/ben', { credentials: 'include' });
        const veri = await res.json();
        if (veri.basarili && veri.profil) {
            const p = veri.profil;
            // localStorage'ı güncelle
            kullanici = { ...kullanici, ...p };
            localStorage.setItem('kullanici', JSON.stringify(kullanici));

            const gosterimAdi = (p.sirketAdi || p.isim || '').trim();
            const ad = gosterimAdi || 'İşveren';
            document.getElementById('topAdi').textContent       = ad;
            document.getElementById('topAvatar').textContent    = ad.charAt(0).toUpperCase();
            document.getElementById('hosgeldinAdi').textContent = gosterimAdi || 'İşveren';
        }
    } catch(e) {
        // Hata olursa localStorage'dan göster
        const ad = aktifSirketAdi() || 'İşveren';
        document.getElementById('topAdi').textContent       = ad;
        document.getElementById('topAvatar').textContent    = ad.charAt(0).toUpperCase();
        document.getElementById('hosgeldinAdi').textContent = ad;
    }
})();

// ── Global State (Veritabanından Gelenler) ────────────
let isverenIlanlar = [];
let isverenBasvurular = [];
let tumKonusmalar = [];
let isvAktifKarsiId = null;

// ── Verileri Backend'den Çek ──────────────────────────
async function verileriYukle() {
    try {
        // İlanları Çek
const resIlanlar = await fetch(`${API_URL}/ilanlar/benimkiler`, { credentials: 'include' });
        const veriIlanlar = await resIlanlar.json();
        if (veriIlanlar.basarili) isverenIlanlar = veriIlanlar.ilanlar;

        // Başvuruları Çek
        const resBasvuru = await fetch(`${API_URL}/basvurular/isveren`, { credentials: 'include' });
        const veriBasvuru = await resBasvuru.json();
        if (veriBasvuru.basarili) isverenBasvurular = veriBasvuru.basvurular;

        // Mesajları Çek
        const resMesaj = await fetch(`${API_URL}/mesajlar/konusmalar`, { credentials: 'include' });
        const veriMesaj = await resMesaj.json();
        if (veriMesaj.basarili) {
            tumKonusmalar = veriMesaj.konusmalar;
            if (document.getElementById('sayfa-mesajlar').classList.contains('aktif')) {
                isvKonusmaListesiRender(document.getElementById('isvMesajAra').value);
                if (isvAktifKarsiId) isvKonusmaAc(isvAktifKarsiId, false);
            }
        }

        // Ekranı güncelle
        const aktifSayfa = document.querySelector('.nav-link.aktif')?.dataset.sayfa || 'dashboard';
        if(aktifSayfa === 'dashboard') dashboardYukle();
        if(aktifSayfa === 'ilanlar') ilanListesiYukle();
        if(aktifSayfa === 'basvurular') basvuruListesiYukle();

    } catch (err) {
        console.error("Veri yükleme hatası:", err);
    }
}

// ── Yardımcılar ───────────────────────────────────────
const turLabel   = { tam:'Tam Zamanlı', yari:'Yarı Zamanlı', staj:'Staj', uzaktan:'Uzaktan' };
const durumLabel = { beklemede:'⏳ Beklemede', gorusme:'🤝 Görüşme', kabul:'✅ Kabul', reddedildi:'❌ Reddedildi' };
function tarihFmt(t) { return new Date(t).toLocaleDateString('tr-TR', { day:'numeric', month:'short', year:'numeric' }); }
function saatFmt(t)  { return new Date(t).toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' }); }
function basvuranAd(b) { return b.basvuran ? `${b.basvuran.isim || ''} ${b.basvuran.soyisim || ''}`.trim() || 'Aday' : 'Aday'; }
function tamAd(kisi) { return `${kisi.isim || ''} ${kisi.soyisim || ''}`.trim() || kisi.email || 'Kullanıcı'; }

function toast(mesaj) {
    const t = document.getElementById('toast');
    t.textContent = mesaj; t.classList.add('goster');
    setTimeout(() => t.classList.remove('goster'), 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text || '');
    return div.innerHTML;
}

// ── Sayfa Geçişi ──────────────────────────────────────
const basliklar = { dashboard:'Ana Sayfa', ilanlar:'İlanlarım', 'ilan-ekle':'İlan Ekle', basvurular:'Gelen Başvurular', mesajlar:'Mesajlar', ayarlar:'Hesap' };

function sayfaGec(hedef) {
    document.querySelectorAll('.sayfa').forEach(s => s.classList.remove('aktif'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('aktif'));
    document.getElementById(`sayfa-${hedef}`).classList.add('aktif');
    
    const seciliLink = document.querySelector(`[data-sayfa="${hedef}"]`);
    if(seciliLink) seciliLink.classList.add('aktif');
    
    document.getElementById('sayfaBaslik').textContent = basliklar[hedef] || hedef;

    if (hedef === 'dashboard')   dashboardYukle();
    if (hedef === 'ilanlar')     ilanListesiYukle();
    if (hedef === 'basvurular')  basvuruListesiYukle();
    if (hedef === 'mesajlar')    isvKonusmaListesiRender();
    if (hedef === 'ilan-ekle' && !duzenlenenId) ilanFormSifirla();
    if (hedef === 'ayarlar')     ayarlarYukle();

    document.getElementById('sidebar').classList.remove('acik');
}

document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        duzenlenenId = null; 
        sayfaGec(link.dataset.sayfa);
    });
});

// ── Dashboard ─────────────────────────────────────────
function dashboardYukle() {
    document.getElementById('toplamIlanSayi').textContent    = isverenIlanlar.length;
    document.getElementById('toplamBasvuruSayi').textContent = isverenBasvurular.length;
    document.getElementById('bekleyenSayi').textContent      = isverenBasvurular.filter(b => b.durum === 'beklemede').length;
    document.getElementById('aktifIlanSayi').textContent     = isverenIlanlar.filter(i => i.aktifMi).length;

    const sonIlanEl = document.getElementById('dashSonIlanlar');
    if (!isverenIlanlar.length) {
        sonIlanEl.innerHTML = '<div class="yukleniyor">Henüz ilan yok. <button class="link-btn" onclick="sayfaGec(\'ilan-ekle\')">İlan ekle →</button></div>';
    } else {
        sonIlanEl.innerHTML = isverenIlanlar.slice(0,4).map(i => `
            <div class="mini-satir" onclick="sayfaGec('ilanlar')">
                <div class="mini-avatar">${escapeHtml((i.sirket || '').charAt(0).toUpperCase() || 'İ')}</div>
                <div class="mini-bilgi">
                    <div class="mini-baslik">${escapeHtml(i.pozisyon)}</div>
                    <div class="mini-alt">${escapeHtml(i.konum || '')} · ${escapeHtml(turLabel[i.tur] || '')}</div>
                </div>
                <span class="mini-badge ${i.aktifMi ? 'durum-kabul' : 'durum-beklemede'}">${i.aktifMi ? 'Aktif' : 'Pasif'}</span>
            </div>
        `).join('');
    }

    const sonBsEl = document.getElementById('dashSonBasvurular');
    if (!isverenBasvurular.length) {
        sonBsEl.innerHTML = '<div class="yukleniyor">Henüz başvuru yok.</div>';
    } else {
        sonBsEl.innerHTML = isverenBasvurular.slice(0,4).map(b => `
            <div class="mini-satir" onclick="sayfaGec('basvurular')">
                <div class="mini-avatar" style="background:linear-gradient(135deg,#38a169,#48bb78)">${basvuranAd(b).charAt(0)}</div>
                <div class="mini-bilgi">
                    <div class="mini-baslik">${escapeHtml(basvuranAd(b))}</div>
                    <div class="mini-alt">${escapeHtml(b.ilan?.pozisyon || 'İlan Silinmiş')}</div>
                </div>
                <span class="mini-badge durum-${b.durum}">${durumLabel[b.durum]}</span>
            </div>
        `).join('');
    }
}

// ── İlan Listesi ──────────────────────────────────────
function ilanListesiYukle() {
    let ilanlar = [...isverenIlanlar];
    const arama = document.getElementById('ilanArama').value.toLowerCase();
    const dFiltre = document.getElementById('ilanDurumFiltre').value;

    if (arama) ilanlar = ilanlar.filter(i => i.pozisyon.toLowerCase().includes(arama));
    if (dFiltre) ilanlar = ilanlar.filter(i => (dFiltre === 'aktif' ? i.aktifMi : !i.aktifMi));

    const liste = document.getElementById('ilanListesi');
    const bosEl = document.getElementById('ilanBos');

    if (!ilanlar.length) { liste.innerHTML = ''; bosEl.style.display = 'block'; return; }
    bosEl.style.display = 'none';

    liste.innerHTML = ilanlar.map(i => {
        const bSayisi = isverenBasvurular.filter(b => b.ilan?._id === i._id).length;
        return `
        <div class="ilan-satir">
            <div class="ilan-logo">${(aktifSirketAdi() || 'İ').charAt(0).toUpperCase()}</div>
            <div class="ilan-bilgi">
                <div class="ilan-pozisyon">${escapeHtml(i.pozisyon)}</div>
                <div class="ilan-meta-row">
                    <span class="meta-chip">📍 ${escapeHtml(i.konum || 'Belirtilmemiş')}</span>
                    <span class="meta-chip">💼 ${escapeHtml(turLabel[i.tur] || '')}</span>
                    <span class="meta-chip">📅 ${tarihFmt(i.olusturmaTarihi)}</span>
                </div>
            </div>
            <div class="ilan-sag">
                <button class="basvuru-sayac" onclick="sayfaGecBasvuruFiltre('${i._id}')">${bSayisi} Başvuru</button>
                <button class="durum-toggle ${i.aktifMi ? 'durum-aktif' : 'durum-pasif'}" onclick="ilanDurumDegistir('${i._id}', ${!i.aktifMi})">
                    ${i.aktifMi ? '✅ Aktif' : '⏸ Pasif'}
                </button>
                <div class="ilan-aksiyon">
                    <button class="aksiyon-btn" onclick="ilanDuzenle('${i._id}')" title="Düzenle">✏️</button>
                    <button class="aksiyon-btn sil" onclick="ilanSilModal('${i._id}')" title="Sil">🗑️</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

document.getElementById('ilanArama').addEventListener('input', ilanListesiYukle);
document.getElementById('ilanDurumFiltre').addEventListener('change', ilanListesiYukle);

async function ilanDurumDegistir(id, yeniDurum) {
    try {
        const res = await fetch(`${API_URL}/ilanlar/${id}`, {
            method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ aktifMi: yeniDurum })
        });
        if (res.ok) { toast(`İlan ${yeniDurum ? 'aktif' : 'pasif'} yapıldı.`); verileriYukle(); }
    } catch (e) { toast('⚠️ Durum güncellenemedi.'); }
}

let duzenlenenId = null;
function ilanFormSifirla() {
    duzenlenenId = null;
    document.getElementById('ilanFormBaslik').textContent = '➕ Yeni İlan Ekle';
    document.getElementById('ilanKaydet').textContent = '🚀 İlanı Yayınla';
    ['fPozisyon','fKonum','fMaas','fAciklama','fNitelikler','fSonTarih'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('fKategori').value = 'yazilim';
    document.getElementById('fTur').value      = 'tam';
    document.getElementById('fDurum').value    = 'aktif';
}

function ilanDuzenle(id) {
    const ilan = isverenIlanlar.find(i => i._id === id);
    if (!ilan) return;
    duzenlenenId = id;
    sayfaGec('ilan-ekle');
    document.getElementById('ilanFormBaslik').textContent = '✏️ İlanı Düzenle';
    document.getElementById('ilanKaydet').textContent = '💾 Değişiklikleri Kaydet';
    document.getElementById('fPozisyon').value  = ilan.pozisyon;
    document.getElementById('fKonum').value     = ilan.konum || '';
    document.getElementById('fKategori').value  = ilan.kategori || 'yazilim';
    document.getElementById('fTur').value       = ilan.tur;
    document.getElementById('fMaas').value      = ilan.maas || '';
    document.getElementById('fDurum').value     = ilan.aktifMi ? 'aktif' : 'pasif';
    document.getElementById('fAciklama').value  = ilan.aciklama;
    document.getElementById('fNitelikler').value= ilan.nitelikler || '';
    if(ilan.sonTarih) document.getElementById('fSonTarih').value = new Date(ilan.sonTarih).toISOString().split('T')[0];
}

document.getElementById('ilanKaydet').addEventListener('click', async () => {
    const pozisyon = document.getElementById('fPozisyon').value.trim();
    const aciklama = document.getElementById('fAciklama').value.trim();
    if (!pozisyon || !aciklama) { toast('⚠️ Pozisyon ve açıklama zorunludur!'); return; }

    const payload = {
        pozisyon, sirket: aktifSirketAdi() || 'İşveren', konum: document.getElementById('fKonum').value.trim(),
        kategori: document.getElementById('fKategori').value, tur: document.getElementById('fTur').value,
        maas: document.getElementById('fMaas').value.trim(), aktifMi: document.getElementById('fDurum').value === 'aktif',
        aciklama, nitelikler: document.getElementById('fNitelikler').value.trim(), sonTarih: document.getElementById('fSonTarih').value || null
    };

    const url = duzenlenenId ? `${API_URL}/ilanlar/${duzenlenenId}` : `${API_URL}/ilanlar`;
    const method = duzenlenenId ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const veri = await res.json(); // Backend'in gerçek yanıtını okuyoruz
        
        if (res.ok && veri.basarili) {
            toast(duzenlenenId ? '✅ İlan güncellendi!' : '🚀 İlan yayına alındı!');
            ilanFormSifirla(); await verileriYukle(); sayfaGec('ilanlar');
        } else { 
            // Eğer backend bir hata gönderdiyse, tam olarak ne olduğunu ekrana basıyoruz
            toast('⚠️ ' + (veri.mesaj || 'Hata oluştu.')); 
        }
    } catch(e) { 
        toast('⚠️ Sunucuya ulaşılamıyor. Terminali kontrol edin.'); 
    }
});

document.getElementById('ilanFormIptal').addEventListener('click', () => { ilanFormSifirla(); sayfaGec('ilanlar'); });

let silAktifId = null;
window.ilanSilModal = function(id) { silAktifId = id; document.getElementById('ilan-sil-modal').classList.add('show'); }
document.getElementById('ilanSilIptal').addEventListener('click', () => document.getElementById('ilan-sil-modal').classList.remove('show'));
document.getElementById('ilanSilOnayla').addEventListener('click', async () => {
    try {
        const res = await fetch(`${API_URL}/ilanlar/${silAktifId}`, { method: 'DELETE', credentials: 'include' });
        if (res.ok) { document.getElementById('ilan-sil-modal').classList.remove('show'); toast('🗑️ İlan silindi.'); verileriYukle(); }
    } catch (e) { toast('⚠️ Silinemedi.'); }
});

// ── Başvuru Listesi ───────────────────────────────────
let basvuruFiltre = '';
window.sayfaGecBasvuruFiltre = function(ilanId) { basvuruFiltre = ilanId; sayfaGec('basvurular'); }

function basvuruListesiYukle() {
    let basvurular = [...isverenBasvurular];
    if (basvuruFiltre) basvurular = basvurular.filter(b => b.ilan?._id === basvuruFiltre);

    document.getElementById('bfToplam').textContent  = basvurular.length;
    document.getElementById('bfBekleme').textContent = basvurular.filter(b => b.durum === 'beklemede').length;
    document.getElementById('bfGorusme').textContent = basvurular.filter(b => b.durum === 'gorusme').length;
    document.getElementById('bfKabul').textContent   = basvurular.filter(b => b.durum === 'kabul').length;
    document.getElementById('bfRedd').textContent    = basvurular.filter(b => b.durum === 'reddedildi').length;

    const liste = document.getElementById('basvuruListesi');
    const bosEl = document.getElementById('basvuruBos');

    if (!basvurular.length) { liste.innerHTML = ''; bosEl.style.display = 'block'; return; }
    bosEl.style.display = 'none';

    liste.innerHTML = basvurular.map(b => `
        <div class="basvuru-satir">
            <div class="basvuru-avatar">${basvuranAd(b).charAt(0)}</div>
            <div class="basvuru-bilgi">
                <div class="basvuru-adi">${basvuranAd(b)}</div>
                <div class="basvuru-ilan">${b.ilan?.pozisyon || 'İlan Silinmiş'}</div>
                <div class="basvuru-tarih">${tarihFmt(b.basvuruTarihi)} ${b.cvVar ? '📄' : ''}</div>
            </div>
            <button class="durum-badge-btn durum-${b.durum}" onclick="basvuruDurumAc('${b._id}')">${durumLabel[b.durum]}</button>
        </div>
    `).join('');
}

document.querySelectorAll('.bant[data-bf]').forEach(bant => {
    bant.addEventListener('click', () => {
        document.querySelectorAll('.bant[data-bf]').forEach(b => b.classList.remove('aktif-bant'));
        bant.classList.add('aktif-bant');
        const filtre = bant.dataset.bf;
        let basvurular = [...isverenBasvurular];
        if (basvuruFiltre) basvurular = basvurular.filter(b => b.ilan?._id === basvuruFiltre);
        if (filtre) basvurular = basvurular.filter(b => b.durum === filtre);

        const liste = document.getElementById('basvuruListesi');
        if (!basvurular.length) { liste.innerHTML = ''; document.getElementById('basvuruBos').style.display = 'block'; return; }
        document.getElementById('basvuruBos').style.display = 'none';
        liste.innerHTML = basvurular.map(b => `
            <div class="basvuru-satir">
                <div class="basvuru-avatar">${basvuranAd(b).charAt(0)}</div>
                <div class="basvuru-bilgi">
                    <div class="basvuru-adi">${basvuranAd(b)}</div>
                    <div class="basvuru-ilan">${b.ilan?.pozisyon || 'İlan Silinmiş'}</div>
                    <div class="basvuru-tarih">${tarihFmt(b.basvuruTarihi)} ${b.cvVar ? '📄' : ''}</div>
                </div>
                <button class="durum-badge-btn durum-${b.durum}" onclick="basvuruDurumAc('${b._id}')">${durumLabel[b.durum]}</button>
            </div>
        `).join('');
    });
});

let aktifBasvuruId = null;
window.basvuruDurumAc = function(id) {
    aktifBasvuruId = id;
    const b = isverenBasvurular.find(x => x._id === id);
    if (b) {
        let cvHtml = '';
        if (b.cvVar) {
            const href = sanitizeUrl(`${API_URL}/dosya/cv/${b._id}?type=basvuru`);
            cvHtml = `<div style="margin-top:12px;padding-top:12px;border-top:1px solid #e1e5e9;">
                <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:8px 14px;background:#0077b5;color:white;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">📄 CV İndir</a>
            </div>`;
        } else {
            cvHtml = `<div style="margin-top:12px;padding-top:12px;border-top:1px solid #e1e5e9;font-size:12px;color:#718096;">ℹ️ CV dosyası belirtilmemiş</div>`;
        }
        document.getElementById('basvuruDetayBilgi').innerHTML = `<strong>${escapeHtml(basvuranAd(b))}</strong> — ${escapeHtml(b.ilan?.pozisyon || '')}<br>Durum: <strong>${escapeHtml(durumLabel[b.durum])}</strong>${cvHtml}`;
    }
    document.getElementById('bdurum-modal').classList.add('show');
}
document.getElementById('bdurumKapat').addEventListener('click', () => document.getElementById('bdurum-modal').classList.remove('show'));
document.querySelectorAll('.durum-sec').forEach(btn => {
    btn.addEventListener('click', async () => {
        try {
            const res = await fetch(`${API_URL}/basvurular/${aktifBasvuruId}/durum`, {
                method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ durum: btn.dataset.durum })
            });
            if (res.ok) { toast(`✅ Durum güncellendi!`); document.getElementById('bdurum-modal').classList.remove('show'); verileriYukle(); }
        } catch (e) { toast('⚠️ Güncellenemedi.'); }
    });
});

// ── MESAJLAR (YENİ SİSTEM) ─────────────────────────────
function isvKonusmaListesiRender(filtre = '') {
    const liste = document.getElementById('isvKonusmaItems');
    const filtrelenmis = tumKonusmalar.filter(k => tamAd(k.karsiKullanici).toLowerCase().includes(filtre.toLowerCase()));

    if (!filtrelenmis.length) {
        liste.innerHTML = '<div style="padding:24px;text-align:center;color:#a0aec0;font-size:13px;">Konuşma yok</div>';
        return;
    }

    liste.innerHTML = filtrelenmis.map(k => {
        const kisiAdi = tamAd(k.karsiKullanici);
        const sonMesaj = k.sonMesaj || null;
        const aktifCls = String(k.karsiKullanici._id) === String(isvAktifKarsiId) ? 'aktif' : '';
        const onizleme = sonMesaj ? (String(sonMesaj.gonderen) === String(kullanici.id) ? 'Sen: ' : '') + sonMesaj.metin : '';

        return `
            <div class="isv-konusma-item ${aktifCls}" onclick="isvKonusmaAc('${k.karsiKullanici._id}')">
                ${k.okunmadi ? `<span class="isv-k-badge">${k.okunmadi}</span>` : ''}
                <div class="isv-k-ad">${escapeHtml(kisiAdi)}</div>
                <div class="isv-k-son">${escapeHtml(onizleme)}</div>
            </div>
        `;
    }).join('');
}

document.getElementById('isvMesajAra').addEventListener('input', function() { isvKonusmaListesiRender(this.value); });

window.isvKonusmaAc = async function(karsiId, okunduGonder = true) {
    isvAktifKarsiId = karsiId;
    const konusma = tumKonusmalar.find(k => String(k.karsiKullanici._id) === String(karsiId));

    document.getElementById('isvChatBos').style.display = 'none';
    document.getElementById('isvChatAktif').style.display = 'flex';

    const kisiAdi = konusma ? tamAd(konusma.karsiKullanici) : 'Aday';
    document.getElementById('isvChatBaslik').innerHTML = `<span>💬 ${escapeHtml(kisiAdi)}</span>`;

    const alan = document.getElementById('isvMesajlarAlan');
    alan.innerHTML = '<div style="text-align:center;padding:32px;color:#a0aec0;font-size:13px;">Yükleniyor...</div>';

    // Mesajları backend'den çek
    try {
        const res = await fetch(`${API_URL}/mesajlar/${karsiId}/mesajlar`, { credentials: 'include' });
        const data = await res.json();
        if (data.basarili && data.mesajlar && data.mesajlar.length) {
            alan.innerHTML = data.mesajlar.map(m => `
                <div class="isv-msg ${String(m.gonderen._id || m.gonderen) === String(kullanici.id) ? 'giden' : 'gelen'}">
                    <div class="isv-msg-balon">${escapeHtml(m.metin)}</div>
                    <div class="isv-msg-zaman">${saatFmt(m.tarih)}</div>
                </div>
            `).join('');
        } else {
            alan.innerHTML = '<div style="text-align:center;padding:32px;color:#a0aec0;font-size:13px;">Henüz mesaj yok. İlk mesajı gönderin!</div>';
        }
    } catch(e) {
        alan.innerHTML = '<div style="text-align:center;padding:32px;color:#e53e3e;font-size:13px;">Mesajlar yüklenemedi.</div>';
    }

    alan.scrollTop = alan.scrollHeight;
    isvKonusmaListesiRender(document.getElementById('isvMesajAra').value);

    // Okundu işaretle
    if (konusma && konusma.okunmadi > 0 && okunduGonder) {
        konusma.okunmadi = 0;
        try {
            await fetch(`${API_URL}/mesajlar/${karsiId}/okundu`, { method: 'PUT', credentials: 'include' });
        } catch(e) {}
    }
};

async function isvMesajGonder() {
    if (!isvAktifKarsiId) return;
    const input = document.getElementById('isvMesajInput');
    const metin = input.value.trim();
    if (!metin) return;

    input.value = '';
    try {
        const res = await fetch(`${API_URL}/mesajlar/${isvAktifKarsiId}`, {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ metin })
        });
        if (res.ok) await verileriYukle();
    } catch(e) { toast('⚠️ Mesaj gönderilemedi.'); }
}

document.getElementById('isvGonderBtn').addEventListener('click', isvMesajGonder);
document.getElementById('isvMesajInput').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); isvMesajGonder(); } });

// İşveren Yeni Mesaj
document.getElementById('yeniMesajBtn').addEventListener('click', () => {
    if (!isverenBasvurular.length) { toast('⚠️ Henüz ilanlarınıza başvuran bir aday yok.'); return; }
    
    const benzersizAdaylar = [];
    const map = new Map();
    for (const item of isverenBasvurular) {
        if(!map.has(item.basvuran._id)){
            map.set(item.basvuran._id, true);
            benzersizAdaylar.push(item);
        }
    }

    const liste = benzersizAdaylar.map(b =>
        `<div class="isv-konusma-item" onclick="isvKonusmaAc('${b.basvuran._id}'); document.getElementById('isvYeniMesajModal').classList.remove('show');"
             style="cursor:pointer;padding:10px 14px;border-bottom:1px solid #f0f0f0;">
            <div class="isv-k-ad">${basvuranAd(b)}</div>
            <div class="isv-k-son">İlan: ${b.ilan?.pozisyon || ''}</div>
        </div>`
    ).join('');

    document.getElementById('isvYeniMesajListe').innerHTML = liste;
    document.getElementById('isvYeniMesajModal').classList.add('show');
});

// ── Hesap Ayarları & Logout ───────────────────────────
async function ayarlarYukle() {
    document.getElementById('hEmail').value = kullanici.email || '';

    try {
        const res = await fetch(CONFIG.API_URL + '/profil/ben', { credentials: 'include' });
        const veri = await res.json();
        if (!veri.basarili || !veri.profil) return;
        const p = veri.profil;

        // Temel alanlar
        document.getElementById('hEmail').value          = p.email    || '';
        document.getElementById('hSirket').value         = p.sirketAdi || p.isim || '';
        document.getElementById('hSirketAciklama').value = p.hakkimda || '';
        document.getElementById('hWebsite').value        = p.sosyalMedya?.web      || '';
        document.getElementById('hTelefon').value        = p.telefon               || '';
        document.getElementById('hAdres').value          = p.adres                 || '';
        document.getElementById('hCalisanSayisi').value  = p.calisanSayisi || '';

        // Sektör (unvan olarak kaydedildi)
        const sektorEl = document.getElementById('hSektor');
        const sektorEsleme = {
            'bilisim / yazilim': 'Yazılım & Teknoloji',
            'bilişim / yazılım': 'Yazılım & Teknoloji',
            'elektronik / elektrik': 'Üretim & Sanayi',
            'makine / üretim': 'Üretim & Sanayi',
            'makine / uretim': 'Üretim & Sanayi',
            'otomotiv': 'Üretim & Sanayi',
            'gida / tarim': 'Perakende & E-ticaret',
            'gıda / tarım': 'Perakende & E-ticaret',
            'insaat / mimarlik': 'İnşaat',
            'inşaat / mimarlık': 'İnşaat',
            'saglik / biyomedikal': 'Sağlık',
            'sağlık / biyomedikal': 'Sağlık',
            'finans / muhasebe': 'Finans & Bankacılık',
            'lojistik / taşımacılık': 'Lojistik',
            'lojistik / tasimacilik': 'Lojistik',
            'medya / tasarım': 'Diğer',
            'medya / tasarim': 'Diğer',
            'kimya / ilaç': 'Diğer',
            'kimya / ilac': 'Diğer'
        };
        selectDegeriAyarla(sektorEl, p.unvan, sektorEsleme);

        // Geriye dönük destek: eski kayıtlarda çalışan sayısı JSON içinde tutuluyor olabilir
        if (p.egitim && p.egitim[0]?.aciklama) {
            try {
                const detay = JSON.parse(p.egitim[0].aciklama);
                if (!document.getElementById('hCalisanSayisi').value && detay.calisanSayisi) {
                    document.getElementById('hCalisanSayisi').value = detay.calisanSayisi;
                }
                if (detay.website)      document.getElementById('hWebsite').value        = detay.website;
            } catch(e) { /* JSON değilse atla */ }
        }

        const calisanEl = document.getElementById('hCalisanSayisi');
        if (calisanEl && !calisanEl.value) {
            const eskiCalisan = p.egitim?.[0]?.aciklama;
            if (eskiCalisan) {
                try {
                    const detay = JSON.parse(eskiCalisan);
                    selectDegeriAyarla(calisanEl, detay.calisanSayisi);
                } catch(e) { /* JSON değilse atla */ }
            }
        }

    } catch(e) { console.warn('Profil yüklenemedi:', e); }
}

document.getElementById('hesapKaydet').addEventListener('click', async () => {
    const btn = document.getElementById('hesapKaydet');
    btn.disabled = true;
    btn.textContent = 'Kaydediliyor...';

    const sirketAdiVal = document.getElementById('hSirket').value.trim();
    const websiteVal   = document.getElementById('hWebsite').value.trim();
    const adresVal     = document.getElementById('hAdres').value.trim();
    const calisanVal   = document.getElementById('hCalisanSayisi').value;

    const guncelleme = {
        sirketAdi: sirketAdiVal,
        isim:     sirketAdiVal,
        soyisim:  'İşveren',
        unvan:    document.getElementById('hSektor').value,
        hakkimda: document.getElementById('hSirketAciklama').value.trim(),
        telefon:  document.getElementById('hTelefon').value.trim(),
        adres:    adresVal,
        calisanSayisi: calisanVal,
        sosyalMedya: { web: websiteVal },
        egitim: [{
            okul:     sirketAdiVal,
            bolum:    document.getElementById('hSektor').value,
            aciklama: JSON.stringify({
                calisanSayisi: calisanVal,
                website:       websiteVal
            })
        }]
    };

    try {
        const res = await fetch(CONFIG.API_URL + '/profil/guncelle', {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(guncelleme)
        });
        const veri = await res.json();
        if (veri.basarili) {
            const kGuncel = { ...kullanici, ...guncelleme, ...veri.kullanici };
            kullanici = kGuncel;
            localStorage.setItem('kullanici', JSON.stringify(kGuncel));
            toast('✅ Profil kaydedildi');
        } else {
            toast('❌ ' + (veri.mesaj || 'Kayıt başarısız'));
        }
    } catch(e) {
        toast('❌ Sunucuya ulaşılamıyor');
    } finally {
        btn.disabled = false;
        btn.textContent = '💾 Kaydet';
    }
});

// Logout (isveren paneli farklı buton id kullanıyor, config.js logoutBaslat() bunu yönetemez)
// Bu yüzden burada tutuldu ama CONFIG.AUTH_URL kullanılıyor
(function() {
    const cikisBtn   = document.getElementById('cikisBtn');
    const iptalBtn   = document.getElementById('logoutIptal');
    const onayBtn    = document.getElementById('logoutOnayla');
    const modal      = document.getElementById('logout-modal');
    if (!cikisBtn || !modal) return;
    cikisBtn.addEventListener('click', () => modal.classList.add('show'));
    iptalBtn?.addEventListener('click', () => modal.classList.remove('show'));
    onayBtn?.addEventListener('click', async () => {
        try { await fetch(CONFIG.AUTH_URL + '/cikis', { method:'POST', credentials: 'include' }); } catch(e) {}
        ['token','beniHatirla','kullanici','profilTamamlandi'].forEach(k => localStorage.removeItem(k));
        window.location.href = '../giris_ekrani/index.html';
    });
})();
window.addEventListener('click', (e) => {
    ['logout-modal','ilan-sil-modal','bdurum-modal','isvYeniMesajModal'].forEach(id => {
        const m = document.getElementById(id);
        if (e.target === m && m) m.classList.remove('show');
    });
});

// İlk Yükleme
verileriYukle();
setInterval(verileriYukle, 10000);