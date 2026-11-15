async function loadCategories() {
  const { categories } = await api('/skills/categories');
  const select = document.getElementById('skill-category');
  select.replaceChildren(...categories.map((c) => el('option', { value: c }, c)));
}

async function loadMySkills() {
  const { skills } = await api('/skills/mine');
  const box = document.getElementById('my-skills');

  if (!skills.length) {
    box.replaceChildren(el('p', { class: 'muted' }, 'You have not posted any skills yet.'));
    return;
  }

  box.replaceChildren(
    ...skills.map((s) =>
      el(
        'article',
        { class: 'card' },
        el('div', { class: 'card-top' }, el('h3', {}, s.title), el('span', { class: 'badge' }, s.category)),
        el('p', {}, s.description),
        el('button', { class: 'btn danger', onclick: () => deleteSkill(s.id) }, 'Delete')
      )
    )
  );
}

async function deleteSkill(id) {
  if (!confirm('Delete this skill?')) return;
  try {
    await api(`/skills/${id}`, { method: 'DELETE' });
    showMessage('page-message', 'Skill deleted.', 'success');
    await loadMySkills();
  } catch (err) {
    showMessage('page-message', err.message);
  }
}

async function loadTrades() {
  const { trades } = await api('/trades');
  const box = document.getElementById('my-trades');

  if (!trades.length) {
    box.replaceChildren(el('p', { class: 'muted' }, 'No trades yet. Browse skills to request one.'));
    return;
  }
  box.replaceChildren(...trades.map(renderTrade));
}

async function tradeAction(id, action) {
  try {
    await api(`/trades/${id}/${action}`, { method: 'PATCH' });
    showMessage('page-message', '');
    await loadTrades();
  } catch (err) {
    showMessage('page-message', err.message);
  }
}

function renderTrade(t) {
  const myId = getUser().id;
  const isRequester = t.requester_id === myId;
  const partner = isRequester ? t.provider_name : t.requester_name;
  const iGive = isRequester ? t.offered_skill_title : t.requested_skill_title;
  const iGet = isRequester ? t.requested_skill_title : t.offered_skill_title;
  const myConfirmed = isRequester ? t.requester_confirmed : t.provider_confirmed;

  const actions = el('div', { class: 'actions' });

  if (t.status === 'pending') {
    if (isRequester) {
      actions.append(el('span', { class: 'muted' }, 'Waiting for them to respond.'));
    } else {
      actions.append(
        el('button', { class: 'btn', onclick: () => tradeAction(t.id, 'accept') }, 'Accept'),
        el('button', { class: 'btn danger', onclick: () => tradeAction(t.id, 'decline') }, 'Decline')
      );
    }
  }

  if (t.status === 'accepted') {
    if (myConfirmed) {
      actions.append(el('span', { class: 'muted' }, 'You confirmed. Waiting for the other person to confirm.'));
    } else {
      actions.append(
        el('button', { class: 'btn', onclick: () => tradeAction(t.id, 'confirm') }, 'Confirm the exchange happened')
      );
    }
  }

  if (t.status === 'completed') {
    actions.append(ratingForm(t, partner));
  }

  return el(
    'article',
    { class: 'card' },
    el('div', { class: 'card-top' }, el('h3', {}, `Trade with ${partner}`), el('span', { class: `badge ${t.status}` }, t.status)),
    el('p', {}, `You give: ${iGive}`),
    el('p', {}, `You get: ${iGet}`),
    actions
  );
}

function ratingForm(t, partner) {
  const score = el('select', {}, [5, 4, 3, 2, 1].map((n) => el('option', { value: n }, `${n} ★`)));
  const comment = el('input', { type: 'text', placeholder: 'Optional comment', maxlength: '500' });
  const msg = el('span', { class: 'muted' });

  const button = el(
    'button',
    {
      class: 'btn',
      type: 'button',
      onclick: async () => {
        try {
          await api('/ratings', {
            method: 'POST',
            body: { trade_id: t.id, score: Number(score.value), comment: comment.value },
          });
          msg.textContent = 'Thanks, your rating was saved.';
          button.disabled = true;
        } catch (err) {
          msg.textContent = err.message;
        }
      },
    },
    `Rate ${partner}`
  );

  return el('div', { class: 'rating-form' }, score, comment, button, msg);
}

document.getElementById('skill-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/skills', {
      method: 'POST',
      body: {
        title: document.getElementById('skill-title').value,
        category: document.getElementById('skill-category').value,
        description: document.getElementById('skill-description').value,
      },
    });
    e.target.reset();
    showMessage('page-message', 'Skill posted.', 'success');
    await loadMySkills();
  } catch (err) {
    showMessage('page-message', err.message);
  }
});

if (!getToken()) {
  window.location.href = '/login.html';
} else {
  loadCategories();
  loadMySkills();
  loadTrades();
}