const API_URL = (typeof CONFIG !== 'undefined') ? CONFIG.AUTH_URL : 'http://localhost:3000/api/auth';

const TOKEN = localStorage.getItem('token') || sessionStorage.getItem('token');

if (!TOKEN) {
    window.location.href = '../giris_ekrani/index.html';
}

// ── Chip seçim state ─────────────────────────────────
const seciliChipler = { isTurleri: [], bolumler: [] };

window.chipSec = function(el, grup) {
    if (el.id === 'tumBolumlerChip') return;
    el.classList.toggle('secili');
    const val = el.dataset.val;
    const arr = seciliChipler[grup];
    const idx = arr.indexOf(val);
    if (idx === -1) arr.push(val);
    else arr.splice(idx, 1);
    // Tüm Bölümler'i kaldır
    if (grup === 'bolumler') {
        document.getElementById('tumBolumlerChip').classList.remove('secili');
        const tumIdx = seciliChipler.bolumler.indexOf('Tüm Bölümler');
        if (tumIdx !== -1) seciliChipler.bolumler.splice(tumIdx, 1);
    }
};

window.chipSecTum = function(el) {
    const bolumChipler = document.querySelectorAll('#bolumlerSecici .chip:not(#tumBolumlerChip)');
    if (el.classList.contains('secili')) {
        el.classList.remove('secili');
        bolumChipler.forEach(c => c.classList.remove('secili'));
        seciliChipler.bolumler = [];
    } else {
        el.classList.add('secili');
        bolumChipler.forEach(c => c.classList.remove('secili'));
        seciliChipler.bolumler = ['Tüm Bölümler'];
    }
};

// ── Adım yönetimi ────────────────────────────────────
const TOPLAM_ADIM = 4;
let aktifAdim = 1;

function ilerlemeGuncelle() {
    const yuzde = (aktifAdim / TOPLAM_ADIM) * 100;
    document.getElementById('ilerlemeDolu').style.width = yuzde + '%';
    document.getElementById('ilerlemeYazi').textContent = aktifAdim + ' / ' + TOPLAM_ADIM;
}

window.ileri = function(adimNo) {
    if (!dogrula(adimNo)) return;
    adimGec(adimNo, adimNo + 1);
};

window.geri = function(adimNo) {
    adimGec(adimNo, adimNo - 1);
};

function adimGec(kaynakAdim, hedefAdim) {
    document.getElementById('adim-' + kaynakAdim).classList.remove('aktif');
    aktifAdim = hedefAdim;
    const hedefEl = document.getElementById('adim-' + hedefAdim);
    hedefEl.classList.add('aktif');
    ilerlemeGuncelle();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (hedefAdim === 4) {
        ozetGuncelle();
    }
}

// ── Validasyon ───────────────────────────────────────
function dogrula(adimNo) {
    if (adimNo === 1) {
        const sirket = document.getElementById('s1SirketAdi').value.trim();
        const sektor = document.getElementById('s1Sektor').value;
        const konum  = document.getElementById('s1Konum').value.trim();
        if (!sirket) { uyar('s1SirketAdi', 'Şirket adı zorunlu.'); return false; }
        if (!sektor)  { uyar('s1Sektor', 'Sektör seçin.'); return false; }
        if (!konum)   { uyar('s1Konum', 'Konum zorunlu.'); return false; }
    }
    return true;
}

function uyar(inputId, mesaj) {
    const el = document.getElementById(inputId);
    el.style.borderColor = '#e53e3e';
    el.focus();
    el.addEventListener('input', () => { el.style.borderColor = ''; }, { once: true });
    alert(mesaj);
}

// ── Özet kartı ───────────────────────────────────────
function ozetGuncelle() {
    const sirket = document.getElementById('s1SirketAdi').value.trim();
    const sektor = document.getElementById('s1Sektor').value;
    const konum  = document.getElementById('s1Konum').value.trim();
    const slogan = document.getElementById('s1Slogan').value.trim();
    const telefon = document.getElementById('s2Telefon').value.trim();
    const website = document.getElementById('s2Website').value.trim();

    const isTurleriStr = seciliChipler.isTurleri.join(', ') || 'Belirtilmedi';
    const bolumlerStr  = seciliChipler.bolumler.join(', ')  || 'Tüm Bölümler';

    document.getElementById('ozetIcerik').innerHTML = `
        <div class="ozet-satir"><span>🏢</span><span><strong>${sirket}</strong> — ${sektor}</span></div>
        <div class="ozet-satir"><span>📍</span><span>${konum}</span></div>
        ${slogan ? `<div class="ozet-satir"><span>💬</span><span>${slogan}</span></div>` : ''}
        ${telefon ? `<div class="ozet-satir"><span>📞</span><span>${telefon}</span></div>` : ''}
        ${website ? `<div class="ozet-satir"><span>🌐</span><span>${website}</span></div>` : ''}
        <div class="ozet-satir"><span>💼</span><span>İş Türleri: ${isTurleriStr}</span></div>
        <div class="ozet-satir"><span>🎓</span><span>Bölümler: ${bolumlerStr}</span></div>
    `;
}

// ── Karakter sayacı ──────────────────────────────────
document.getElementById('s4Hakkinda')?.addEventListener('input', function() {
    const uzunluk = this.value.length;
    const sayac = document.getElementById('karakterSayac');
    if (sayac) {
        sayac.textContent = uzunluk + ' / 400 karakter';
        sayac.style.color = uzunluk > 400 ? '#e53e3e' : '#a0aec0';
    }
});

// ── Atla butonu ──────────────────────────────────────
document.getElementById('atlaBtn')?.addEventListener('click', () => {
    if (confirm('Profili daha sonra tamamlamak istediğinizden emin misiniz?')) {
        window.location.href = '../isveren/isveren.html';
    }
});

// ── Tamamla ──────────────────────────────────────────
document.getElementById('tamamlaBtn')?.addEventListener('click', async () => {
    const hakkinda = document.getElementById('s4Hakkinda').value.trim();
    if (hakkinda.length > 400) {
        alert('Şirket hakkında metni 400 karakteri geçemez.');
        return;
    }

    const veri = {
        // Profil-tamamla endpoint'i için zorunlu alanlar
        ad:    document.getElementById('s1SirketAdi').value.trim(),
        soyad: 'İşveren',  // placeholder — backend zorunlu kılıyor
        tip:   'isveren',

        // İşveren alanları
        sirketAdi: document.getElementById('s1SirketAdi').value.trim(),
        unvan:     document.getElementById('s1Sektor').value,
        konum:     document.getElementById('s1Konum').value.trim(),
        hakkimda:  hakkinda,
        iletisim: {
            telefon:  document.getElementById('s2Telefon').value.trim(),
            linkedin: document.getElementById('s2Linkedin').value.trim(),
            web:      document.getElementById('s2Website').value.trim()
        },
        isTurleri:  seciliChipler.isTurleri,
        bolumler:   seciliChipler.bolumler,
        slogan:     document.getElementById('s1Slogan').value.trim(),
        calisanSayisi: document.getElementById('s1CalisanSayisi').value,
        adres:      document.getElementById('s2Adres').value.trim(),
    };

    const btn = document.getElementById('tamamlaBtn');
    btn.disabled = true;
    btn.textContent = 'Kaydediliyor...';

    try {
        const yanit = await fetch(`${API_URL}/profil-tamamla`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + TOKEN
            },
            body: JSON.stringify(veri)
        });
        const sonuc = await yanit.json();

        if (sonuc.basarili) {
            localStorage.setItem('profilTamamlandi', 'true');
            const kullanici = JSON.parse(localStorage.getItem('kullanici') || '{}');
            Object.assign(kullanici, sonuc.kullanici || {}, { profilTamamlandi: true });
            localStorage.setItem('kullanici', JSON.stringify(kullanici));

            // Bitti ekranı göster
            document.getElementById('adim-4').classList.remove('aktif');
            document.getElementById('adim-bitti').classList.add('aktif');
            document.getElementById('ilerlemeDolu').style.width = '100%';
            document.getElementById('ilerlemeYazi').textContent = '✓ Tamamlandı';
        } else {
            alert(sonuc.mesaj || 'Bir hata oluştu. Lütfen tekrar deneyin.');
            btn.disabled = false;
            btn.textContent = '🚀 Profili Tamamla!';
        }
    } catch (e) {
        console.error(e);
        alert('Sunucuya ulaşılamıyor. Lütfen tekrar deneyin.');
        btn.disabled = false;
        btn.textContent = '🚀 Profili Tamamla!';
    }
});

// Başlangıç ilerleme
ilerlemeGuncelle();
