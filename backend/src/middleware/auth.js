const jwt = require('jsonwebtoken');
const config = require('../config');
const { getDb } = require('../db');

const COOKIE_NAME = 'loan_session';
const sameSite = config.env === 'production' ? 'strict' : 'lax';

function extractToken(req) {
  const cookieToken = req.cookies[COOKIE_NAME];
  if (cookieToken) {
    return cookieToken;
  }
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && typeof authHeader === 'string') {
    const parts = authHeader.trim().split(' ');
    if (parts.length === 2 && /^bearer$/i.test(parts[0])) {
      return parts[1];
    }
  }
  return null;
}

function signToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

function setAuthCookie(res, token) {
  const maxAgeMs = 1000 * 60 * 60 * 4; // 4 hours fallback; JWT controls final expiry
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite,
    secure: config.env === 'production',
    maxAge: maxAgeMs,
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite,
    secure: config.env === 'production',
  });
}

function attachUser(req, _res, next) {
  const token = extractToken(req);
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const db = getDb();
    const user = db
      .prepare('SELECT id, name, email, role, phone, employment, created_at FROM users WHERE id = ?')
      .get(payload.id);
    req.user = user || null;
    return next();
  } catch (err) {
    req.user = null;
    return next();
  }
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Administrator access required' });
  }
  return next();
}

module.exports = {
  signToken,
  setAuthCookie,
  clearAuthCookie,
  attachUser,
  requireAuth,
  requireAdmin,
  extractToken,
  COOKIE_NAME,
};
