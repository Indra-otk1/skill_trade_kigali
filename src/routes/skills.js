const express = require('express');
const db = require('../db/database');
const requireAuth = require('../middleware/auth');

const router = express.Router();

const CATEGORIES = [
  'Tech',
  'Design',
  'Languages',
  'Music',
  'Academics',
  'Business',
  'Fitness',
  'Other',
];

// Base query: skill + owner name + owner's average rating
const SKILL_SELECT = `
  SELECT
    s.id, s.title, s.description, s.category, s.created_at,
    u.id AS owner_id,
    u.name AS owner_name,
    (SELECT ROUND(AVG(score), 1) FROM ratings WHERE ratee_id = u.id) AS owner_rating,
    (SELECT COUNT(*) FROM ratings WHERE ratee_id = u.id) AS owner_rating_count
  FROM skills s
  JOIN users u ON u.id = s.user_id
`;

// GET /api/skills?q=guitar&category=Music
router.get('/', (req, res) => {
  const { q, category } = req.query;
  const conditions = [];
  const params = [];

  if (q) {
    conditions.push('(s.title LIKE ? OR s.description LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (category) {
    conditions.push('s.category = ?');
    params.push(category);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const skills = db
    .prepare(`${SKILL_SELECT} ${where} ORDER BY s.created_at DESC`)
    .all(...params);

  res.json({ skills });
});

// GET /api/skills/categories
router.get('/categories', (req, res) => {
  res.json({ categories: CATEGORIES });
});

// GET /api/skills/mine  (protected)
// Must be defined before '/:id' so "mine" is not treated as an id
router.get('/mine', requireAuth, (req, res) => {
  const skills = db
    .prepare(`${SKILL_SELECT} WHERE s.user_id = ? ORDER BY s.created_at DESC`)
    .all(req.user.id);

  res.json({ skills });
});

// GET /api/skills/:id
router.get('/:id', (req, res) => {
  const skill = db.prepare(`${SKILL_SELECT} WHERE s.id = ?`).get(req.params.id);

  if (!skill) {
    return res.status(404).json({ error: 'Skill not found' });
  }
  res.json({ skill });
});

// POST /api/skills  (protected)
router.post('/', requireAuth, (req, res) => {
  const { title, description, category } = req.body;

  if (!title || !description || !category) {
    return res.status(400).json({ error: 'Title, description and category are required' });
  }
  if (!CATEGORIES.includes(category)) {
    return res
      .status(400)
      .json({ error: `Category must be one of: ${CATEGORIES.join(', ')}` });
  }
  if (title.trim().length > 100) {
    return res.status(400).json({ error: 'Title must be 100 characters or fewer' });
  }
  if (description.trim().length > 1000) {
    return res.status(400).json({ error: 'Description must be 1000 characters or fewer' });
  }

  const result = db
    .prepare('INSERT INTO skills (user_id, title, description, category) VALUES (?, ?, ?, ?)')
    .run(req.user.id, title.trim(), description.trim(), category);

  const skill = db.prepare(`${SKILL_SELECT} WHERE s.id = ?`).get(result.lastInsertRowid);
  res.status(201).json({ skill });
});

// DELETE /api/skills/:id  (protected, owner only)
router.delete('/:id', requireAuth, (req, res) => {
  const skill = db.prepare('SELECT id, user_id FROM skills WHERE id = ?').get(req.params.id);

  if (!skill) {
    return res.status(404).json({ error: 'Skill not found' });
  }
  if (skill.user_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only delete your own skills' });
  }

  try {
    db.prepare('DELETE FROM skills WHERE id = ?').run(skill.id);
  } catch (err) {
    // A skill used in a trade can't be deleted because of the foreign keys
    return res.status(409).json({ error: 'This skill is part of a trade and cannot be deleted' });
  }

  res.json({ message: 'Skill deleted' });
});

module.exports = router;