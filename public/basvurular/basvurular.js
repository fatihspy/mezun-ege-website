const API_URL = (typeof CONFIG !== 'undefined') ? CONFIG.API_URL : 'http://localhost:3000/api';

// Auth + nav
sayfaAuthKontrol(true);
document.addEventListener('DOMContentLoaded', () => { navBaslat(); logoutBaslat(); });

const kullanici = JSON.parse(localStorage.getItem('kullanici') || '{}');

let tumBasvurular = [];
let aktifFiltre = '';

const turLabel = {
    tam: 'Tam Zamanlı',
    yari: 'Yarı Zamanlı',
    staj: 'Staj',
    uzaktan: 'Uzaktan'
};

const durumLabel = {
    beklemede: '⏳ Beklemede',
    gorusme: '🤝 Görüşme',
    kabul: '✅ Kabul',
    reddedildi: '❌ Reddedildi'
};

function tarihFormatla(tarih) {
    if (!tarih) return '-';
    return new Date(tarih).toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

// ── Veri (Backend'den Getir) ──────────────────────────
async function verileriYukle() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/basvurular/benimkiler`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const veri = await res.json();
        
        if (veri.basarili) {
            tumBasvurular = veri.basvurular;
            listele();
        } else {
            console.error(veri.mesaj);
        }
    } catch (err) {
        console.error("Başvurular yüklenirken hata oluştu:", err);
    }
}

// ── Sayaçları Güncelle ────────────────────────────────
function sayacGuncelle() {
    document.getElementById('toplamSayi').textContent   = tumBasvurular.length;
    document.getElementById('beklemeSayi').textContent  = tumBasvurular.filter(x => x.durum === 'beklemede').length;
    document.getElementById('gorSayi').textContent      = tumBasvurular.filter(x => x.durum === 'gorusme').length;
    document.getElementById('kabulSayi').textContent    = tumBasvurular.filter(x => x.durum === 'kabul').length;
    document.getElementById('reddSayi').textContent     = tumBasvurular.filter(x => x.durum === 'reddedildi').length;
}

// ── Listele ───────────────────────────────────────────
function listele() {
    let b = [...tumBasvurular];
    const arama = document.getElementById('aramaInput').value.toLowerCase();
    const sirala= document.getElementById('siralaFiltre').value;

    if (aktifFiltre) b = b.filter(x => x.durum === aktifFiltre);
    
    if (arama) {
        b = b.filter(x => 
            (x.ilan?.pozisyon || '').toLowerCase().includes(arama) || 
            (x.ilan?.sirket || '').toLowerCase().includes(arama)
        );
    }
    
    b.sort((a, c) => sirala === 'yeni' ? new Date(c.basvuruTarihi) - new Date(a.basvuruTarihi) : new Date(a.basvuruTarihi) - new Date(c.basvuruTarihi));

    const liste  = document.getElementById('basvuruListesi');
    const bosDur = document.getElementById('bosDurum');

    if (!b.length) {
        liste.innerHTML = '';
        bosDur.style.display = 'block';
        return;
    }
    
    bosDur.style.display = 'none';

    // Not: Durum ve silme butonları (kullanıcı müdahale edememesi için) kaldırıldı
    liste.innerHTML = b.map(bsv => {
        const sirketAdi = bsv.ilan?.sirket || 'Bilinmiyor';
        const pozisyonAdi = bsv.ilan?.pozisyon || 'Silinmiş İlan';
        const konum = bsv.ilan?.konum || 'Belirtilmemiş';
        const tur = turLabel[bsv.ilan?.tur] || bsv.ilan?.tur || 'Bilinmiyor';

        return `
        <div class="basvuru-kart">
            <div class="kart-logo">${sirketAdi.charAt(0).toUpperCase()}</div>
            <div class="kart-bilgi">
                <div class="kart-pozisyon">${pozisyonAdi}</div>
                <div class="kart-sirket">${sirketAdi}</div>
                <div class="kart-meta">
                    <span class="meta-chip">📍 ${konum}</span>
                    <span class="meta-chip">💼 ${tur}</span>
                    <span class="meta-chip">📅 ${tarihFormatla(bsv.basvuruTarihi)}</span>
                </div>
            </div>
            <div class="kart-sag">
                <span class="durum-badge durum-${bsv.durum}" style="cursor:default;">${durumLabel[bsv.durum]}</span>
                <span class="kart-tarih">${tarihFormatla(bsv.basvuruTarihi)}</span>
            </div>
        </div>
        `;
    }).join('');

    sayacGuncelle();
}

// ── Filtre Bantları ───────────────────────────────────
document.querySelectorAll('.bant').forEach(bant => {
    bant.addEventListener('click', () => {
        document.querySelectorAll('.bant').forEach(b => b.classList.remove('aktif'));
        bant.classList.add('aktif');
        aktifFiltre = bant.dataset.filtre;
        listele();
    });
});

document.getElementById('aramaInput').addEventListener('input', listele);
document.getElementById('siralaFiltre').addEventListener('change', listele);

// ── İlk Yükleme ───────────────────────────────────────
verileriYukle();