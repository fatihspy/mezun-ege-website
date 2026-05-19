const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Simple in-memory cache to reduce DB hits for frequent auth checks
// Key: userId, Value: { user, expiresAt }
const userCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

const authMiddleware = async (req, res, next) => {
  try {
    // Support Authorization header or httpOnly cookie 'token'
    const authHeader = req.headers.authorization;
    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) token = authHeader.split(' ')[1];
    if (!token && req.cookies && req.cookies.token) token = req.cookies.token;
    if (!token) return res.status(401).json({ basarili: false, mesaj: 'Oturum bulunamadı. Lütfen giriş yapın.' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fast-path: if token already contains common user claims (rol/email), avoid DB lookup
    if (decoded && decoded.id && decoded.rol && decoded.email) {
      req.kullanici = {
        _id: decoded.id,
        rol: decoded.rol,
        email: decoded.email,
        isim: decoded.isim || decoded.name || ''
      };
      return next();
    }

    // Check in-memory cache first
    if (decoded && decoded.id) {
      const cached = userCache.get(decoded.id);
      if (cached && cached.expiresAt > Date.now()) {
        req.kullanici = cached.user;
        return next();
      }
    }

    // Fallback: fetch user from DB (and cache result)
    if (!decoded || !decoded.id) {
      return res.status(401).json({ basarili: false, mesaj: 'Geçersiz token.' });
    }

    const kullanici = await User.findById(decoded.id).select('-password');
    if (!kullanici) {
      return res.status(401).json({ basarili: false, mesaj: 'Kullanıcı bulunamadı.' });
    }

    // Cache for a short duration to reduce DB pressure
    userCache.set(decoded.id, { user: kullanici, expiresAt: Date.now() + CACHE_TTL_MS });

    req.kullanici = kullanici;
    next();
  } catch (err) {
    return res.status(401).json({ basarili: false, mesaj: 'Geçersiz veya süresi dolmuş oturum.' });
  }
};

module.exports = authMiddleware;
