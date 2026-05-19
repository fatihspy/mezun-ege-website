const API_URL = (typeof CONFIG !== 'undefined') ? CONFIG.API_URL : 'http://localhost:3000/api';

// Auth + nav
sayfaAuthKontrol(true);
document.addEventListener('DOMContentLoaded', () => { navBaslat(); logoutBaslat(); });

const kullanici = JSON.parse(localStorage.getItem('kullanici') || '{}');
let tumMezunlar = [];

const MEZUNLAR_URL = (typeof CONFIG !== 'undefined') ? CONFIG.API_URL + '/mezunlar' : 'http://localhost:3000/api/mezunlar';
async function mezunlariGetir(arama = '', tip = '') {
    try {
        let url = `${MEZUNLAR_URL}?`;
        if (arama) url += `arama=${encodeURIComponent(arama)}&`;
        if (tip)   url += `tip=${tip}`;
        const res  = await fetch(url, { credentials: 'include' });
        const veri = await res.json();
        return veri.basarili ? veri.mezunlar : [];
    } catch (e) {
        // Backend'e ulaşılamazsa localStorage'dan göster
        return JSON.parse(localStorage.getItem('mezunDizini') || '[]').map(m => ({
            _id: m.id, isim: m.ad, soyisim: m.soyad, rol: m.tip,
            unvan: m.unvan, konum: m.konum, hakkimda: m.hakkimda,
            beceriler: m.beceriler, diller: m.diller,
            egitim: m.bolum ? [{ bolum: m.bolum, bitis: m.mezYil }] : [],
            sosyalMedya: m.iletisim || {}, telefon: m.iletisim?.telefon,
            _avatar: m.avatar
        }));
    }
}

// ── Render ────────────────────────────────────────────
function avatarHarfi(isim, soyisim) {
    return ((isim || '')[0] + (soyisim || '')[0]).toUpperCase() || '?';
}

function mezunKartiOlustur(m) {
    const tam     = `${m.isim || ''} ${m.soyisim || ''}`.trim();
    const tip     = m.rol || 'mezun';
    const tipCls  = tip === 'ogrenci' ? 'tip-ogrenci' : 'tip-mezun';
    const tipYazi = tip === 'ogrenci' ? '📚 Aktif Öğrenci' : '🎓 Mezun';
    const beceriler = (m.beceriler || []).slice(0, 3);
    const fazla   = (m.beceriler || []).length - 3;
    const bolum   = m.egitim?.[0]?.bolum || '';
    const mezYil  = m.egitim?.[0]?.bitis || '';
    const id      = m._id?.toString() || m.id;

    return `
        <div class="mezun-kart" onclick="mezunDetayAc('${id}')">
            <div class="kart-ust">
                <div class="kart-avatar">
                    ${m._avatar
                        ? `<img src="${escapeHtml(m._avatar)}" alt="${escapeHtml(tam)}">`
                        : avatarHarfi(m.isim, m.soyisim)
                    }
                </div>
                <div>
                    <div class="kart-isim">${escapeHtml(tam)}</div>
                    <div class="kart-unvan">${escapeHtml(m.unvan || '')}</div>
                </div>
            </div>
            <span class="kart-tip-rozet ${tipCls}">${tipYazi}</span>
            ${bolum ? `<div class="kart-bolum">🎓 ${bolum}${mezYil ? ' · ' + mezYil : ''}</div>` : ''}
            ${m.konum ? `<div class="kart-konum">📍 ${escapeHtml(m.konum)}</div>` : ''}
            <div class="kart-beceriler">
                ${beceriler.map(b => `<span class="beceri-chip">${escapeHtml(typeof b === 'object' ? b.ad : b)}</span>`).join('')}
                ${fazla > 0 ? `<span class="beceri-chip beceri-chip-fazla">+${fazla}</span>` : ''}
            </div>
            <div class="kart-alt">
                <button class="profil-gor-btn" onclick="event.stopPropagation(); mezunDetayAc('${id}')">Profili Gör</button>
                <button class="mesaj-gonder-btn" onclick="event.stopPropagation(); mezunaMesajGonder('${id}')">💬 Mesaj</button>
            </div>
        </div>
    `;
}

async function listele() {
    const aramaVal = document.getElementById('aramaInput').value;
    const tip      = document.getElementById('tipFiltre').value;
    const sira     = document.getElementById('siraFiltre').value;

    const grid     = document.getElementById('mezunGrid');
    const bosDurum = document.getElementById('bosDurum');
    grid.innerHTML = '<div style="padding:40px;text-align:center;color:#a0aec0;">Yükleniyor...</div>';

    let liste = await mezunlariGetir(aramaVal, tip);
    tumMezunlar = [];

    // Bölüm filtresi (frontend'de yap, backend'de alan yok)
    const bolum = document.getElementById('bolumFiltre').value;
    if (bolum) {
        liste = liste.filter(m => (m.egitim?.[0]?.bolum || '') === bolum);
    }

    if (sira === 'isim')  liste.sort((a, b) => (a.isim || '').localeCompare(b.isim || ''));
    if (sira === 'bolum') liste.sort((a, b) => (a.egitim?.[0]?.bolum || '').localeCompare(b.egitim?.[0]?.bolum || ''));

    if (!liste.length) {
        grid.innerHTML = '';
        bosDurum.style.display = 'block';
    } else {
        bosDurum.style.display = 'none';
        tumMezunlar = liste;
        grid.innerHTML = liste.map(mezunKartiOlustur).join('');
    }

    document.getElementById('toplamMezunSayisi').textContent = liste.length;
    const bolumler = new Set(liste.map(m => m.egitim?.[0]?.bolum).filter(Boolean));
    document.getElementById('toplamBolumSayisi').textContent = bolumler.size;
}

// ── Filtreleme ────────────────────────────────────────
document.getElementById('aramaInput').addEventListener('input', listele);
document.getElementById('bolumFiltre').addEventListener('change', listele);
document.getElementById('tipFiltre').addEventListener('change', listele);
document.getElementById('siraFiltre').addEventListener('change', listele);

// ── Detay Modal ───────────────────────────────────────
window.mezunDetayAc = async function(id) {
    // Önce yüklenen listeden bul
    const grid = document.getElementById('mezunGrid');
    let mezunlar = await mezunlariGetir();
    const m = mezunlar.find(x => (x._id?.toString() || x.id) == id);
    if (!m) return;

    const tam     = `${m.isim || m.ad || ''} ${m.soyisim || m.soyad || ''}`.trim();
    const tip     = m.rol || m.tip || 'mezun';
    const tipCls  = tip === 'ogrenci' ? 'tip-ogrenci' : 'tip-mezun';
    const tipYazi = tip === 'ogrenci' ? '📚 Aktif Öğrenci' : '🎓 Mezun';
    const bolum   = m.egitim?.[0]?.bolum || m.bolum || '';
    const mezYil  = m.egitim?.[0]?.bitis || m.mezYil || '';
    const ilt     = m.sosyalMedya || m.iletisim || {};
    const benimKart = m.email === kullanici.email;

    const becerilerHTML = (m.beceriler || []).map(b => {
        const ad  = typeof b === 'object' ? b.ad : b;
        const sev = typeof b === 'object' ? (b.seviye || 3) : 3;
        return `
            <div class="modal-beceri-chip">
                ${ad}
                <div class="modal-seviye">
                    ${[1,2,3,4,5].map(n => `<div class="seviye-nokta ${n <= sev ? 'dolu' : ''}"></div>`).join('')}
                </div>
            </div>
        `;
    }).join('');

    const dillerHTML = (m.diller || []).map(d => `
        <div class="modal-iletisim-satir">🌍 <strong>${d.ad}</strong> — ${d.seviye}/5</div>
    `).join('');

    const telefon = m.telefon || ilt.telefon || '';

    document.getElementById('mezunModalIcerik').innerHTML = `
        <div class="modal-profil-ust">
            <div class="modal-avatar">
                ${m._avatar ? `<img src="${m._avatar}" alt="${tam}">` : avatarHarfi(m.isim || m.ad, m.soyisim || m.soyad)}
            </div>
            <div>
                <div class="modal-isim">${tam}</div>
                <div class="modal-unvan">${m.unvan || ''}</div>
                <span class="kart-tip-rozet ${tipCls}">${tipYazi}</span>
            </div>
        </div>
        ${bolum ? `<div class="modal-bolum-satir">🎓 ${bolum}${mezYil ? ' (' + mezYil + ')' : ''}</div>` : ''}
        ${m.konum ? `<div class="modal-bolum-satir" style="margin-top:4px;">📍 ${m.konum}</div>` : ''}

        ${m.hakkimda ? `
            <div class="modal-bolum-baslik">Hakkında</div>
            <div class="modal-hakkimda">${m.hakkimda}</div>
        ` : ''}

        ${(m.beceriler || []).length ? `
            <div class="modal-bolum-baslik">Beceriler</div>
            <div class="modal-beceriler">${becerilerHTML}</div>
        ` : ''}

        ${(m.diller || []).length ? `
            <div class="modal-bolum-baslik">Yabancı Diller</div>
            <div class="modal-iletisim-liste">${dillerHTML}</div>
        ` : ''}

        ${(ilt.linkedin || ilt.github || ilt.web || telefon) ? `
            <div class="modal-bolum-baslik">İletişim</div>
            <div class="modal-iletisim-liste">
                ${telefon    ? `<div class="modal-iletisim-satir">📱 ${telefon}</div>` : ''}
                ${ilt.linkedin ? `<div class="modal-iletisim-satir">🔗 <a href="https://${ilt.linkedin.replace('https://','')}" target="_blank">${ilt.linkedin}</a></div>` : ''}
                ${ilt.github   ? `<div class="modal-iletisim-satir">💻 <a href="https://${ilt.github.replace('https://','')}" target="_blank">${ilt.github}</a></div>` : ''}
                ${ilt.web      ? `<div class="modal-iletisim-satir">🌐 <a href="https://${ilt.web.replace('https://','')}" target="_blank">${ilt.web}</a></div>` : ''}
            </div>
        ` : ''}

        <div class="modal-alt">
            <button class="modal-mesaj-btn" onclick="mezunaMesajGonder('${m._id || m.id}')">
                💬 Mesaj Gönder
            </button>
        </div>
    `;

    document.getElementById('mezunModal').classList.add('show');
};

// ── Mesaj Gönder ─────────────────────────────────────
window.mezunaMesajGonder = function(id) {
    const m = tumMezunlar.find(x => (x.id == id || x._id == id));
    if (!m) return;

    // Seçilen mezunu sessionStorage'e kaydet (sayfayı açmadan önce)
    const secilenMezun = {
        _id: m._id || m.id,
        isim: m.ad || m.isim || '',
        soyisim: m.soyad || m.soyisim || '',
        email: m.email || '',
        rol: (m.rol || m.tip) === 'ogrenci' ? 'Öğrenci' : 'Mezun'
    };
    sessionStorage.setItem('secilenMezunMesaj', JSON.stringify(secilenMezun));

    // Modal'ı kapat
    document.getElementById('mezunModal').classList.remove('show');
    
    // Mesajlar sayfasına yönlendir
    window.location.href = `../mesajlar/mesajlar.html?mesaj=${m._id || m.id}`;
};

// ── Modal Kapat ───────────────────────────────────────
document.getElementById('mezunModalKapat').addEventListener('click', () => {
    document.getElementById('mezunModal').classList.remove('show');
});
window.addEventListener('click', e => {
    if (e.target === document.getElementById('mezunModal')) {
        document.getElementById('mezunModal').classList.remove('show');
    }
});

// ── İlk Yükleme ───────────────────────────────────────
listele();
