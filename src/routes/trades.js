import express from 'express';
import db from '../db/database.js';
import requireAuth from '../middleware/auth.js';
const router = express.Router();

// Every trade route requires a logged-in user
router.use(requireAuth);

const TRADE_SELECT = `
  SELECT
    t.id, t.status, t.requester_confirmed, t.provider_confirmed, t.created_at,
    t.requester_id, ru.name AS requester_name,
    t.provider_id, pu.name AS provider_name,
    t.requested_skill_id, rs.title AS requested_skill_title,
    t.offered_skill_id, os.title AS offered_skill_title
  FROM trades t
  JOIN "user" ru ON ru.id = t.requester_id
  JOIN "user" pu ON pu.id = t.provider_id
  JOIN skills rs ON rs.id = t.requested_skill_id
  JOIN skills os ON os.id = t.offered_skill_id
`;

function getTrade(id) {
  return db.prepare(`${TRADE_SELECT} WHERE t.id = ?`).get(id);
}

// POST /api/trades
// Body: { requested_skill_id, offered_skill_id }
router.post('/', (req, res) => {
  const requestedSkillId = Number(req.body.requested_skill_id);
  const offeredSkillId = Number(req.body.offered_skill_id);

  if (!Number.isInteger(requestedSkillId) || !Number.isInteger(offeredSkillId)) {
    return res
      .status(400)
      .json({ error: 'requested_skill_id and offered_skill_id are required' });
  }

  const requestedSkill = db
    .prepare('SELECT id, user_id FROM skills WHERE id = ?')
    .get(requestedSkillId);
  const offeredSkill = db
    .prepare('SELECT id, user_id FROM skills WHERE id = ?')
    .get(offeredSkillId);

  if (!requestedSkill || !offeredSkill) {
    return res.status(404).json({ error: 'Skill not found' });
  }
  if (offeredSkill.user_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only offer one of your own skills' });
  }
  if (requestedSkill.user_id === req.user.id) {
    return res.status(400).json({ error: 'You cannot trade with yourself' });
  }

  const duplicate = db
    .prepare(
      `SELECT id FROM trades
       WHERE requester_id = ? AND requested_skill_id = ? AND offered_skill_id = ?
       AND status IN ('pending', 'accepted')`
    )
    .get(req.user.id, requestedSkillId, offeredSkillId);

  if (duplicate) {
    return res.status(409).json({ error: 'You already have an open request for this trade' });
  }

  const result = db
    .prepare(
      `INSERT INTO trades (requester_id, provider_id, requested_skill_id, offered_skill_id)
       VALUES (?, ?, ?, ?)`
    )
    .run(req.user.id, requestedSkill.user_id, requestedSkillId, offeredSkillId);

  res.status(201).json({ trade: getTrade(result.lastInsertRowid) });
});

// GET /api/trades  (all trades where I'm requester or provider)
router.get('/', (req, res) => {
  const trades = db
    .prepare(
      `${TRADE_SELECT}
       WHERE t.requester_id = ? OR t.provider_id = ?
       ORDER BY t.created_at DESC`
    )
    .all(req.user.id, req.user.id);

  res.json({ trades });
});

// GET /api/trades/:id  (participants only)
router.get('/:id', (req, res) => {
  const trade = getTrade(req.params.id);

  if (!trade) {
    return res.status(404).json({ error: 'Trade not found' });
  }
  if (trade.requester_id !== req.user.id && trade.provider_id !== req.user.id) {
    return res.status(403).json({ error: 'You are not part of this trade' });
  }
  res.json({ trade });
});

// Shared handler for accept / decline (provider only, pending trades only)
function respondToTrade(newStatus) {
  return (req, res) => {
    const trade = getTrade(req.params.id);

    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    if (trade.provider_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the skill owner can respond to this request' });
    }
    if (trade.status !== 'pending') {
      return res.status(409).json({ error: `Trade is already ${trade.status}` });
    }

    db.prepare('UPDATE trades SET status = ? WHERE id = ?').run(newStatus, trade.id);
    res.json({ trade: getTrade(trade.id) });
  };
}

// PATCH /api/trades/:id/accept
router.patch('/:id/accept', respondToTrade('accepted'));

// PATCH /api/trades/:id/decline
router.patch('/:id/decline', respondToTrade('declined'));

// PATCH /api/trades/:id/confirm
// Each person confirms that the exchange happened. Once both have, it's completed.
router.patch('/:id/confirm', (req, res) => {
  const trade = getTrade(req.params.id);

  if (!trade) {
    return res.status(404).json({ error: 'Trade not found' });
  }

  const isRequester = trade.requester_id === req.user.id;
  const isProvider = trade.provider_id === req.user.id;

  if (!isRequester && !isProvider) {
    return res.status(403).json({ error: 'You are not part of this trade' });
  }
  if (trade.status !== 'accepted') {
    return res.status(409).json({ error: 'Only accepted trades can be confirmed' });
  }

  const column = isRequester ? 'requester_confirmed' : 'provider_confirmed';
  db.prepare(`UPDATE trades SET ${column} = 1 WHERE id = ?`).run(trade.id);

  const updated = getTrade(trade.id);
  if (updated.requester_confirmed && updated.provider_confirmed) {
    db.prepare("UPDATE trades SET status = 'completed' WHERE id = ?").run(trade.id);
  }

  res.json({ trade: getTrade(trade.id) });
});
// ---------- Messages (inside a trade) ----------

const MESSAGE_SELECT = `
  SELECT m.id, m.body, m.created_at, m.sender_id, u.name AS sender_name
  FROM messages m
  JOIN "user" u ON u.id = m.sender_id
`;

// Returns the trade if the user may use its message thread, otherwise sends the error
function getMessagingTrade(req, res) {
  const trade = db
    .prepare('SELECT id, status, requester_id, provider_id FROM trades WHERE id = ?')
    .get(req.params.id);

  if (!trade) {
    res.status(404).json({ error: 'Trade not found' });
    return null;
  }
  if (trade.requester_id !== req.user.id && trade.provider_id !== req.user.id) {
    res.status(403).json({ error: 'You are not part of this trade' });
    return null;
  }
  if (trade.status !== 'accepted' && trade.status !== 'completed') {
    res.status(409).json({ error: 'Messaging opens once the trade is accepted' });
    return null;
  }
  return trade;
}

// GET /api/trades/:id/messages
router.get('/:id/messages', (req, res) => {
  const trade = getMessagingTrade(req, res);
  if (!trade) return;

  const messages = db
    .prepare(`${MESSAGE_SELECT} WHERE m.trade_id = ? ORDER BY m.id ASC`)
    .all(trade.id);

  res.json({ messages });
});

// POST /api/trades/:id/messages   Body: { body }
router.post('/:id/messages', (req, res) => {
  const trade = getMessagingTrade(req, res);
  if (!trade) return;

  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
  if (!body) {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }
  if (body.length > 1000) {
    return res.status(400).json({ error: 'Message must be 1000 characters or fewer' });
  }

  const result = db
    .prepare('INSERT INTO messages (trade_id, sender_id, body) VALUES (?, ?, ?)')
    .run(trade.id, req.user.id, body);

  const message = db.prepare(`${MESSAGE_SELECT} WHERE m.id = ?`).get(result.lastInsertRowid);
  res.status(201).json({ message });
});
export default router;