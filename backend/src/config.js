const path = require('path');
require('dotenv').config();

const env = process.env.NODE_ENV || 'development';

const resolveDbPath = () => {
  const provided = process.env.DATABASE_PATH;
  if (!provided) {
    return path.join(__dirname, '..', 'data', 'loan_app.db');
  }
  if (path.isAbsolute(provided)) {
    return provided;
  }
  return path.join(__dirname, '..', provided);
};

const parseCorsOrigins = () => {
  const input = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN;
  if (!input) {
    const defaults = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:*',
      'http://127.0.0.1:*',
    ];
    if (env !== 'production') {
      defaults.push('null');
    }
    return defaults;
  }
  return input
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
};

module.exports = {
  env,
  port: Number(process.env.PORT) || 4000,
  databasePath: resolveDbPath(),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '2h',
  corsOrigins: parseCorsOrigins(),
  adminSeedEmail: process.env.ADMIN_SEED_EMAIL,
  adminSeedPassword: process.env.ADMIN_SEED_PASSWORD,
};
