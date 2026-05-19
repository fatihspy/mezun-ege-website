require('dotenv').config();
const fs = require('fs');
const https = require('http');
const url = require('url');

async function run() {
  const basvuruId = process.argv[2];
  const token = process.argv[3];
  if (!basvuruId || !token) {
    console.error('Usage: node scripts/downloadCvWithToken.js <basvuruId> <token>');
    process.exit(1);
  }
  const apiPath = `/api/dosya/cv/${basvuruId}?type=basvuru&token=${token}`;
  const options = {
    hostname: 'localhost',
    port: process.env.PORT || 3000,
    path: apiPath,
    method: 'GET'
  };

  const req = https.request(options, res => {
    if (res.statusCode !== 200) {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.error('Server error', res.statusCode, body);
        process.exit(2);
      });
      return;
    }
    const chunks = [];
    res.on('data', d => chunks.push(d));
    res.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const dest = `cv_token_${basvuruId}.pdf`;
      fs.writeFileSync(dest, buffer);
      console.log('WROTE', dest, fs.statSync(dest).size);
      process.exit(0);
    });
  });
  req.on('error', err => { console.error('REQ_ERR', err.message); process.exit(1); });
  req.end();
}

run();
