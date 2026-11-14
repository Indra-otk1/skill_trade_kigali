const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db/database');
const requireAuth = require('../middleware/auth');

const router = express.Router();

function isAllowedEmail(email) {
  const allowed = (process.env.ALLOWED_EMAIL_DOMAINS || '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  const domain = email.split('@')[1];
  return allowed.length === 0 || allowed.includes(domain);
}

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(cleanEmail)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  if (!isAllowedEmail(cleanEmail)) {
    return res.status(400).json({ error: 'Please register with an accepted student email' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const token = crypto.randomBytes(32).toString('hex');

  const result = db
    .prepare(
      'INSERT INTO users (name, email, password_hash, verification_token) VALUES (?, ?, ?, ?)'
    )
    .run(name.trim(), cleanEmail, passwordHash, token);

  const verifyLink = `http://localhost:${process.env.PORT || 3000}/api/auth/verify?token=${token}`;
  console.log(`[DEV] Verification link for ${cleanEmail}: ${verifyLink}`);

  const response = {
    message: 'Account created. Check your email to verify your account.',
    userId: result.lastInsertRowid,
  };
  if (process.env.NODE_ENV !== 'production') {
    response.devVerificationLink = verifyLink;
  }

  res.status(201).json(response);
});

// GET /api/auth/verify?token=...
router.get('/verify', (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ error: 'Verification token is required' });
  }

  const user = db.prepare('SELECT id FROM users WHERE verification_token = ?').get(token);
  if (!user) {
    return res.status(400).json({ error: 'Invalid or already used verification link' });
  }

  db.prepare('UPDATE users SET email_verified = 1, verification_token = NULL WHERE id = ?').run(
    user.id
  );

  res.json({ message: 'Email verified. You can now log in.' });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(email.trim().toLowerCase());

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  if (!user.email_verified) {
    return res.status(403).json({ error: 'Please verify your email before logging in' });
  }

  const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email },
  });
});

// GET /api/auth/me  (protected)
router.get('/me', requireAuth, (req, res) => {
  const user = db
    .prepare('SELECT id, name, email, created_at FROM users WHERE id = ?')
    .get(req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ user });
});

module.exports = router;