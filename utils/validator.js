// Input validation utility'leri

const validator = {
  // Email validasyonu
  isValidEmail: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return email && email.length <= 255 && emailRegex.test(email);
  },

  // Telefon validasyonu
  isValidPhone: (phone) => {
    const phoneRegex = /^(\+90|0)?[1-9]\d{9}$/;
    return !phone || phoneRegex.test(phone?.replace(/\D/g, ''));
  },

  // Se'nid validasyonu (3-50 karakter, Turkish chars allowed)
  isValidName: (name) => {
    return name && name.length >= 2 && name.length <= 50;
  },

  // String sanitization
  sanitizeString: (str) => {
    if (!str) return '';
    return str
      .trim()
      .replace(/[<>]/g, '')
      .slice(0, 1000); // Max 1000 karakter
  },

  // Pozisyon validasyonu
  isValidPosition: (pos) => {
    return pos && pos.length >= 3 && pos.length <= 100;
  },

  // Salary validasyonu
  isValidSalary: (salary) => {
    if (salary === null || salary === undefined || salary === '') return false;
    const num = Number(salary);
    return !isNaN(num) && num > 0 && num < 10000000;
  },

  // URL validasyonu
  isValidURL: (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  // CV file validasyonu (Base64)
  isValidCVBase64: (base64) => {
    if (!base64) return false;
    // Base64'ün boyutu max 5MB (~6.7MB base64)
    return base64.length <= 6.7 * 1024 * 1024;
  },

  // Validation sonucunu return et (başarı/hata)
  validateEmail: (email) => {
    if (!email) return { valid: false, error: 'E-posta zorunludur.' };
    if (!validator.isValidEmail(email)) return { valid: false, error: 'Geçersiz e-posta formatı.' };
    return { valid: true };
  },

  validateName: (name, field = 'Ad') => {
    if (!name) return { valid: false, error: `${field} zorunludur.` };
    if (!validator.isValidName(name)) return { valid: false, error: `${field} 2-50 karakter olmalı.` };
    return { valid: true };
  },

  validatePhone: (phone, required = false) => {
    if (!phone && required) return { valid: false, error: 'Telefon zorunludur.' };
    if (phone && !validator.isValidPhone(phone)) return { valid: false, error: 'Geçersiz telefon formatı.' };
    return { valid: true };
  },

  validatePosition: (position) => {
    if (!position) return { valid: false, error: 'Pozisyon zorunludur.' };
    if (!validator.isValidPosition(position)) return { valid: false, error: 'Pozisyon 3-100 karakter olmalı.' };
    return { valid: true };
  },

  validateSalary: (salary) => {
    // Maaş opsiyoneldir; boş/tanımsızsa geçerli say
    if (salary === null || salary === undefined || salary === '') return { valid: true };
    if (!validator.isValidSalary(salary)) return { valid: false, error: 'Geçersiz maaş değeri. Pozitif bir sayı girin.' };
    return { valid: true };
  },

  validateCV: (cvBase64) => {
    if (!cvBase64) return { valid: false, error: 'CV zorunludur.' };
    if (!validator.isValidCVBase64(cvBase64)) return { valid: false, error: 'CV çok büyük (max 5MB).' };
    if (!cvBase64.startsWith('data:application/pdf;base64,')) {
      return { valid: false, error: 'Sadece PDF kabul edilir.' };
    }
    return { valid: true };
  },

  validatePassword: (password) => {
    if (!password) return { valid: false, error: 'Şifre zorunludur.' };
    if (password.length < 8) return { valid: false, error: 'Şifre minimum 8 karakter olmalı.' };
    if (!/[A-Z]/.test(password)) return { valid: false, error: 'Şifre en az 1 büyük harf içermeli.' };
    if (!/[0-9]/.test(password)) return { valid: false, error: 'Şifre en az 1 rakam içermeli.' };
    if (!/[a-z]/.test(password)) return { valid: false, error: 'Şifre en az 1 küçük harf içermeli.' };
    return { valid: true };
  }
};

module.exports = validator;
