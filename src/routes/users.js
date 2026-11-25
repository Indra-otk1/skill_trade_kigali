import express from 'express';
import db from '../db/database.js';

const router = express.Router();

// GET /api/users/:id  (public profile: no email or other private fields)
router.get('/:id', (req, res) => {
  const user = db.prepare('SELECT id, name FROM "user" WHERE id = ?').get(req.params.id);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const rating = db
    .prepare(
      'SELECT ROUND(AVG(score), 1) AS average, COUNT(*) AS count FROM ratings WHERE ratee_id = ?'
    )
    .get(user.id);

  const completed = db
    .prepare(
      `SELECT COUNT(*) AS count FROM trades
       WHERE status = 'completed' AND (requester_id = ? OR provider_id = ?)`
    )
    .get(user.id, user.id);

  const skills = db
    .prepare(
      `SELECT id, title, description, category, created_at
       FROM skills WHERE user_id = ? ORDER BY created_at DESC`
    )
    .all(user.id);

  const reviews = db
    .prepare(
      `SELECT r.id, r.score, r.comment, r.created_at, u.id AS rater_id, u.name AS rater_name
       FROM ratings r
       JOIN "user" u ON u.id = r.rater_id
       WHERE r.ratee_id = ?
       ORDER BY r.created_at DESC`
    )
    .all(user.id);

  res.json({
    user,
    rating: { average: rating.average, count: rating.count },
    completed_trades: completed.count,
    skills,
    reviews,
  });
});

export default router;