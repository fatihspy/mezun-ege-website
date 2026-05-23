const winston = require('winston');
const path = require('path');
const fs = require('fs');

const transports = [
  // Her zaman konsola yaz (Railway logları için şart)
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, stack }) => {
        return `[${timestamp}] ${level.toUpperCase()}: ${stack || message}`;
      })
    ),
  })
];

// Sadece local'de dosyaya da yaz
if (process.env.NODE_ENV !== 'production') {
  const logsDir = path.join(__dirname, '..', 'logs');
  try {
    fs.mkdirSync(logsDir, { recursive: true });
    transports.push(
      new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        level: 'error',
        maxsize: 5242880,
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: path.join(logsDir, 'combined.log'),
        maxsize: 5242880,
        maxFiles: 5,
      })
    );
  } catch (e) { /* logs klasörü oluşturulamazsa geç */ }
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'egemyo-backend' },
  transports,
});

module.exports = logger;
