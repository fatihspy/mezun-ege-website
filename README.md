# 🎓 Egemyo Mezun — Backend Kurulum Rehberi

## Gereksinimler
- [Node.js](https://nodejs.org) (v18+)
- [MongoDB Community](https://www.mongodb.com/try/download/community) (yerel kurulum)

---

## 1. Kurulum

```bash
# Bu klasöre gir
cd mezun_backend

# Bağımlılıkları yükle
npm install
```

---

## 2. MongoDB'yi Başlat

**Windows:**
```bash
mongod
```

**macOS (Homebrew):**
```bash
brew services start mongodb-community
```

**Linux:**
```bash
sudo systemctl start mongod
```

---

## 3. Sunucuyu Çalıştır

```bash
node server.js
```

Çıktı şöyle olmalı:
```
✅ MongoDB bağlantısı başarılı
🚀 Sunucu çalışıyor: http://localhost:3000
```

---

## 4. Test Kullanıcıları Oluştur (İsteğe Bağlı)

```bash
node seed.js
```

Oluşturulan hesaplar:

| Rol      | E-posta             | Şifre  |
|----------|---------------------|--------|
| mezun    | mezun@test.com      | 123456 |
| isveren  | isveren@test.com    | 123456 |
| ogrenci  | ogrenci@test.com    | 123456 |

---

## 5. Uygulamayı Aç

Tarayıcında şu adresi aç:
```
http://localhost:3000/giris%20ekrani/index.html
```

---

## API Endpoint'leri

| Method | URL                   | Açıklama              |
|--------|-----------------------|-----------------------|
| POST   | /api/auth/kayit       | Yeni kullanıcı kaydı  |
| POST   | /api/auth/giris       | Giriş yap             |
| GET    | /api/auth/ben         | Oturum bilgisi        |
| POST   | /api/auth/cikis       | Çıkış yap             |

### Örnek: Giriş isteği
```json
POST /api/auth/giris
{
  "email": "mezun@test.com",
  "password": "123456",
  "rol": "mezun"
}
```

### Örnek: Kayıt isteği
```json
POST /api/auth/kayit
{
  "email": "yeni@ornek.com",
  "password": "güçlüşifre",
  "rol": "mezun",
  "isim": "Ad",
  "soyisim": "Soyad"
}
```

---

## Geliştirme Modu (Otomatik Yeniden Başlatma)

```bash
npm run dev
```
