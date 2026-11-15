require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
require('./db/database');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is missing. Add it to your .env file.');
  process.exit(1);
}

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'SkillTrade Kigali' });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/skills', require('./routes/skills'));
app.use('/api/trades', require('./routes/trades'));
app.use('/api/ratings', require('./routes/ratings'));

// Unknown API routes return JSON instead of an HTML error page
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Central error handler: malformed JSON, unexpected crashes
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;

// Only start listening when run directly (so tests can import the app)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`SkillTrade Kigali running on http://localhost:${PORT}`);
  });
}

module.exports = app;