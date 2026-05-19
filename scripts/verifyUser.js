require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI eksik');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI, { });
  const User = require('../models/User');
  const email = process.argv[2];
  if (!email) {
    console.error('Kullanım: node scripts/verifyUser.js <email>');
    process.exit(1);
  }
  const u = await User.findOneAndUpdate({ email }, { $set: { emailVerified: true } }, { new: true });
  if (!u) {
    console.error('Kullanıcı bulunamadı:', email);
    process.exit(2);
  }
  console.log('Güncellendi:', u.email, 'emailVerified=', u.emailVerified);
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
