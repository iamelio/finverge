const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db');
const { parseOrThrow, registerSchema, loginSchema } = require('../utils/validators');
const { signToken, setAuthCookie, clearAuthCookie } = require('../middleware/auth');

const router = express.Router();

router.post('/register', (req, res, next) => {
  try {
    const body = parseOrThrow(registerSchema, req.body);
    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(body.email.toLowerCase());
    if (existing) {
      const err = new Error('An account with this email already exists');
      err.status = 409;
      throw err;
    }
    const passwordHash = bcrypt.hashSync(body.password, 10);
    const employment = body.employment || 'unspecified';
    const insert = db.prepare(`INSERT INTO users (name, email, phone, employment, password_hash, role)
                               VALUES (@name, @email, @phone, @employment, @password_hash, 'user')`);
    const result = insert.run({
      name: body.name,
      email: body.email.toLowerCase(),
      phone: body.phone || null,
      employment,
      password_hash: passwordHash,
    });
    const user = db.prepare('SELECT id, name, email, phone, employment, role, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    const token = signToken({ id: user.id, role: user.role });
    setAuthCookie(res, token);
    return res.status(201).json({ user });
  } catch (err) {
    return next(err);
  }
});

router.post('/login', (req, res, next) => {
  try {
    const body = parseOrThrow(loginSchema, req.body);
    const db = getDb();
    const user = db
      .prepare('SELECT id, name, email, phone, employment, role, password_hash, created_at FROM users WHERE email = ?')
      .get(body.email.toLowerCase());
    if (!user) {
      const error = new Error('Invalid credentials');
      error.status = 401;
      throw error;
    }
    const valid = bcrypt.compareSync(body.password, user.password_hash);
    if (!valid) {
      const error = new Error('Invalid credentials');
      error.status = 401;
      throw error;
    }
    const token = signToken({ id: user.id, role: user.role });
    setAuthCookie(res, token);
    delete user.password_hash;
    return res.json({ user });
  } catch (err) {
    return next(err);
  }
});

router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  return res.json({ message: 'Logged out' });
});

router.get('/me', (req, res) => {
  if (!req.user) {
    return res.status(200).json({ user: null });
  }
  return res.json({ user: req.user });
});

module.exports = router;
