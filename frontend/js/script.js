const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const addForm = document.getElementById('add-form');
const list = document.getElementById('password-list');
const loginFormContainer = document.getElementById('login-form-container');
const registerFormContainer = document.getElementById('register-form-container');
const mainApp = document.getElementById('main-app');
const logoutBtn = document.getElementById('logout-btn');
const showRegister = document.getElementById('show-register');
const showLogin = document.getElementById('show-login');
const userDisplay = document.getElementById('user-display');
let authToken = localStorage.getItem('authToken');
let refreshToken = localStorage.getItem('refreshToken');
let currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (authToken && currentUser) {
  showMainApp();
} else {
  showLoginForm();
}
function showLoginForm() {
  loginFormContainer.style.display = 'block';
  registerFormContainer.style.display = 'none';
  mainApp.style.display = 'none';
}
function showRegisterForm() {
  loginFormContainer.style.display = 'none';
  registerFormContainer.style.display = 'block';
  mainApp.style.display = 'none';
}
function showMainApp() {
  loginFormContainer.style.display = 'none';
  registerFormContainer.style.display = 'none';
  mainApp.style.display = 'block';
  userDisplay.textContent = `Welcome, ${currentUser.username}`;
  loadPasswords();
}
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const deviceName = document.getElementById('device-name').value;
  const deviceFingerprint = document.getElementById('device-fingerprint').value;
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, deviceName, deviceFingerprint })
    });
    if (res.ok) {
      const data = await res.json();
      authToken = data.access_token;
      refreshToken = data.refresh_token;
      currentUser = data.user;
      localStorage.setItem('authToken', authToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('currentUser', JSON.stringify(currentUser)); 
      showMainApp();
    } else {
      const error = await res.json();
      alert(`Login failed: ${error.error}`);
    }
  } catch (err) {
    console.error('Login error:', err);
    alert('Login failed: Network error');
  }
});
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('register-username').value;
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    if (res.ok) {
      alert('Registration successful! Please login.');
      showLoginForm();
    } else {
      const error = await res.json();
      alert(`Registration failed: ${error.error}`);
    }
  } catch (err) {
    console.error('Registration error:', err);
    alert('Registration failed: Network error');
  }
});
addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const service = document.getElementById('service').value;
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  try {
    const res = await fetch('/api/passwords', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ service, username, password })
    });
    if (res.ok) {
      addForm.reset();
      loadPasswords();
    } else {
      const error = await res.json();
      alert(`Failed to add password: ${error.error}`);
    }
  } catch (err) {
    console.error('Add password error:', err);
    alert('Failed to add password: Network error');
  }
});
async function loadPasswords() {
  try {
    const res = await fetch('/api/passwords', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    if (res.ok) {
      const passwords = await res.json();
      list.innerHTML = '';
      passwords.forEach(p => {
        const li = document.createElement('li');
        li.innerHTML = `
          <div>
            <strong>${p.service}</strong><br>
            ${p.username} | <span>${p.password}</span>
          </div>
          <button class="delete-btn" data-id="${p.id}">Delete</button>
        `;
        list.appendChild(li);
      });
      document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          await deletePassword(id);
        });
      });
    } else {
      const error = await res.json();
      if (res.status === 401) {
        if (await refreshTokenFunc()) {
          await loadPasswords();
        } else {
          logout();
        }
      } else {
        alert(`Failed to load passwords: ${error.error}`);
      }
    }
  } catch (err) {
    console.error('Load passwords error:', err);
    alert('Failed to load passwords: Network error');
  }
}
async function deletePassword(id) {
  try {
    const res = await fetch(`/api/passwords/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (res.ok) {
      loadPasswords();
    } else {
      const error = await res.json();
      if (res.status === 401) {
        if (await refreshTokenFunc()) {
          await deletePassword(id);
        } else {
          logout();
        }
      } else {
        alert(`Failed to delete password: ${error.error}`);
      }
    }
  } catch (err) {
    console.error('Delete password error:', err);
    alert('Failed to delete password: Network error');
  }
}
async function refreshTokenFunc() {
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: refreshToken,
        device_fingerprint: 'web-browser'
      })
    });
    if (res.ok) {
      const data = await res.json();
      authToken = data.access_token;
      refreshToken = data.refresh_token;
      
      localStorage.setItem('authToken', authToken);
      localStorage.setItem('refreshToken', refreshToken);
      
      return true;
    } else {
      return false;
    }
  } catch (err) {
    console.error('Refresh token error:', err);
    return false;
  }
}
logoutBtn.addEventListener('click', logout);
function logout() {
  authToken = null;
  refreshToken = null;
  currentUser = null;
  localStorage.removeItem('authToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('currentUser');
  showLoginForm();
}
showRegister.addEventListener('click', (e) => {
  e.preventDefault();
  showRegisterForm();
});
showLogin.addEventListener('click', (e) => {
  e.preventDefault();
  showLoginForm();
});