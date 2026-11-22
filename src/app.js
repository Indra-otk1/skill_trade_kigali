import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth.js';
import skillsRouter from './routes/skills.js';
import tradesRouter from './routes/trades.js';
import ratingsRouter from './routes/ratings.js';
import usersRouter from './routes/users.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.BETTER_AUTH_SECRET) {
  console.error('BETTER_AUTH_SECRET is missing. Add it to your .env file.');
  process.exit(1);
}

const app = express();

// Better Auth must be mounted BEFORE express.json()
app.all('/api/auth/*splat', toNodeHandler(auth));

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'SkillTrade Kigali' });
});

app.use('/api/skills', skillsRouter);
app.use('/api/trades', tradesRouter);
app.use('/api/ratings', ratingsRouter);
app.use('/api/users', usersRouter);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;