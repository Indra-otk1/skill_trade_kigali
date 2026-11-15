const express = require('express');
const db = require('../db/database');
const requireAuth = require('../middleware/auth');

const router = express.Router();

// POST /api/ratings  (protected)
// Body: { trade_id, score (1-5), comment? }
router.post('/', requireAuth, (req, res) => {
  const tradeId = Number(req.body.trade_id);
  const score = Number(req.body.score);
  const comment = (req.body.comment || '').trim();

  if (!Number.isInteger(tradeId)) {
    return res.status(400).json({ error: 'trade_id is required' });
  }
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return res.status(400).json({ error: 'Score must be a whole number from 1 to 5' });
  }
  if (comment.length > 500) {
    return res.status(400).json({ error: 'Comment must be 500 characters or fewer' });
  }

  const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(tradeId);
  if (!trade) {
    return res.status(404).json({ error: 'Trade not found' });
  }

  const isRequester = trade.requester_id === req.user.id;
  const isProvider = trade.provider_id === req.user.id;
  if (!isRequester && !isProvider) {
    return res.status(403).json({ error: 'You are not part of this trade' });
  }
  if (trade.status !== 'completed') {
    return res.status(409).json({ error: 'You can only rate a completed trade' });
  }

  const existing = db
    .prepare('SELECT id FROM ratings WHERE trade_id = ? AND rater_id = ?')
    .get(tradeId, req.user.id);
  if (existing) {
    return res.status(409).json({ error: 'You have already rated this trade' });
  }

  // The person being rated is the other participant
  const rateeId = isRequester ? trade.provider_id : trade.requester_id;

  const result = db
    .prepare(
      'INSERT INTO ratings (trade_id, rater_id, ratee_id, score, comment) VALUES (?, ?, ?, ?, ?)'
    )
    .run(tradeId, req.user.id, rateeId, score, comment || null);

  const rating = db.prepare('SELECT * FROM ratings WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ rating });
});

// GET /api/ratings/user/:id  (public: a user's reviews and average)
router.get('/user/:id', (req, res) => {
  const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const summary = db
    .prepare(
      'SELECT ROUND(AVG(score), 1) AS average, COUNT(*) AS count FROM ratings WHERE ratee_id = ?'
    )
    .get(user.id);

  const reviews = db
    .prepare(
      `SELECT r.id, r.score, r.comment, r.created_at, u.name AS rater_name
       FROM ratings r
       JOIN users u ON u.id = r.rater_id
       WHERE r.ratee_id = ?
       ORDER BY r.created_at DESC`
    )
    .all(user.id);

  res.json({ user, average: summary.average, count: summary.count, reviews });
});

module.exports = router;