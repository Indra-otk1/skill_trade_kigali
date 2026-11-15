# SkillTrade Kigali

A verified peer-to-peer skill exchange platform for students and young professionals in Kigali. Members post skills they can teach, browse what others offer, and trade skills directly, with no money involved. Trust comes from email verification, mutual trade confirmation and post-trade ratings.

## Features

- Registration with email verification and JWT login
- Post, browse, search and delete skills (filter by category)
- Trade requests: request, accept or decline, and mutual confirmation to complete
- Ratings and reviews, allowed only after a completed trade (one per person per trade)
- Simple web interface (browse, register, login, dashboard)

## Tech stack

Node.js, Express, SQLite (better-sqlite3), bcryptjs, JSON Web Tokens, and a plain HTML/CSS/JavaScript frontend.

## Getting started

Requires Node.js 18 or newer.

```bash
git clone <your-repo-url>
cd skilltrade-kigali
npm install
cp .env.example .env     # then edit .env and set JWT_SECRET
npm run dev
```

Open http://localhost:3000.

In development, the verification link is shown on the registration page and printed in the server console, because no email service is connected.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start with auto-reload (nodemon) |
| `npm start` | Start normally |
| `npm test` | Run the API tests |

## API overview

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Create an account |
| GET | `/api/auth/verify?token=` | No | Verify email |
| POST | `/api/auth/login` | No | Log in, returns JWT |
| GET | `/api/auth/me` | Yes | Current user |
| GET | `/api/skills` | No | Browse and search (`q`, `category`) |
| GET | `/api/skills/mine` | Yes | My skills |
| POST | `/api/skills` | Yes | Post a skill |
| DELETE | `/api/skills/:id` | Yes | Delete my skill |
| POST | `/api/trades` | Yes | Request a trade |
| GET | `/api/trades` | Yes | My trades |
| PATCH | `/api/trades/:id/accept` | Yes | Accept (skill owner) |
| PATCH | `/api/trades/:id/decline` | Yes | Decline (skill owner) |
| PATCH | `/api/trades/:id/confirm` | Yes | Confirm the exchange happened |
| POST | `/api/ratings` | Yes | Rate a partner after a completed trade |
| GET | `/api/ratings/user/:id` | No | A user's reviews and average |

## Project structure

```
src/
  server.js          App setup and routes
  db/database.js     SQLite connection and schema
  middleware/auth.js JWT authentication
  routes/            auth, skills, trades, ratings
public/              Frontend pages, CSS and JavaScript
test/                API tests
```

## Known limitations and future work

- Verification emails are not sent; connect an SMTP service for production.
- No password reset or profile editing yet.
- No in-app messaging between trade partners.
- Skills that are part of a trade cannot be deleted.