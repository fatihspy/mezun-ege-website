const API_URL = (typeof CONFIG !== 'undefined') ? CONFIG.API_URL : 'http://localhost:3000/api';

// Auth kontrolü — sadece işveren girebilir
(function() {
    const token     = localStorage.getItem('token');
    const kullanici = JSON.parse(localStorage.getItem('kullanici') || '{}');
    if (!token)                              { window.location.href = '../giris_ekrani/index.html'; return; }
    if (!kullanici.rol?.includes('isveren')) { window.location.href = '../dashboard/dashboard.html'; }
})();

document.addEventListener('DOMContentLoaded', () => { navBaslat(); });

// ── Kullanıcı & UI ────────────────────────────────────
const kullanici  = JSON.parse(localStorage.getItem('kullanici') || '{}');
const isverenAdi = kullanici.isim ? `${kullanici.isim} ${kullanici.soyisim || ''}`.trim() : 'İşveren';
const sirketAdi  = JSON.parse(localStorage.getItem('isverenAyarlar') || '{}').sirket || 'Şirketim';

document.getElementById('topAdi').textContent      = isverenAdi;
document.getElementById('topAvatar').textContent   = isverenAdi.charAt(0).toUpperCase();
document.getElementById('hosgeldinAdi').textContent= kullanici.isim || 'İşveren';
document.getElementById('bugunTarih').textContent  = new Date().toLocaleDateString('tr-TR', { weekday:'long', day:'numeric', month:'long' });

// ── Global State (Veritabanından Gelenler) ────────────
let isverenIlanlar = [];
let isverenBasvurular = [];
let tumKonusmalar = [];
let isvAktifKarsiId = null;

// ── Verileri Backend'den Çek ──────────────────────────
async function verileriYukle() {
    const token = localStorage.getItem('token');
    try {
        // İlanları Çek
const resIlanlar = await fetch(`${API_URL}/ilanlar/benimkiler`, { 
    headers: { 'Authorization': `Bearer ${token}` } 
});
        const veriIlanlar = await resIlanlar.json();
        if (veriIlanlar.basarili) isverenIlanlar = veriIlanlar.ilanlar;

        // Başvuruları Çek
        const resBasvuru = await fetch(`${API_URL}/basvurular/isveren`, { headers: { 'Authorization': `Bearer ${token}` } });
        const veriBasvuru = await resBasvuru.json();
        if (veriBasvuru.basarili) isverenBasvurular = veriBasvuru.basvurular;

        // Mesajları Çek
        const resMesaj = await fetch(`${API_URL}/mesajlar/konusmalar`, { headers: { 'Authorization': `Bearer ${token}` } });
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
                <div class="mini-avatar">${i.sirket ? i.sirket.charAt(0).toUpperCase() : 'İ'}</div>
                <div class="mini-bilgi">
                    <div class="mini-baslik">${i.pozisyon}</div>
                    <div class="mini-alt">${i.konum || ''} · ${turLabel[i.tur] || ''}</div>
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
                    <div class="mini-baslik">${basvuranAd(b)}</div>
                    <div class="mini-alt">${b.ilan?.pozisyon || 'İlan Silinmiş'}</div>
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
            <div class="ilan-logo">${sirketAdi.charAt(0).toUpperCase()}</div>
            <div class="ilan-bilgi">
                <div class="ilan-pozisyon">${i.pozisyon}</div>
                <div class="ilan-meta-row">
                    <span class="meta-chip">📍 ${i.konum || 'Belirtilmemiş'}</span>
                    <span class="meta-chip">💼 ${turLabel[i.tur] || ''}</span>
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
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/ilanlar/${id}`, {
            method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
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
        pozisyon, sirket: sirketAdi, konum: document.getElementById('fKonum').value.trim(),
        kategori: document.getElementById('fKategori').value, tur: document.getElementById('fTur').value,
        maas: document.getElementById('fMaas').value.trim(), aktifMi: document.getElementById('fDurum').value === 'aktif',
        aciklama, nitelikler: document.getElementById('fNitelikler').value.trim(), sonTarih: document.getElementById('fSonTarih').value || null
    };

    const token = localStorage.getItem('token');
    const url = duzenlenenId ? `${API_URL}/ilanlar/${duzenlenenId}` : `${API_URL}/ilanlar`;
    const method = duzenlenenId ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, { method, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
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
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/ilanlar/${silAktifId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
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
            const token = localStorage.getItem('token');
            cvHtml = `<div style="margin-top:12px;padding-top:12px;border-top:1px solid #e1e5e9;">
                <a href="${API_URL}/dosya/cv/${b._id}?type=basvuru&token=${token}" target="_blank" style="display:inline-block;padding:8px 14px;background:#0077b5;color:white;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">📄 CV İndir</a>
            </div>`;
        } else {
            cvHtml = `<div style="margin-top:12px;padding-top:12px;border-top:1px solid #e1e5e9;font-size:12px;color:#718096;">ℹ️ CV dosyası belirtilmemiş</div>`;
        }
        document.getElementById('basvuruDetayBilgi').innerHTML = `<strong>${basvuranAd(b)}</strong> — ${b.ilan?.pozisyon || ''}<br>Durum: <strong>${durumLabel[b.durum]}</strong>${cvHtml}`;
    }
    document.getElementById('bdurum-modal').classList.add('show');
}
document.getElementById('bdurumKapat').addEventListener('click', () => document.getElementById('bdurum-modal').classList.remove('show'));
document.querySelectorAll('.durum-sec').forEach(btn => {
    btn.addEventListener('click', async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/basvurular/${aktifBasvuruId}/durum`, {
                method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ durum: btn.dataset.durum })
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
        const sonMesaj = k.mesajlar.length ? k.mesajlar[k.mesajlar.length - 1] : null;
        const aktifCls = k.karsiKullanici._id === isvAktifKarsiId ? 'aktif' : '';
        const onizleme = sonMesaj ? (sonMesaj.gonderen._id === kullanici.id ? 'Sen: ' : '') + sonMesaj.metin : '';

        return `
            <div class="isv-konusma-item ${aktifCls}" onclick="isvKonusmaAc('${k.karsiKullanici._id}')">
                ${k.okunmadi ? `<span class="isv-k-badge">${k.okunmadi}</span>` : ''}
                <div class="isv-k-ad">${kisiAdi}</div>
                <div class="isv-k-son">${onizleme}</div>
            </div>
        `;
    }).join('');
}

document.getElementById('isvMesajAra').addEventListener('input', function() { isvKonusmaListesiRender(this.value); });

window.isvKonusmaAc = async function(karsiId, okunduGonder = true) {
    isvAktifKarsiId = karsiId;
    const konusma = tumKonusmalar.find(k => k.karsiKullanici._id === karsiId);
    
    document.getElementById('isvChatBos').style.display = 'none';
    document.getElementById('isvChatAktif').style.display = 'flex';

    const kisiAdi = konusma ? tamAd(konusma.karsiKullanici) : 'Aday';
    document.getElementById('isvChatBaslik').innerHTML = `<span>💬 ${kisiAdi}</span>`;

    const alan = document.getElementById('isvMesajlarAlan');
    if (!konusma || !konusma.mesajlar.length) {
        alan.innerHTML = '<div style="text-align:center;padding:32px;color:#a0aec0;font-size:13px;">Henüz mesaj yok. İlk mesajı gönderin!</div>';
    } else {
        alan.innerHTML = konusma.mesajlar.map(m => `
            <div class="isv-msg ${(m.gonderen._id || m.gonderen) === kullanici.id ? 'giden' : 'gelen'}">
                <div class="isv-msg-balon">${m.metin}</div>
                <div class="isv-msg-zaman">${saatFmt(m.tarih)}</div>
            </div>
        `).join('');
    }
    alan.scrollTop = alan.scrollHeight;
    isvKonusmaListesiRender(document.getElementById('isvMesajAra').value);

    // Okundu işaretle
    if (konusma && konusma.okunmadi > 0 && okunduGonder) {
        konusma.okunmadi = 0; 
        try {
            const token = localStorage.getItem('token');
            await fetch(`${API_URL}/mesajlar/${karsiId}/okundu`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } });
        } catch(e) {}
    }
};

async function isvMesajGonder() {
    if (!isvAktifKarsiId) return;
    const input = document.getElementById('isvMesajInput');
    const metin = input.value.trim();
    if (!metin) return;

    input.value = '';
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/mesajlar/${isvAktifKarsiId}`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
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
function ayarlarYukle() {
    const ayarlar = JSON.parse(localStorage.getItem('isverenAyarlar') || '{}');
    document.getElementById('hAd').value      = kullanici.isim    || '';
    document.getElementById('hSoyad').value   = kullanici.soyisim || '';
    document.getElementById('hSirket').value  = ayarlar.sirket    || '';
    document.getElementById('hEmail').value   = kullanici.email   || '';
}
document.getElementById('hesapKaydet').addEventListener('click', () => { toast('✅ Kaydedildi'); });

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
        const token = localStorage.getItem('token');
        if (token) {
            try { await fetch(CONFIG.AUTH_URL + '/cikis', { method:'POST', headers:{'Authorization':`Bearer ${token}`} }); } catch(e) {}
            ['token','beniHatirla','kullanici','profilTamamlandi'].forEach(k => localStorage.removeItem(k));
        }
        window.location.href = '../giris_ekrani/index.html';
    });
    document.getElementById('hamburger')?.addEventListener('click', () => document.getElementById('sidebar').classList.toggle('acik'));
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