'use strict';

// بيانات تجريبية فقط؛ لا تستخدمها لحماية معلومات حقيقية.
const DEMO_USERNAME = 'aboarap';
const DEMO_PASSWORD = 'aa1994';
const LOGIN_SETTING_KEY = 'soularab-login-required';
const THEME_SETTING_KEY = 'soularab-theme';

const loginForm = document.getElementById('login-form');
const loginScreen = document.getElementById('login-screen');
const mainScreen = document.getElementById('main-screen');
const loginMessage = document.getElementById('login-message');
const dashboardMessage = document.getElementById('dashboard-message');
const loginToggle = document.getElementById('login-toggle');
const logoutButton = document.getElementById('logout-button');
const themeToggle = document.getElementById('theme-toggle');

function readSetting(key, fallbackValue) {
  try {
    return localStorage.getItem(key) ?? fallbackValue;
  } catch {
    return fallbackValue;
  }
}

function saveSetting(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // يستمر التطبيق بالعمل خلال الزيارة الحالية إذا تعذر التخزين المحلي.
  }
}

// تسجيل الدخول معطل افتراضياً؛ يُفعّل من زر داخل التطبيق.
let loginRequired = readSetting(LOGIN_SETTING_KEY, 'disabled') === 'enabled';

function showLogin() {
  loginScreen.hidden = false;
  mainScreen.hidden = true;
  loginToggle.textContent = 'تعطيل تسجيل الدخول';
  logoutButton.hidden = true;
  loginMessage.textContent = '';
  document.getElementById('username').focus();
}

function showDashboard() {
  loginScreen.hidden = true;
  mainScreen.hidden = false;
  loginToggle.textContent = loginRequired
    ? 'تعطيل تسجيل الدخول'
    : 'تفعيل تسجيل الدخول';
  logoutButton.hidden = !loginRequired;
}

if (loginRequired) {
  showLogin();
} else {
  showDashboard();
}

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const formData = new FormData(loginForm);
  const username = String(formData.get('username') || '').trim();
  const password = String(formData.get('password') || '');

  if (username !== DEMO_USERNAME || password !== DEMO_PASSWORD) {
    loginMessage.textContent = 'بيانات الدخول غير صحيحة. يرجى المحاولة مرة أخرى.';
    return;
  }

  loginForm.reset();
  loginMessage.textContent = '';
  showDashboard();
});

loginToggle.addEventListener('click', () => {
  loginRequired = !loginRequired;
  saveSetting(LOGIN_SETTING_KEY, loginRequired ? 'enabled' : 'disabled');

  if (loginRequired) {
    showLogin();
  } else {
    loginForm.reset();
    showDashboard();
  }
});

logoutButton.addEventListener('click', () => {
  if (loginRequired) {
    loginForm.reset();
    showLogin();
  }
});

document.querySelectorAll('.feature-card').forEach((card) => {
  card.addEventListener('click', () => {
    dashboardMessage.textContent = card.dataset.message || '';
  });
});

function applyTheme(theme) {
  const isLight = theme === 'light';
  document.body.classList.toggle('light-theme', isLight);
  document.body.classList.toggle('dark-theme', !isLight);
  themeToggle.setAttribute('aria-pressed', String(isLight));
  themeToggle.textContent = isLight ? 'الوضع الداكن' : 'الوضع الفاتح';
}

applyTheme(readSetting(THEME_SETTING_KEY, 'dark'));

themeToggle.addEventListener('click', () => {
  const nextTheme = document.body.classList.contains('light-theme') ? 'dark' : 'light';
  applyTheme(nextTheme);
  saveSetting(THEME_SETTING_KEY, nextTheme);
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.error('تعذر تسجيل عامل الخدمة:', error);
    });
  });
}
