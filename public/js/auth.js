const registerForm = document.getElementById('register-form');
const loginForm = document.getElementById('login-form');

if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      name: document.getElementById('reg-name').value,
      email: document.getElementById('reg-email').value,
      password: document.getElementById('reg-password').value,
    };

    try {
      const data = await api('/auth/register', { method: 'POST', body });
      showMessage('form-message', data.message, 'success');
      registerForm.reset();

      // Development only: the server returns the link instead of emailing it
      if (data.devVerificationLink) {
        document.getElementById('dev-link').replaceChildren(
          el('p', {}, el('a', { href: data.devVerificationLink }, 'Click here to verify your email (dev mode)'))
        );
      }
    } catch (err) {
      showMessage('form-message', err.message);
    }
  });
}

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      email: document.getElementById('login-email').value,
      password: document.getElementById('login-password').value,
    };

    try {
      const data = await api('/auth/login', { method: 'POST', body });
      saveSession(data.token, data.user);
      window.location.href = '/dashboard.html';
    } catch (err) {
      showMessage('form-message', err.message);
    }
  });
}