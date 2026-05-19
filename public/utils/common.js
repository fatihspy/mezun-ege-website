// Küçük, paylaşılan frontend yardımcıları
(function(){
  // Basit toast gösterici
  if (typeof window.toastGoster === 'undefined') {
    window.toastGoster = function(mesaj, type = 'info') {
      try {
        const id = 'app-toast-container';
        let container = document.getElementById(id);
        if (!container) {
          container = document.createElement('div');
          container.id = id;
          container.style.position = 'fixed';
          container.style.right = '16px';
          container.style.bottom = '16px';
          container.style.zIndex = 99999;
          document.body.appendChild(container);
        }

        const el = document.createElement('div');
        el.className = 'app-toast ' + type;
        el.style.marginTop = '8px';
        el.style.padding = '10px 14px';
        el.style.background = type === 'hata' ? '#ffe6e6' : '#111827';
        el.style.color = type === 'hata' ? '#9b1c1c' : '#fff';
        el.style.borderRadius = '8px';
        el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)';
        el.style.fontSize = '13px';
        el.textContent = mesaj;

        container.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; setTimeout(()=>el.remove(), 300); }, 3500);
      } catch (e) { console.warn('toastGoster hata:', e); }
    };
  }

  // Basit hata gösterici: el parametresi DOM elemanı ya da ID olabilir
  if (typeof window.hataGoster === 'undefined') {
    window.hataGoster = function(el, mesaj) {
      try {
        let target = el;
        if (!target) {
          // global fallback: toast
          return toastGoster(mesaj, 'hata');
        }
        if (typeof el === 'string') target = document.getElementById(el);
        if (!target) return toastGoster(mesaj, 'hata');
        target.style.display = 'block';
        target.textContent = mesaj || 'Bir hata oluştu.';
      } catch (e) { console.warn('hataGoster hata:', e); }
    };
  }

  // Geri dön helper
  if (typeof window.geriDon === 'undefined') {
    window.geriDon = function() {
      try { window.history.back(); } catch (e) { window.location.href = '/'; }
    };
  }
})();

  // HTML escape helper for safe insertion into innerHTML
  if (typeof window.escapeHtml === 'undefined') {
    window.escapeHtml = function(text) {
      if (text === undefined || text === null) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };
  }

  // Basic URL sanitizer to avoid javascript: links — returns '#' if unsafe
  if (typeof window.sanitizeUrl === 'undefined') {
    window.sanitizeUrl = function(url) {
      if (!url) return '#';
      try {
        const u = String(url).trim();
        // remove leading protocol markers to avoid double protocol
        if (/^javascript:/i.test(u)) return '#';
        if (/^\/\//.test(u)) return 'https:' + u;
        if (!/^https?:\/\//i.test(u)) return 'https://' + u;
        return u;
      } catch (e) { return '#'; }
    };
  }

// Ensure only one password-toggle button exists per input-wrap
document.addEventListener('DOMContentLoaded', () => {
  try {
    document.querySelectorAll('.input-wrap').forEach(wrap => {
      const toggles = Array.from(wrap.querySelectorAll('button.toggle-sifre'));
      if (toggles.length > 1) {
        // keep the first, remove others
        toggles.slice(1).forEach(t => t.remove());
      }
    });
  } catch (e) { console.warn('toggle dedupe error', e); }
});
