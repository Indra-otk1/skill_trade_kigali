
const skillsBox = document.getElementById('skills');
const searchInput = document.getElementById('search');
const categorySelect = document.getElementById('category');
const tradeDialog = document.getElementById('trade-dialog');
const offerSelect = document.getElementById('offer-select');
let targetSkill = null;

async function loadCategories() {
  const { categories } = await api('/skills/categories');
  categories.forEach((c) => categorySelect.append(el('option', { value: c }, c)));
}

async function loadSkills() {
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set('q', searchInput.value.trim());
  if (categorySelect.value) params.set('category', categorySelect.value);

  try {
    const { skills } = await api(`/skills?${params}`);
    renderSkills(skills);
  } catch (err) {
    showMessage('page-message', err.message);
  }
}

function renderSkills(skills) {
  if (!skills.length) {
    skillsBox.replaceChildren(el('p', { class: 'muted' }, 'No skills found.'));
    return;
  }
  skillsBox.replaceChildren(...skills.map(renderSkillCard));
}

function renderSkillCard(skill) {
  let action;
  if (!currentUser) {
    action = el('a', { class: 'btn secondary', href: '/login.html' }, 'Log in to request a trade');
  } else if (skill.owner_id === currentUser.id) {
    action = el('span', { class: 'muted' }, 'This is your skill');
  } else {
    action = el('button', { class: 'btn', onclick: () => openTradeDialog(skill) }, 'Request a trade');
  }

  return el(
    'article',
    { class: 'card skill', 'data-category': skill.category },
    el('div', { class: 'card-top' }, el('h3', {}, skill.title), el('span', { class: 'badge' }, skill.category)),
    el('p', { class: 'skill-desc' }, skill.description),
    el(
      'div',
      { class: 'skill-owner' },
      el('a', { class: 'owner-link', href: `/profile.html?id=${encodeURIComponent(skill.owner_id)}` }, skill.owner_name),
      el('span', { class: 'rating-chip' }, formatRating(skill.owner_rating, skill.owner_rating_count))
    ),
    action
  );
}

async function openTradeDialog(skill) {
  showMessage('trade-error', '');
  try {
    const { skills } = await api('/skills/mine');
    if (!skills.length) {
      showMessage('page-message', 'Post a skill on your dashboard first, so you have something to offer.');
      return;
    }
    targetSkill = skill;
    document.getElementById('trade-target').textContent =
      `You are requesting "${skill.title}" from ${skill.owner_name}.`;
    offerSelect.replaceChildren(...skills.map((s) => el('option', { value: s.id }, s.title)));
    tradeDialog.showModal();
  } catch (err) {
    showMessage('page-message', err.message);
  }
}

document.getElementById('trade-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/trades', {
      method: 'POST',
      body: { requested_skill_id: targetSkill.id, offered_skill_id: Number(offerSelect.value) },
    });
    tradeDialog.close();
    showMessage('page-message', 'Trade request sent. Track it on your dashboard.', 'success');
  } catch (err) {
    showMessage('trade-error', err.message);
  }
});

document.getElementById('trade-cancel').addEventListener('click', () => tradeDialog.close());

document.getElementById('filters').addEventListener('submit', (e) => {
  e.preventDefault();
  loadSkills();
});
categorySelect.addEventListener('change', loadSkills);

loadSession().then(() => {
  loadCategories();
  loadSkills();
});