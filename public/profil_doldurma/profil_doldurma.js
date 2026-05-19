// Auth kontrolü — token yoksa giriş sayfasına, profil tamansa dashboard'a
(async function() {
    try {
        const res = await fetch(CONFIG.AUTH_URL + '/ben', { credentials: 'include' });
        const veriRes = await res.json();
        if (!veriRes.basarili) {
            window.location.href = '../giris_ekrani/index.html';
            return;
        }
        // Kullanıcı bilgisini güncelle
        localStorage.setItem('kullanici', JSON.stringify(veriRes.kullanici));
        if (veriRes.kullanici.profilTamamlandi) {
            window.location.href = '../dashboard/dashboard.html';
        }
    } catch(e) {
        // Ağ hatası — sadece token yoksa yönlendirilmeyecek
        if (localStorage.getItem('profilTamamlandi') === 'true') {
            window.location.href = '../dashboard/dashboard.html';
        }
    }
})();

// ── State ─────────────────────────────────────────────
let aktifAdim = 1;
const toplamAdim = 5;
const veri = {
    ad: '', soyad: '', unvan: '', konum: '',
    bolum: '', mezYil: '', not: '', bolumAciklama: '',
    deneyimler: [],
    beceriler: [], diller: [], telefon: '', linkedin: '', web: '', github: '',
    hakkimda: '',
    tip: 'mezun' // mezun veya ogrenci
};

// ── Mezun / Öğrenci Seçimi ────────────────────────────
window.tipSec = function(tip) {
    veri.tip = tip;
    document.querySelectorAll('.tip-kart').forEach(k => k.classList.remove('aktif'));
    document.getElementById(`tip-${tip}`).classList.add('aktif');
    
    // Bölüm label'ını tipe göre güncelle
    const bolumLabel = document.getElementById('bolumLabel');
    if (bolumLabel) {
        bolumLabel.textContent = tip === 'ogrenci' ? 'Okuduğun Bölüm *' : 'Mezun Olduğun Bölüm *';
    }
    
    // Eğitim açıklamasını güncelle
    const egitimAciklama = document.getElementById('egitimAciklama');
    if (egitimAciklama) {
        egitimAciklama.textContent = tip === 'ogrenci' ? 'Hangi bölümde okuyorsun?' : 'Hangi bölümden mezun oldun?';
    }
    
    // Mezuniyet yılı label'ını ve Not Ortalaması'nı güncelle
    const mezYilLabel = document.getElementById('mezYilLabel');
    const notLabel = document.getElementById('notLabel');
    const s2Not = document.getElementById('s2Not');
    
    if (tip === 'ogrenci') {
        // Öğrenci seçildi
        if (mezYilLabel) mezYilLabel.textContent = 'Beklenen Mezuniyet Yılı *';
        if (notLabel) notLabel.style.display = 'none';
        if (s2Not) s2Not.style.display = 'none';
    } else {
        // Mezun seçildi
        if (mezYilLabel) mezYilLabel.textContent = 'Mezuniyet Yılı *';
        if (notLabel) notLabel.style.display = 'block';
        if (s2Not) s2Not.style.display = 'block';
    }
};

// ── İlerleme Güncelle ─────────────────────────────────
function ilerlemeGuncelle(adim) {
    const yuzde = (adim / toplamAdim) * 100;
    document.getElementById('ilerlemeDolu').style.width = `${yuzde}%`;
    document.getElementById('ilerlemeYazi').textContent = adim <= toplamAdim ? `${adim} / ${toplamAdim}` : '✓ Tamamlandı';
}

// ── Adım Geçişi ───────────────────────────────────────
function adimGoster(n) {
    document.querySelectorAll('.adim').forEach(a => a.classList.remove('aktif'));
    const hedef = n > toplamAdim ? 'adim-bitti' : `adim-${n}`;
    document.getElementById(hedef).classList.add('aktif');
    ilerlemeGuncelle(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function ileri(adimNo) {
    // Validasyon
    if (adimNo === 1) {
        const ad = document.getElementById('s1Ad').value.trim();
        const soyad = document.getElementById('s1Soyad').value.trim();
        if (!ad || !soyad) { hataGoster('Ad ve soyad zorunludur!'); return; }
        veri.ad    = ad;
        veri.soyad = soyad;
        veri.unvan = document.getElementById('s1Unvan').value.trim();
        veri.konum = document.getElementById('s1Konum').value.trim();
    }
    if (adimNo === 2) {
        const bolum = document.getElementById('s2Bolum').value;
        const yil   = document.getElementById('s2MezYil').value;
        if (!bolum || !yil) { hataGoster('Bölüm ve mezuniyet yılı zorunludur!'); return; }
        veri.bolum          = bolum;
        veri.mezYil         = yil;
        veri.not            = document.getElementById('s2Not').value.trim();
        veri.bolumAciklama  = document.getElementById('s2BolumAciklama').value.trim();
    }
    if (adimNo === 3) {
        // Deneyim zorunlu değil, sadece kaydet
    }
    if (adimNo === 4) {
        // Beceriler ve diller zaten veri objesine canlı ekleniyor
        veri.telefon  = document.getElementById('s4Telefon').value.trim();
        veri.linkedin = document.getElementById('s4Linkedin').value.trim();
        veri.web      = document.getElementById('s4Web').value.trim();
        veri.github   = document.getElementById('s4Github').value.trim();
    }
    if (adimNo === 5) {
        // Özeti göster
        ozetGoster();
    }

    aktifAdim = adimNo + 1;
    adimGoster(aktifAdim);
}

function geri(adimNo) {
    aktifAdim = adimNo - 1;
    adimGoster(aktifAdim);
}

// ── Hata Göster ───────────────────────────────────────
function hataGoster(mesaj) {
    const eskiHata = document.querySelector('.hata-mesaji');
    if (eskiHata) eskiHata.remove();

    const div = document.createElement('div');
    div.className = 'hata-mesaji';
    div.style.cssText = 'background:#fff5f5;color:#e53e3e;border:1px solid #feb2b2;border-radius:10px;padding:10px 14px;font-size:13px;font-weight:600;margin-bottom:16px;';
    div.textContent = '⚠️ ' + mesaj;

    // Aktif adımın ilk çocuğundan sonra ekle (h1'den sonra)
    const aktifAdim = document.querySelector('.adim.aktif');
    const hedef = aktifAdim.querySelector('.adim-aciklama') || aktifAdim.querySelector('h1');
    if (hedef && hedef.nextSibling) {
        aktifAdim.insertBefore(div, hedef.nextSibling);
    } else {
        aktifAdim.prepend(div);
    }

    setTimeout(() => div.remove(), 3000);
}

// ── Deneyim Ekle ──────────────────────────────────────
document.getElementById('deneyimEkle3').addEventListener('click', () => {
    const poz = document.getElementById('s3Pozisyon').value.trim();
    const sir = document.getElementById('s3Sirket').value.trim();
    if (!poz && !sir) { hataGoster('En az pozisyon veya şirket giriniz.'); return; }

    veri.deneyimler.push({
        pozisyon:   poz,
        sirket:     sir,
        baslangic:  document.getElementById('s3Baslangic').value.trim(),
        bitis:      document.getElementById('s3Bitis').value.trim(),
        aciklama:   document.getElementById('s3Aciklama').value.trim()
    });

    ['s3Pozisyon','s3Sirket','s3Baslangic','s3Bitis','s3Aciklama'].forEach(id => document.getElementById(id).value = '');
    deneyimListesiGuncelle();
});

function deneyimListesiGuncelle() {
    const el = document.getElementById('deneyimListesi3');
    el.innerHTML = veri.deneyimler.map((d, i) => `
        <div class="eklenen-item">
            <span class="eklenen-ikon">💼</span>
            <div class="eklenen-bilgi">
                <div class="eklenen-baslik">${d.pozisyon || ''} ${d.sirket ? '@ ' + d.sirket : ''}</div>
                <div class="eklenen-alt">${d.baslangic || ''} ${d.bitis ? '— ' + d.bitis : ''}</div>
            </div>
            <button class="eklenen-sil" onclick="deneyimSil(${i})">🗑️</button>
        </div>
    `).join('');
}

window.deneyimSil = function(i) {
    veri.deneyimler.splice(i, 1);
    deneyimListesiGuncelle();
};

// ── Seviye Seçici ──────────────────────────────────────
const seviyeAciklamalari = { 1:'Başlangıç', 2:'Temel', 3:'Orta', 4:'İyi', 5:'Uzman' };
const dilSeviyeAciklamalari = { 1:'Başlangıç (A1)', 2:'Temel (A2-B1)', 3:'Orta (B2)', 4:'İyi (C1)', 5:'Akıcı (C2)' };

function seviyeSeciciKur(grupId, aciklamaId, aciklamalar) {
    const grup = document.getElementById(grupId);
    if (!grup) return;
    let secili = 0;
    grup.querySelectorAll('.seviye-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            secili = parseInt(btn.dataset.val);
            grup.querySelectorAll('.seviye-btn').forEach(b => b.classList.remove('secili'));
            // 1'den seçilene kadar hepsini renklendir
            grup.querySelectorAll('.seviye-btn').forEach(b => {
                if (parseInt(b.dataset.val) <= secili) b.classList.add('secili');
            });
            document.getElementById(aciklamaId).textContent = aciklamalar[secili] || '';
        });
    });
    grup._getSeviye = () => secili;
}

// ── Beceri Ekleme ─────────────────────────────────────
veri.beceriler = []; // [{ad, seviye}]
veri.diller    = []; // [{ad, seviye}]

function beceriListesiRender() {
    const el = document.getElementById('beceriEklenenListesi');
    if (!veri.beceriler.length) { el.innerHTML = ''; return; }
    el.innerHTML = veri.beceriler.map((b, i) => `
        <div class="beceri-eklenen-item">
            <span class="beceri-adi">⚡ ${b.ad}</span>
            <div class="beceri-seviye-bar">
                ${[1,2,3,4,5].map(n => `<div class="seviye-daire ${n <= b.seviye ? 'dolu' : ''}"></div>`).join('')}
                <span class="seviye-yazisi">${seviyeAciklamalari[b.seviye] || ''}</span>
            </div>
            <button class="eklenen-sil" onclick="beceriSil(${i})">🗑️</button>
        </div>
    `).join('');
}
window.beceriSil = function(i) {
    const silinen = veri.beceriler[i];
    veri.beceriler.splice(i, 1);
    beceriListesiRender();
    // Hızlı ekle butonundaki mavi rengi de kaldır
    document.querySelectorAll('#beceriOneriler .oneri-chip').forEach(btn => {
        if (btn.textContent === silinen.ad) btn.classList.remove('secili');
    });
};

document.getElementById('beceriEkleBtn').addEventListener('click', () => {
    const ad = document.getElementById('s4BeceriAd').value.trim();
    const sevGrup = document.getElementById('beceriSeviyeSecici');
    const seviye = sevGrup._getSeviye ? sevGrup._getSeviye() : 3;
    if (!ad) { hataGoster('Beceri adı girin!'); return; }
    if (veri.beceriler.find(b => b.ad.toLowerCase() === ad.toLowerCase())) {
        hataGoster('Bu beceri zaten ekli!'); return;
    }
    veri.beceriler.push({ ad, seviye: seviye || 3 });
    document.getElementById('s4BeceriAd').value = '';
    sevGrup.querySelectorAll('.seviye-btn').forEach(b => b.classList.remove('secili'));
    document.getElementById('beceriSeviyeAciklama').textContent = 'Seviye seçin';
    beceriListesiRender();
});

// ── Dil Ekleme ────────────────────────────────────────
function dilListesiRender() {
    const el = document.getElementById('dilEklenenListesi');
    if (!veri.diller.length) { el.innerHTML = ''; return; }
    el.innerHTML = veri.diller.map((d, i) => `
        <div class="beceri-eklenen-item dil">
            <span class="beceri-adi">🌍 ${d.ad}</span>
            <div class="beceri-seviye-bar">
                ${[1,2,3,4,5].map(n => `<div class="seviye-daire ${n <= d.seviye ? 'dolu-dil' : ''}"></div>`).join('')}
                <span class="seviye-yazisi">${dilSeviyeAciklamalari[d.seviye] || ''}</span>
            </div>
            <button class="eklenen-sil" onclick="dilSil(${i})">🗑️</button>
        </div>
    `).join('');
}
window.dilSil = function(i) { veri.diller.splice(i, 1); dilListesiRender(); };

document.getElementById('dilEkleBtn').addEventListener('click', () => {
    const ad = document.getElementById('s4DilAd').value;
    const sevGrup = document.getElementById('dilSeviyeSecici');
    const seviye = sevGrup._getSeviye ? sevGrup._getSeviye() : 0;
    if (!ad) { hataGoster('Dil seçin!'); return; }
    if (!seviye) { hataGoster('Dil seviyesi seçin!'); return; }
    if (veri.diller.find(d => d.ad === ad)) { hataGoster('Bu dil zaten ekli!'); return; }
    veri.diller.push({ ad, seviye });
    document.getElementById('s4DilAd').value = '';
    sevGrup.querySelectorAll('.seviye-btn').forEach(b => b.classList.remove('secili'));
    document.getElementById('dilSeviyeAciklama').textContent = 'Seviye seçin';
    dilListesiRender();
});

// ── Beceri Önerileri ──────────────────────────────────
function beceriOnerileriniGoster(bolum) {
    const oneriler = bolumBecerileri[bolum] || bolumBecerileri['default'];
    const el = document.getElementById('beceriOneriler');
    el.innerHTML = oneriler.map(b => `
        <button class="oneri-chip" onclick="beceriOneriEkle('${b}', this)">${b}</button>
    `).join('');
}

window.beceriOneriEkle = function(beceri, btn) {
    if (veri.beceriler.find(b => b.ad.toLowerCase() === beceri.toLowerCase())) {
        btn.classList.add('secili'); return;
    }
    veri.beceriler.push({ ad: beceri, seviye: 3 });
    btn.classList.add('secili');
    beceriListesiRender();
};

// ── Bölüm Becerileri ──────────────────────────────────
const bolumBecerileri = {
    'Bilgisayar Programcılığı':    ['Python','Java','JavaScript','SQL','HTML/CSS','Git'],
    'Ön Yüz Yazılım Geliştirme':   ['React','Vue.js','JavaScript','HTML/CSS','Figma','Git'],
    'Oyun Geliştirme ve Programlama':['Unity','C#','Unreal Engine','C++','3D Modelleme','Git'],
    'Elektronik Teknolojisi':       ['Arduino','PCB Tasarımı','MATLAB','PLC','AutoCAD','Proteus'],
    'Mekatronik':                   ['PLC','Robot Programlama','AutoCAD','MATLAB','Arduino','SolidWorks'],
    'Grafik Tasarımı':              ['Photoshop','Illustrator','InDesign','Figma','After Effects','Canva'],
    'Muhasebe ve Vergi Uygulamaları':['Logo','SAP','Excel','Muhasebe','Finansal Analiz','ERP'],
    'default': ['Microsoft Office','İletişim','Takım Çalışması','Problem Çözme','Organizasyon']
};
function ozetGoster() {
    const el = document.getElementById('ozetIcerik');
    el.innerHTML = `
        <div class="ozet-satir"><span>👤</span><span><strong>${veri.ad} ${veri.soyad}</strong>${veri.unvan ? ' — ' + veri.unvan : ''}</span></div>
        <div class="ozet-satir"><span>🎓</span><span>${veri.bolum} (${veri.mezYil})</span></div>
        ${veri.deneyimler.length ? `<div class="ozet-satir"><span>💼</span><span>${veri.deneyimler.length} iş deneyimi</span></div>` : ''}
        ${veri.beceriler.length ? `<div class="ozet-satir"><span>⚡</span><span>${veri.beceriler.slice(0,4).map(b => `${b.ad} (${b.seviye}/5)`).join(', ')}${veri.beceriler.length > 4 ? '...' : ''}</span></div>` : ''}
        ${veri.diller.length ? `<div class="ozet-satir"><span>🌍</span><span>${veri.diller.map(d => `${d.ad} (${dilSeviyeAciklamalari[d.seviye]})`).join(', ')}</span></div>` : ''}
        ${veri.telefon ? `<div class="ozet-satir"><span>📱</span><span>${veri.telefon}</span></div>` : ''}
    `;
}

// ── Karakter Sayacı ───────────────────────────────────
document.getElementById('s5Hakkimda').addEventListener('input', function() {
    const uzunluk = this.value.length;
    document.getElementById('karakterSayac').textContent = `${uzunluk} / 300 karakter`;
    if (uzunluk > 300) this.value = this.value.substring(0, 300);
});

// ── Profili Tamamla ───────────────────────────────────
document.getElementById('tamamlaBtn').addEventListener('click', async () => {
    veri.hakkimda = document.getElementById('s5Hakkimda').value.trim();

    // Backend'e gönderilecek profil bilgileri
    const profilGuncelleme = {
        ad:       veri.ad,
        soyad:    veri.soyad,
        unvan:    veri.unvan || (veri.tip === 'ogrenci' ? `${veri.bolum} Öğrencisi` : `${veri.bolum} Mezunu`),
        konum:    veri.konum,
        hakkimda: veri.hakkimda,
        telefon:  veri.telefon,
        tip:      veri.tip,
        egitim: [{
            okul:       document.getElementById('s2Okul') ? document.getElementById('s2Okul').value.trim() || 'Ege Meslek Yüksekokulu' : 'Ege Meslek Yüksekokulu',
            bolum:      veri.bolum,
            baslangic:  String(parseInt(veri.mezYil) - 2),
            bitis:      veri.mezYil,
            aciklama:   veri.bolumAciklama
        }],
        deneyim:      veri.deneyimler,
        beceriler:    veri.beceriler,
        diller:       veri.diller,
        iletisim: {
            telefon:  veri.telefon,
            linkedin: veri.linkedin,
            web:      veri.web,
            github:   veri.github
        }
    };

    const tamamlaBtn = document.getElementById('tamamlaBtn');
    tamamlaBtn.disabled = true;
    tamamlaBtn.textContent = 'Kaydediliyor...';

    try {
        const response = await fetch(CONFIG.API_URL + '/profil/tamamla', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profilGuncelleme)
        });
        const result = await response.json();

        if (result.basarili) {
            // ✅ localStorage'ı güncellenmiş kullanıcı bilgisi ile update et
            if (result.kullanici) {
                localStorage.setItem('kullanici', JSON.stringify(result.kullanici));
            }
            
            localStorage.setItem('profilTamamlandi', 'true');

            // Bitti ekranını tipe göre özelleştir
            const bittiAciklama = document.getElementById('bittiAciklama');
            const bittiIlanBtn  = document.getElementById('bittiIlanBtn');
            if (veri.tip === 'ogrenci') {
                bittiAciklama.textContent = 'Harika! Staj ilanlarını inceleyebilir ve ağını genişletebilirsin.';
                bittiIlanBtn.textContent  = '🎯 Staj İlanlarına Bak';
                bittiIlanBtn.onclick = () => window.location.href = '../ilanlar/ilanlar.html?tip=staj';
            } else {
                bittiAciklama.textContent = 'Harika! İş ilanlarını inceleyebilir ve diğer mezunlarla bağlantı kurabilirsin.';
                bittiIlanBtn.textContent  = '📋 İş İlanlarına Bak';
                bittiIlanBtn.onclick = () => window.location.href = '../ilanlar/ilanlar.html';
            }

            aktifAdim = toplamAdim + 1;
            adimGoster(aktifAdim);
        } else {
            hataGoster('Profil kaydedilemedi: ' + (result.mesaj || 'Bilinmeyen hata'));
            tamamlaBtn.disabled = false;
            tamamlaBtn.textContent = 'Profili Tamamla 🎉';
        }
    } catch(e) {
        console.error('Backend hatası:', e);
        hataGoster('Bağlantı hatası. Lütfen tekrar deneyin.');
        tamamlaBtn.disabled = false;
        tamamlaBtn.textContent = 'Profili Tamamla 🎉';
    }
});

// ── Atla Butonu ───────────────────────────────────────
document.getElementById('atlaBtn').addEventListener('click', async () => {
    // Backend'e minimal profil kaydı yap (isim/soyisim en azından gönder)
    const kullaniciLocal = JSON.parse(localStorage.getItem('kullanici') || '{}');
    if (kullaniciLocal.isim || document.getElementById('s1Ad').value.trim()) {
        try {
            await fetch(CONFIG.API_URL + '/profil/guncelle', {
                method: 'PUT', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    isim: document.getElementById('s1Ad').value.trim() || kullaniciLocal.isim,
                    soyisim: document.getElementById('s1Soyad').value.trim() || kullaniciLocal.soyisim,
                    profilTamamlandi: true
                })
            });
        } catch(e) { /* ağ hatası olsa bile ilerle */ }
    }
    localStorage.setItem('profilTamamlandi', 'true');
    window.location.href = '../dashboard/dashboard.html';
});

// ── Bölüm değişince beceri önerileri güncelle ─────────
document.getElementById('s2Bolum').addEventListener('change', function() {
    veri.bolum = this.value;
    beceriOnerileriniGoster(this.value);
});

// ── İlk Yükleme ───────────────────────────────────────
// Kullanıcı adını önceden doldur
const kullanici = JSON.parse(localStorage.getItem('kullanici') || '{}');
if (kullanici.isim) document.getElementById('s1Ad').value    = kullanici.isim;
if (kullanici.soyisim) document.getElementById('s1Soyad').value = kullanici.soyisim;

beceriOnerileriniGoster('default');
adimGoster(1);

// Seviye seçicileri başlat
seviyeSeciciKur('beceriSeviyeSecici', 'beceriSeviyeAciklama', seviyeAciklamalari);
seviyeSeciciKur('dilSeviyeSecici',    'dilSeviyeAciklama',    dilSeviyeAciklamalari);
