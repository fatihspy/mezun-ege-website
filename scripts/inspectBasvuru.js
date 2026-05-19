require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI eksik');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI, { });
  // Ensure User model is registered before populating
  require('../models/User');
  const Basvuru = require('../models/Basvuru');
  const id = process.argv[2];
  if (!id) { console.error('Usage: node scripts/inspectBasvuru.js <id>'); process.exit(1); }
  const b = await Basvuru.findById(id).populate('isveren', 'email _id');
  if (!b) { console.error('Basvuru bulunamadı'); process.exit(2); }
  console.log('basvuruId:', b._id.toString());
  console.log('isveren:', b.isveren ? b.isveren._id.toString() : null, 'email:', b.isveren ? b.isveren.email : null);
  console.log('cvVar:', b.cvVar);
  process.exit(0);
}
run().catch(err => { console.error(err); process.exit(1); });
