const API_URL = (typeof CONFIG !== 'undefined') ? CONFIG.API_URL : 'http://localhost:3000/api';

// Auth kontrolü + nav başlat
sayfaAuthKontrol(true);
document.addEventListener('DOMContentLoaded', () => {
    navBaslat();
    logoutBaslat();
    // Yetki Kontrolü: İşveren değilse "İlan Ekle" butonunu gizle
    const kullanici = JSON.parse(localStorage.getItem('kullanici') || '{}');
    const ilanEkleBtn = document.getElementById('ilanEkleBtn');
    if (kullanici.rol && !kullanici.rol.includes('isveren') && ilanEkleBtn) {
        ilanEkleBtn.style.display = 'none';
    }
});

// ── Veri Yönetimi (Backend Entegrasyonu) ──────────────
let tumIlanlar = [];
let basvurulanIlanlar = []; // Kullanıcının başvurduğu ilanların ID'leri

async function verileriYukle() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const kullanici = JSON.parse(localStorage.getItem('kullanici') || '{}');
    
    try {
        // 1. Tüm aktif ilanları getir
        const resIlanlar = await fetch(`${API_URL}/ilanlar`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const veriIlanlar = await resIlanlar.json();
        if (veriIlanlar.basarili) {
            tumIlanlar = veriIlanlar.ilanlar;
        }

        // 2. Eğer kullanıcı işveren değilse, başvurduğu ilanları getir
        if (!kullanici.rol?.includes('isveren')) {
            const resBasvuru = await fetch(`${API_URL}/basvurular/benimkiler`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const veriBasvuru = await resBasvuru.json();
            if (veriBasvuru.basarili) {
                // Sadece ilan ID'lerini bir diziye atıyoruz
                basvurulanIlanlar = veriBasvuru.basvurular.map(b => b.ilan._id);
            }
        }

        filtrele(); // Veriler gelince listele
    } catch (err) {
        console.error("Veriler yüklenirken hata oluştu:", err);
        toastGoster('⚠️ İlanlar sunucudan alınamadı.');
    }
}

// ── Yardımcılar ───────────────────────────────────────
const turEtiketleri = {
    tam: { label: 'Tam Zamanlı', cls: 'tur-tam' },
    yari: { label: 'Yarı Zamanlı', cls: 'tur-yari' },
    staj: { label: 'Staj', cls: 'tur-staj' },
    uzaktan: { label: 'Uzaktan', cls: 'tur-uzaktan' }
};

function tarihFormatla(tarihStr) {
    if (!tarihStr) return '';
    const tarih = new Date(tarihStr);
    return tarih.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function sirketHarfi(sirket) {
    return sirket ? sirket.charAt(0).toUpperCase() : 'İ';
}

function ilanKartiOlustur(ilan) {
    const tur = turEtiketleri[ilan.tur] || { label: ilan.tur, cls: 'tur-tam' };
    const basvuruldu = basvurulanIlanlar.includes(ilan._id);
    const kullanici = JSON.parse(localStorage.getItem('kullanici') || '{}');
    const isverenMi = kullanici.rol?.includes('isveren');

    return `
        <div class="ilan-kart ${basvuruldu ? 'basvuruldu-kart' : ''}" data-id="${ilan._id}" onclick="ilanDetayAc('${ilan._id}')">
            <div class="kart-ust">
                <div class="sirket-logo">${sirketHarfi(ilan.sirket)}</div>
                <div style="display:flex;gap:6px;align-items:center;">
                    ${basvuruldu ? '<span class="basvuruldu-badge">✅ Başvuruldu</span>' : ''}
                    <span class="ilan-tur-badge ${tur.cls}">${tur.label}</span>
                </div>
            </div>
            <div class="ilan-pozisyon">${ilan.pozisyon}</div>
            <div class="ilan-sirket">${ilan.sirket}</div>
            <div class="ilan-meta">
                <span class="meta-chip">📍 ${ilan.konum || 'Belirtilmemiş'}</span>
                ${ilan.maas ? `<span class="meta-chip">💰 ${ilan.maas}</span>` : ''}
            </div>
            <div class="ilan-aciklama">${ilan.aciklama}</div>
            <div class="kart-alt">
                <span class="ilan-tarih">📅 ${tarihFormatla(ilan.olusturmaTarihi)}</span>
                ${isverenMi ? '' : (basvuruldu
                    ? `<span class="basvuruldu-btn">✅ Başvuruldu</span>`
                    : `<button class="basvur-btn" onclick="event.stopPropagation(); basvurYap('${ilan._id}')">Başvur</button>`
                )}
            </div>
        </div>
    `;
}

// ── İlanları Listele ──────────────────────────────────
function ilanlariListele(ilanlar) {
    const grid = document.getElementById('ilanGrid');
    const bos  = document.getElementById('bosDurum');

    if (!ilanlar || !ilanlar.length) {
        grid.innerHTML = '';
        bos.style.display = 'block';
        return;
    }

    bos.style.display = 'none';
    grid.innerHTML = ilanlar.map(ilanKartiOlustur).join('');
}

// ── Filtrele ve Sırala ────────────────────────────────
function filtrele() {
    let ilanlar = [...tumIlanlar];
    const arama     = document.getElementById('aramaInput').value.toLowerCase();
    const kategori  = document.getElementById('kategoriFiltre').value;
    const tur       = document.getElementById('turFiltre').value;
    const sirala    = document.getElementById('siralaFiltre').value;
    const minMaaş   = parseFloat(document.getElementById('minMaasFiltre')?.value) || 0;
    const maxMaaş   = parseFloat(document.getElementById('maxMaasFiltre')?.value) || 999999999;

    // Arama filteresi
    if (arama) {
        ilanlar = ilanlar.filter(i =>
            (i.pozisyon || '').toLowerCase().includes(arama) ||
            (i.sirket || '').toLowerCase().includes(arama) ||
            (i.konum || '').toLowerCase().includes(arama) ||
            (i.aciklama || '').toLowerCase().includes(arama)
        );
    }
    
    // Kategori filtresi
    if (kategori) ilanlar = ilanlar.filter(i => i.kategori === kategori);
    
    // Tür filtresi
    if (tur) ilanlar = ilanlar.filter(i => i.tur === tur);
    
    // Maaş aralığı filtresi
    ilanlar = ilanlar.filter(i => {
        const ilanMaas = parseFloat(i.minMaas) || 0;
        return ilanMaas >= minMaaş && ilanMaas <= maxMaaş;
    });

    // Sıralama
    ilanlar.sort((a, b) => sirala === 'yeni'
        ? new Date(b.olusturmaTarihi) - new Date(a.olusturmaTarihi)
        : new Date(a.olusturmaTarihi) - new Date(b.olusturmaTarihi)
    );

    // Empty state check
    if (ilanlar.length === 0) {
        document.getElementById('ilanListesi').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <div class="empty-state-text">İl an bulunamadı</div>
                <div class="empty-state-desc">Arama kriterlerinizi değiştirip tekrar deneyin</div>
            </div>
        `;
    } else {
        ilanlariListele(ilanlar);
    }
}

document.getElementById('aramaInput')?.addEventListener('input', filtrele);
document.getElementById('kategoriFiltre')?.addEventListener('change', filtrele);
document.getElementById('turFiltre')?.addEventListener('change', filtrele);
document.getElementById('siralaFiltre')?.addEventListener('change', filtrele);
document.getElementById('minMaasFiltre')?.addEventListener('change', filtrele);
document.getElementById('maxMaasFiltre')?.addEventListener('change', filtrele);

// ── İlan Detay ────────────────────────────────────────
let aktifIlanId = null;

window.ilanDetayAc = function(id) {
    const ilan = tumIlanlar.find(i => i._id === id);
    if (!ilan) return;

    aktifIlanId = id;
    const tur = turEtiketleri[ilan.tur] || { label: ilan.tur, cls: 'tur-tam' };
    const kullanici = JSON.parse(localStorage.getItem('kullanici') || '{}');
    const isverenMi = kullanici.rol?.includes('isveren');
    const basvuruldu = basvurulanIlanlar.includes(ilan._id);

    document.getElementById('detayPozisyon').textContent = ilan.pozisyon;
    document.getElementById('detayBody').innerHTML = `
        <div class="detay-sirket-bilgi">
            <div class="detay-logo">${sirketHarfi(ilan.sirket)}</div>
            <div>
                <div class="detay-sirket-adi">${ilan.sirket}</div>
                <div class="detay-konum">📍 ${ilan.konum || 'Belirtilmemiş'}</div>
            </div>
        </div>
        <div class="detay-badges" style="margin-bottom:20px;">
            <span class="detay-badge">${tur.label}</span>
            ${ilan.maas ? `<span class="detay-badge">💰 ${ilan.maas}</span>` : ''}
            <span class="detay-badge">📅 ${tarihFormatla(ilan.olusturmaTarihi)}</span>
        </div>
        <div class="detay-section">
            <h4>İlan Açıklaması</h4>
            <p>${ilan.aciklama}</p>
        </div>
        ${ilan.nitelikler ? `
        <div class="detay-section">
            <h4>Aranan Nitelikler</h4>
            <p>${ilan.nitelikler}</p>
        </div>` : ''}
    `;

    // İşveren ise başvuru butonunu gizle
    const basVurBtn = document.getElementById('basVurBtn');
    if (isverenMi || basvuruldu) {
        basVurBtn.style.display = 'none';
    } else {
        basVurBtn.style.display = 'inline-block';
    }

    document.getElementById('detay-modal').classList.add('show');
}

document.getElementById('detayKapat').addEventListener('click', () => {
    document.getElementById('detay-modal').classList.remove('show');
});
document.getElementById('detayKapatBtn').addEventListener('click', () => {
    document.getElementById('detay-modal').classList.remove('show');
});

// ── Başvur ────────────────────────────────────────────
let cvBase64 = null;
const cvKutu  = document.getElementById('cvYukleKutu');
const cvDosya = document.getElementById('cvDosya');

cvKutu.addEventListener('click', () => cvDosya.click());
cvKutu.addEventListener('dragover', e => { e.preventDefault(); cvKutu.classList.add('surukle'); });
cvKutu.addEventListener('dragleave', () => cvKutu.classList.remove('surukle'));
cvKutu.addEventListener('drop', e => {
    e.preventDefault(); cvKutu.classList.remove('surukle');
    const f = e.dataTransfer.files[0];
    if (f) cvDosyaIsle(f);
});

cvDosya.addEventListener('change', e => {
    if (e.target.files[0]) cvDosyaIsle(e.target.files[0]);
});

function cvDosyaIsle(dosya) {
    if (dosya.type !== 'application/pdf') { toastGoster('⚠️ Sadece PDF yükleyebilirsiniz.'); return; }
    if (dosya.size > 5 * 1024 * 1024) { toastGoster('⚠️ PDF 5 MB\'dan küçük olmalı.'); return; }
    const reader = new FileReader();
    reader.onload = e => {
        cvBase64 = e.target.result;
        document.getElementById('cvYukleKutu').style.display = 'none';
        document.getElementById('cvYuklendi').style.display = 'flex';
        document.getElementById('cvDosyaAdi').textContent = '📄 ' + dosya.name;
    };
    reader.readAsDataURL(dosya);
}

document.getElementById('cvSilBtn').addEventListener('click', () => {
    cvBase64 = null;
    cvDosya.value = '';
    document.getElementById('cvYukleKutu').style.display = 'flex';
    document.getElementById('cvYuklendi').style.display = 'none';
});

window.basvurYap = function(id) {
    aktifIlanId = id;
    if (basvurulanIlanlar.includes(id)) { 
        toastGoster('ℹ️ Bu ilana zaten başvurdunuz.'); 
        return; 
    }

    cvBase64 = null;
    cvDosya.value = '';
    document.getElementById('cvYukleKutu').style.display = 'flex';
    document.getElementById('cvYuklendi').style.display = 'none';
    document.getElementById('basvuruNot').value = '';
    
    document.getElementById('detay-modal').classList.remove('show');
    document.getElementById('basvuru-modal').classList.add('show');
}

document.getElementById('basvuruTamam').addEventListener('click', async () => {
    const ilanId = aktifIlanId;
    const not = document.getElementById('basvuruNot').value.trim();
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');

    try {
        const res = await fetch(`${API_URL}/basvurular/${ilanId}`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ onYazi: not, cvBase64: cvBase64 }) 
        });
        const data = await res.json();

        if (data.basarili) {
            document.getElementById('basvuru-modal').classList.remove('show');
            document.getElementById('basvuru-basari-modal').classList.add('show');
            verileriYukle(); // Listeyi güncelle, başvurduğumuz ilan "Başvuruldu" gözüksün
        } else {
            toastGoster('⚠️ ' + data.mesaj);
        }
    } catch (err) {
        console.error(err);
        toastGoster('⚠️ Başvuru sırasında hata oluştu.');
    }
});

document.getElementById('basVurBtn').addEventListener('click', () => {
    if (aktifIlanId) basvurYap(aktifIlanId);
});

document.getElementById('basvuruIptalBtn').addEventListener('click', () => {
    document.getElementById('basvuru-modal').classList.remove('show');
});
document.getElementById('basvuruModalKapat').addEventListener('click', () => {
    document.getElementById('basvuru-modal').classList.remove('show');
});
document.getElementById('basvuruBasariTamam').addEventListener('click', () => {
    document.getElementById('basvuru-basari-modal').classList.remove('show');
});

// ── İlan Ekle (Sadece İşveren) ────────────────────────
if (document.getElementById('ilanEkleBtn')) {
    document.getElementById('ilanEkleBtn').addEventListener('click', () => {
        document.getElementById('ilan-modal').classList.add('show');
    });
}

document.getElementById('modalKapat').addEventListener('click', () => {
    document.getElementById('ilan-modal').classList.remove('show');
});

document.getElementById('ilanIptal').addEventListener('click', () => {
    document.getElementById('ilan-modal').classList.remove('show');
});

document.getElementById('ilanKaydet').addEventListener('click', async () => {
    const pozisyon  = document.getElementById('pozisyon').value.trim();
    const sirket    = document.getElementById('sirket').value.trim();
    const aciklama  = document.getElementById('aciklama').value.trim();

    if (!pozisyon || !sirket || !aciklama) {
        toastGoster('⚠️ Lütfen zorunlu alanları doldurun (*)');
        return;
    }

    const payload = {
        pozisyon,
        sirket,
        konum:      document.getElementById('konum').value.trim() || 'Belirtilmemiş',
        kategori:   document.getElementById('kategori').value,
        tur:        document.getElementById('isTuru').value,
        maas:       document.getElementById('maas').value.trim(),
        aciklama,
        nitelikler: document.getElementById('nitelikler').value.trim()
    };

    const token = localStorage.getItem('token');
    
    try {
        const res = await fetch(`${API_URL}/ilanlar`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.basarili) {
            toastGoster('✅ İlan başarıyla yayınlandı.');
            // Formu temizle
            ['pozisyon','sirket','konum','maas','aciklama','nitelikler'].forEach(id => {
                document.getElementById(id).value = '';
            });
            document.getElementById('ilan-modal').classList.remove('show');
            verileriYukle(); // Listeyi yenile
        } else {
            toastGoster('⚠️ ' + data.mesaj);
        }
    } catch (err) {
        console.error(err);
        toastGoster('⚠️ İlan yayınlanırken hata oluştu.');
    }
});

// ── Modal dışı tıklama kapatma ───────────────────────
window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('detay-modal')) document.getElementById('detay-modal').classList.remove('show');
    if (e.target === document.getElementById('ilan-modal')) document.getElementById('ilan-modal').classList.remove('show');
    if (e.target === document.getElementById('basvuru-modal')) document.getElementById('basvuru-modal').classList.remove('show');
    if (e.target === document.getElementById('basvuru-basari-modal')) document.getElementById('basvuru-basari-modal').classList.remove('show');
});

// ── Toast ─────────────────────────────────────────────
function toastGoster(mesaj) {
    const t = document.getElementById('toastBildirim');
    if (!t) return;
    t.textContent = mesaj;
    t.classList.add('goster');
    setTimeout(() => t.classList.remove('goster'), 3000);
}

// ── İlk Yükleme ───────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('tip') === 'staj') {
    document.getElementById('turFiltre').value = 'staj';
    toastGoster('🎯 Staj ilanları gösteriliyor');
}
verileriYukle();

