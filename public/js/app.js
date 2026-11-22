const API = '/api';

let currentUser = null;
let sessionPromise = null;

// Asks the server who is logged in (cookie-based session); cached per page load
function loadSession() {
  if (!sessionPromise) {
    sessionPromise = fetch('/api/auth/get-session')
      .then((res) => res.json().catch(() => null))
      .then((data) => {
        currentUser = data && data.user ? data.user : null;
        return currentUser;
      })
      .catch(() => null);
  }
  return sessionPromise;
}

async function logout() {
  try {
    await fetch('/api/auth/sign-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
  } catch (e) {
    // ignore: we redirect anyway
  }
  window.location.href = '/';
}

// Wrapper around fetch: parses JSON and throws readable errors.
// Our routes return { error }, Better Auth returns { message }.
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 && !window.location.pathname.endsWith('login.html')) {
      window.location.href = '/login.html';
    }
    throw new Error(data.error || data.message || 'Something went wrong');
  }
  return data;
}

// Builds DOM elements. Text is added as text nodes, never HTML, so
// user-provided content cannot inject scripts.
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined) continue;
    node.append(child.nodeType ? child : document.createTextNode(child));
  }
  return node;
}

function showMessage(id, text, type = 'error') {
  const box = document.getElementById(id);
  if (!box) return;
  box.textContent = text;
  box.className = `message ${type}`;
  box.hidden = !text;
}

function formatRating(average, count) {
  return count ? `★ ${average} (${count})` : 'No ratings yet';
}

async function renderNav() {
  const nav = document.getElementById('nav');
  if (!nav) return;

  const user = await loadSession();
  const links = [el('a', { href: '/' }, 'Browse skills')];

  if (user) {
    links.push(el('a', { href: '/dashboard.html' }, 'My dashboard'));
    links.push(el('a', { href: `/profile.html?id=${encodeURIComponent(user.id)}` }, 'My profile'));
    links.push(el('span', { class: 'nav-user' }, `Hi, ${user.name}`));
    links.push(el('button', { class: 'link-btn', onclick: logout }, 'Log out'));
  } else {
    links.push(el('a', { href: '/login.html' }, 'Log in'));
    links.push(el('a', { href: '/register.html' }, 'Register'));
  }

  nav.replaceChildren(
    el('a', { href: '/', class: 'brand' }, 'SkillTrade Kigali'),
    el('div', { class: 'nav-links' }, links)
  );
}

document.addEventListener('DOMContentLoaded', renderNav);