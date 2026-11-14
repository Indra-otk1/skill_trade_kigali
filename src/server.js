require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'SkillTrade Kigali' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SkillTrade Kigali running on http://localhost:${PORT}`);
});