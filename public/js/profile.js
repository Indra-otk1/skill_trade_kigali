function stars(score) {
  const full = Math.round(score);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

function formatDate(value) {
  // SQLite stores UTC like "2026-11-15 10:30:00"
  const date = new Date(value.replace(' ', 'T') + 'Z');
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function renderHeader(data) {
  const { user, rating, completed_trades } = data;
  const isMe = currentUser && currentUser.id === user.id;

  document.title = `${user.name} | SkillTrade Kigali`;
  document.getElementById('profile-header').replaceChildren(
    el(
      'div',
      { class: 'profile-header' },
      el('h1', {}, user.name),
      isMe ? el('span', { class: 'badge' }, 'This is you') : null
    ),
    el(
      'div',
      { class: 'stats' },
      el(
        'div',
        { class: 'stat' },
        el('strong', {}, rating.count ? `★ ${rating.average}` : '–'),
        el('span', { class: 'muted' }, `${rating.count} review${rating.count === 1 ? '' : 's'}`)
      ),
      el(
        'div',
        { class: 'stat' },
        el('strong', {}, String(completed_trades)),
        el('span', { class: 'muted' }, 'completed trades')
      )
    )
  );
}

function renderSkills(skills) {
  const box = document.getElementById('profile-skills');
  if (!skills.length) {
    box.replaceChildren(el('p', { class: 'muted' }, 'No skills posted yet.'));
    return;
  }
  box.replaceChildren(
    ...skills.map((s) =>
      el(
        'article',
        { class: 'card' },
        el('div', { class: 'card-top' }, el('h3', {}, s.title), el('span', { class: 'badge' }, s.category)),
        el('p', {}, s.description)
      )
    )
  );
}

function renderReviews(reviews) {
  const box = document.getElementById('profile-reviews');
  if (!reviews.length) {
    box.replaceChildren(el('p', { class: 'muted' }, 'No reviews yet.'));
    return;
  }
  box.replaceChildren(
    el(
      'div',
      { class: 'card' },
      reviews.map((r) =>
        el(
          'div',
          { class: 'review' },
          el('div', { class: 'card-top' }, el('span', { class: 'stars' }, stars(r.score)), el('span', { class: 'muted' }, formatDate(r.created_at))),
          r.comment ? el('p', {}, r.comment) : null,
          el('p', { class: 'meta' }, 'by ', el('a', { href: `/profile.html?id=${encodeURIComponent(r.rater_id)}` }, r.rater_name))
        )
      )
    )
  );
}

async function init() {
  await loadSession();

  // No ?id= in the URL: show the logged-in user's own profile
  const id = new URLSearchParams(window.location.search).get('id') || (currentUser && currentUser.id);
  if (!id) {
    window.location.href = '/login.html';
    return;
  }

  try {
    const data = await api(`/users/${encodeURIComponent(id)}`);
    renderHeader(data);
    renderSkills(data.skills);
    renderReviews(data.reviews);
  } catch (err) {
    showMessage('page-message', err.message);
  }
}

init();