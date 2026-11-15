const API = '/api';

function getToken() {
  return localStorage.getItem('token');
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('user'));
  } catch (e) {
    return null;
  }
}

function saveSession(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

function logout() {
  clearSession();
  window.location.href = '/';
}

// Wrapper around fetch: adds the JWT, parses JSON, throws readable errors
async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(API + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Expired or invalid token: log out and go to the login page
    if (res.status === 401 && token && !window.location.pathname.endsWith('login.html')) {
      clearSession();
      window.location.href = '/login.html';
    }
    throw new Error(data.error || 'Something went wrong');
  }
  return data;
}

// Small helper to build DOM elements. Text is added as text nodes, never as HTML,
// so user-provided content cannot inject scripts.
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

function renderNav() {
  const nav = document.getElementById('nav');
  if (!nav) return;

  const user = getUser();
  const links = [el('a', { href: '/' }, 'Browse skills')];

  if (user) {
    links.push(el('a', { href: '/dashboard.html' }, 'My dashboard'));
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