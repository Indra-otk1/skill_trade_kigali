// Configure the environment BEFORE the app is loaded
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test_secret';
process.env.ALLOWED_EMAIL_DOMAINS = '';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const app = require('../src/server');

let server;
let base;

before(
  () =>
    new Promise((resolve) => {
      server = app.listen(0, () => {
        base = `http://localhost:${server.address().port}/api`;
        resolve();
      });
    })
);

after(() => {
  if (server.closeAllConnections) server.closeAllConnections();
  return new Promise((resolve) => server.close(resolve));
});

async function call(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(base + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

// Registers, verifies and logs in a user; returns { id, token }
async function createUser(name, email) {
  const reg = await call('/auth/register', {
    method: 'POST',
    body: { name, email, password: 'password123' },
  });
  const token = new URL(reg.data.devVerificationLink).searchParams.get('token');
  await call(`/auth/verify?token=${token}`);
  const login = await call('/auth/login', {
    method: 'POST',
    body: { email, password: 'password123' },
  });
  return { id: login.data.user.id, token: login.data.token };
}

// Shared between tests (they run in order)
const state = {};

test('health check responds', async () => {
  const { status, data } = await call('/health');
  assert.strictEqual(status, 200);
  assert.strictEqual(data.status, 'ok');
});

test('unknown API routes return a JSON 404', async () => {
  const { status, data } = await call('/nothing');
  assert.strictEqual(status, 404);
  assert.strictEqual(data.error, 'Route not found');
});

test('registration validates input', async () => {
  const shortPassword = await call('/auth/register', {
    method: 'POST',
    body: { name: 'A', email: 'a@test.com', password: 'short' },
  });
  assert.strictEqual(shortPassword.status, 400);

  const badEmail = await call('/auth/register', {
    method: 'POST',
    body: { name: 'A', email: 'not-an-email', password: 'password123' },
  });
  assert.strictEqual(badEmail.status, 400);
});

test('login is blocked until the email is verified', async () => {
  await call('/auth/register', {
    method: 'POST',
    body: { name: 'Unverified', email: 'unverified@test.com', password: 'password123' },
  });
  const login = await call('/auth/login', {
    method: 'POST',
    body: { email: 'unverified@test.com', password: 'password123' },
  });
  assert.strictEqual(login.status, 403);
});

test('verified users can log in and see their profile', async () => {
  state.alice = await createUser('Alice', 'alice@test.com');
  state.bob = await createUser('Bob', 'bob@test.com');

  const me = await call('/auth/me', { token: state.alice.token });
  assert.strictEqual(me.status, 200);
  assert.strictEqual(me.data.user.name, 'Alice');
});

test('duplicate emails and wrong passwords are rejected', async () => {
  const duplicate = await call('/auth/register', {
    method: 'POST',
    body: { name: 'Alice 2', email: 'alice@test.com', password: 'password123' },
  });
  assert.strictEqual(duplicate.status, 409);

  const wrong = await call('/auth/login', {
    method: 'POST',
    body: { email: 'alice@test.com', password: 'wrongpassword' },
  });
  assert.strictEqual(wrong.status, 401);
});

test('posting a skill requires login and a valid category', async () => {
  const noToken = await call('/skills', {
    method: 'POST',
    body: { title: 'X', description: 'Y', category: 'Tech' },
  });
  assert.strictEqual(noToken.status, 401);

  const badCategory = await call('/skills', {
    method: 'POST',
    token: state.alice.token,
    body: { title: 'X', description: 'Y', category: 'Cooking' },
  });
  assert.strictEqual(badCategory.status, 400);
});

test('users can post and search skills', async () => {
  const a = await call('/skills', {
    method: 'POST',
    token: state.alice.token,
    body: { title: 'Python tutoring', description: 'Python basics', category: 'Tech' },
  });
  assert.strictEqual(a.status, 201);
  state.aliceSkill = a.data.skill.id;

  const b = await call('/skills', {
    method: 'POST',
    token: state.bob.token,
    body: { title: 'Guitar lessons', description: 'Beginner guitar', category: 'Music' },
  });
  assert.strictEqual(b.status, 201);
  state.bobSkill = b.data.skill.id;

  const search = await call('/skills?q=guitar');
  assert.strictEqual(search.data.skills.length, 1);
  assert.strictEqual(search.data.skills[0].title, 'Guitar lessons');
});

test('users cannot delete other users skills', async () => {
  const res = await call(`/skills/${state.bobSkill}`, {
    method: 'DELETE',
    token: state.alice.token,
  });
  assert.strictEqual(res.status, 403);
});

test('trade rules are enforced', async () => {
  // Bob cannot offer Alice's skill
  const notYours = await call('/trades', {
    method: 'POST',
    token: state.bob.token,
    body: { requested_skill_id: state.aliceSkill, offered_skill_id: state.aliceSkill },
  });
  assert.strictEqual(notYours.status, 403);

  // Bob cannot trade with himself
  const self = await call('/trades', {
    method: 'POST',
    token: state.bob.token,
    body: { requested_skill_id: state.bobSkill, offered_skill_id: state.bobSkill },
  });
  assert.strictEqual(self.status, 400);
});

test('full trade flow: request, accept, mutual confirmation', async () => {
  const create = await call('/trades', {
    method: 'POST',
    token: state.bob.token,
    body: { requested_skill_id: state.aliceSkill, offered_skill_id: state.bobSkill },
  });
  assert.strictEqual(create.status, 201);
  assert.strictEqual(create.data.trade.status, 'pending');
  state.trade = create.data.trade.id;

  // The requester cannot accept their own request
  const selfAccept = await call(`/trades/${state.trade}/accept`, {
    method: 'PATCH',
    token: state.bob.token,
  });
  assert.strictEqual(selfAccept.status, 403);

  // Cannot confirm while still pending
  const early = await call(`/trades/${state.trade}/confirm`, {
    method: 'PATCH',
    token: state.bob.token,
  });
  assert.strictEqual(early.status, 409);

  const accept = await call(`/trades/${state.trade}/accept`, {
    method: 'PATCH',
    token: state.alice.token,
  });
  assert.strictEqual(accept.data.trade.status, 'accepted');

  // One confirmation is not enough
  const first = await call(`/trades/${state.trade}/confirm`, {
    method: 'PATCH',
    token: state.bob.token,
  });
  assert.strictEqual(first.data.trade.status, 'accepted');

  const second = await call(`/trades/${state.trade}/confirm`, {
    method: 'PATCH',
    token: state.alice.token,
  });
  assert.strictEqual(second.data.trade.status, 'completed');
});

test('ratings: only after completion, once per person, valid score', async () => {
  // A new, still-pending trade cannot be rated
  const pending = await call('/trades', {
    method: 'POST',
    token: state.bob.token,
    body: { requested_skill_id: state.aliceSkill, offered_skill_id: state.bobSkill },
  });
  const early = await call('/ratings', {
    method: 'POST',
    token: state.bob.token,
    body: { trade_id: pending.data.trade.id, score: 5 },
  });
  assert.strictEqual(early.status, 409);

  // Bob rates Alice on the completed trade
  const rate = await call('/ratings', {
    method: 'POST',
    token: state.bob.token,
    body: { trade_id: state.trade, score: 5, comment: 'Great tutor' },
  });
  assert.strictEqual(rate.status, 201);

  const duplicate = await call('/ratings', {
    method: 'POST',
    token: state.bob.token,
    body: { trade_id: state.trade, score: 4 },
  });
  assert.strictEqual(duplicate.status, 409);

  const invalid = await call('/ratings', {
    method: 'POST',
    token: state.alice.token,
    body: { trade_id: state.trade, score: 7 },
  });
  assert.strictEqual(invalid.status, 400);

  const reviews = await call(`/ratings/user/${state.alice.id}`);
  assert.strictEqual(reviews.data.average, 5);
  assert.strictEqual(reviews.data.count, 1);
});