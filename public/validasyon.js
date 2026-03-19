// Frontend Form Validation & Error Handling

class FormValidator {
  // Email validasyonu
  static isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  // Telefon validasyonu
  static isValidPhone(phone) {
    const regex = /^(\+90|0)?[1-9]\d{9}$/;
    return !phone || regex.test(phone.replace(/\D/g, ''));
  }

  // İsim validasyonu
  static isValidName(name) {
    return name && name.trim().length >= 2 && name.trim().length <= 50;
  }

  // Pozisyon validasyonu
  static isValidPosition(position) {
    return position && position.trim().length >= 3 && position.trim().length <= 100;
  }

  // Salary validasyonu
  static isValidSalary(salary) {
    return !isNaN(salary) && salary > 0 && salary < 10000000;
  }

  // Login email
  static validateLoginEmail(email) {
    if (!email) return { valid: false, error: 'E-posta zorunludur.' };
    if (!this.isValidEmail(email)) return { valid: false, error: 'Geçersiz e-posta formatı.' };
    return { valid: true };
  }

  // Login kodu
  static validateCode(code) {
    if (!code) return { valid: false, error: 'Doğrulama kodu zorunludur.' };
    if (!/^\d{6}$/.test(code)) return { valid: false, error: 'Kod 6 haneli olmalı.' };
    return { valid: true };
  }

  // Profile form
  static validateProfile(data) {
    const errors = [];
    if (!data.ad || !this.isValidName(data.ad)) errors.push('Ad 2-50 karakter olmalı');
    if (!data.soyad || !this.isValidName(data.soyad)) errors.push('Soyad 2-50 karakter olmalı');
    if (data.telefon && !this.isValidPhone(data.telefon)) errors.push('Telefon formatı hatalı');
    return { valid: errors.length === 0, errors };
  }

  // İlan form
  static validateJob(data) {
    const errors = [];
    if (!data.pozisyon || !this.isValidPosition(data.pozisyon)) 
      errors.push('Pozisyon 3-100 karakter olmalı');
    if (!data.minMaas || !this.isValidSalary(data.minMaas)) 
      errors.push('Maaş geçersiz');
    if (!data.konum || data.konum.trim().length === 0) 
      errors.push('Konum zorunludur');
    return { valid: errors.length === 0, errors };
  }

  // Başvuru form
  static validateApplication(data) {
    const errors = [];
    if (data.onYazi && data.onYazi.length > 5000) 
      errors.push('Önyazı maksimum 5000 karakter olmalı');
    return { valid: errors.length === 0, errors };
  }
}

// Toast/Notification Sistemi
class Toast {
  static show(message, type = 'info', duration = 3000) {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-size: 14px;
        z-index: 10000;
        margin: 0;
        max-width: 300px;
        word-wrap: break-word;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      `;
      document.body.appendChild(toast);
    }
    
    const colors = {
      'success': '#4caf50',
      'error': '#f44336',
      'warning': '#ff9800',
      'info': '#2196f3'
    };
    
    toast.style.backgroundColor = colors[type] || colors['info'];
    toast.textContent = message;
    toast.classList.add('goster');
    
    setTimeout(() => toast.classList.remove('goster'), duration);
  }

  static success(msg) { this.show(msg, 'success'); }
  static error(msg) { this.show(msg, 'error'); }
  static warning(msg) { this.show(msg, 'warning'); }
  static info(msg) { this.show(msg, 'info'); }
}

// Error mesaj göster
function showErrors(errors, containerId = null) {
  if (!errors || errors.length === 0) return;
  
  const container = containerId ? document.getElementById(containerId) : null;
  if (container) {
    const errorHtml = '<ul style="margin:0;padding-left:20px;"><li>' + 
                      errors.join('</li><li>') + 
                      '</li></ul>';
    container.innerHTML = errorHtml;
    container.style.display = 'block';
  } else {
    errors.forEach(err => Toast.error(err));
  }
}

// Form disable (loading)
function disableForm(formId, disable = true) {
  const form = document.getElementById(formId);
  if (form) {
    const inputs = form.querySelectorAll('input, textarea, button, select');
    inputs.forEach(input => {
      if (input.type !== 'hidden') {
        input.disabled = disable;
        if (disable) {
          input.style.opacity = '0.6';
          input.style.cursor = 'not-allowed';
        } else {
          input.style.opacity = '1';
          input.style.cursor = 'pointer';
        }
      }
    });
  }
}

// Loading spinner
function showLoading(show = true, message = 'Yükleniyor...') {
  let loader = document.getElementById('loader');
  if (show) {
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'loader';
      loader.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
      `;
      document.body.appendChild(loader);
    }
    loader.innerHTML = `
      <div style="background: white; padding: 40px; border-radius: 10px; text-align: center;">
        <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; 
                    border-top: 4px solid #0077b5; border-radius: 50%; 
                    animation: spin 1s linear infinite; margin: 0 auto 15px;"></div>
        <p style="margin: 0; color: #333; font-weight: 500;">${message}</p>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
    loader.style.display = 'flex';
  } else {
    if (loader) loader.style.display = 'none';
  }
}

// Empty state component
function showEmptyState(containerId, message = 'Hiç veri yok', icon = '📭') {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #666;">
        <div style="font-size: 48px; margin-bottom: 15px;">${icon}</div>
        <p style="font-size: 16px; font-weight: 500;">${message}</p>
      </div>
    `;
  }
}

// Hide empty state
function hideEmptyState(containerId) {
  const container = document.getElementById(containerId);
  if (container) container.innerHTML = '';
}
