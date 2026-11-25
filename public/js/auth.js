const registerForm = document.getElementById('register-form');
const loginForm = document.getElementById('login-form');

if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const body = {
      name: document.getElementById('reg-name').value,
      email,
      password: document.getElementById('reg-password').value,
      callbackURL: '/dashboard.html', // where the verification link sends you
    };

    try {
      await api('/auth/sign-up/email', { method: 'POST', body });
      showMessage(
        'form-message',
        `Almost done! We sent a verification link to ${email}. Click it to verify your account; you'll be signed in automatically.`,
        'success'
      );
      registerForm.reset();
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
      await api('/auth/sign-in/email', { method: 'POST', body });
      window.location.href = '/dashboard.html';
    } catch (err) {
      showMessage('form-message', err.message);
    }
  });
}