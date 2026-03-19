const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ basarili: false, mesaj: 'Oturum bulunamadı. Lütfen giriş yapın.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const kullanici = await User.findById(decoded.id).select('-password');

    if (!kullanici) {
      return res.status(401).json({ basarili: false, mesaj: 'Kullanıcı bulunamadı.' });
    }

    req.user = { id: decoded.id };
    req.kullanici = kullanici;
    next();
  } catch (err) {
    return res.status(401).json({ basarili: false, mesaj: 'Geçersiz veya süresi dolmuş oturum.' });
  }
};

module.exports = authMiddleware;
