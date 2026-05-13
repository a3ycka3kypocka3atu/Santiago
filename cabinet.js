/* cabinet.js - role-based cabinet sections */

(function () {
  'use strict';

  const ROLE_COPY = {
    guest: {
      label: 'Login',
      title: 'Потрібен Telegram-вхід',
      text: 'Увійдіть через Telegram, щоб кабінет підтягнув вашу роль і персональні розділи.',
      primary: 'Telegram вхід'
    },
    visitor: {
      label: 'Visitor',
      title: 'Базовий кабінет відвідувача',
      text: 'Доступні профіль, обране і нагадування для збережених подій.',
      primary: 'Відкрити бот'
    },
    resident: {
      label: 'Club member',
      title: 'Кабінет учасника клубу',
      text: 'До базового простору додано клубний статус і підготовлений розділ клубних подій.',
      primary: 'Відкрити бот'
    },
    instructor: {
      label: 'Mentor',
      title: 'Кабінет ментора',
      text: 'Доступні менторські заявки на профіль, послуги, події та майбутній робочий простір.',
      primary: 'Відкрити бот'
    },
    admin: {
      label: 'Admin',
      title: 'Адмін-центр Santiago',
      text: 'Доступні всі рольові блоки та підготовлений простір для заявок, користувачів і контенту.',
      primary: 'Відкрити бот'
    }
  };

  function getAuthUser() {
    if (window.MA3Auth && window.MA3Auth.user) return window.MA3Auth.user;
    const id = localStorage.getItem('ma3-user-id');
    return {
      id,
      role: localStorage.getItem('ma3-user-role') || 'guest',
      name: localStorage.getItem('ma3-user-name') || null,
      isLoggedIn: !!id
    };
  }

  function normalizeRole(user) {
    if (!user || !user.isLoggedIn || !user.id) return 'guest';
    if (user.role === 'admin') return 'admin';
    if (user.role === 'instructor') return 'instructor';
    if (user.role === 'resident') return 'resident';
    return 'visitor';
  }

  function getStoredTelegramId() {
    try {
      const stored = JSON.parse(localStorage.getItem('ma3_user') || '{}');
      return stored.telegram_id || null;
    } catch (err) {
      return null;
    }
  }

  function setStatusText(text) {
    const statusText = document.getElementById('cabinet-role-text');
    if (statusText) statusText.textContent = text;
  }

  function renderCabinetFavorites() {
    if (window.MA3Favorites) {
      window.MA3Favorites.renderCabinet('#cabinet-favorites-list');
    }
  }

  function updateRoleSections(user) {
    const role = normalizeRole(user);
    const copy = ROLE_COPY[role] || ROLE_COPY.visitor;
    const badge = document.getElementById('cabinet-role-badge');
    const title = document.getElementById('cabinet-role-title');
    const text = document.getElementById('cabinet-role-text');
    const primaryAction = document.querySelector('.cabinet-status__actions .cabinet-action--primary span');

    if (badge) {
      badge.className = `cabinet-role-badge cabinet-role-badge--${role}`;
      badge.textContent = copy.label;
    }

    if (title) title.textContent = copy.title;
    if (text) text.textContent = copy.text;
    if (primaryAction) primaryAction.textContent = copy.primary;

    document.querySelectorAll('[data-role-section]').forEach((section) => {
      const roles = (section.dataset.roles || '')
        .split(/\s+/)
        .map((item) => item.trim())
        .filter(Boolean);

      section.hidden = !roles.includes(role);
    });
  }

  async function refreshRole() {
    const button = document.getElementById('cabinet-refresh-role');
    const telegramId = getStoredTelegramId();

    if (!window.MA3Auth || !telegramId) {
      setStatusText('Щоб оновити роль, зайдіть через Telegram-кнопку з бота. Після approve бот дасть посилання з вашим Telegram ID.');
      return;
    }

    if (button) button.disabled = true;
    setStatusText('Оновлюємо роль із Supabase...');

    try {
      const profile = await window.MA3Auth.syncProfile(telegramId);
      const user = profile ? window.MA3Auth.user : getAuthUser();
      updateRoleSections(user);
      setStatusText(profile ? (ROLE_COPY[normalizeRole(user)] || ROLE_COPY.visitor).text : 'Профіль не знайдено. Відкрийте Telegram-бот і зайдіть у кабінет з його кнопки.');
    } catch (err) {
      console.warn('[Cabinet] Role refresh failed:', err);
      setStatusText('Не вдалося оновити роль. Спробуйте відкрити кабінет через Telegram-бот ще раз.');
    } finally {
      if (button) button.disabled = false;
    }
  }

  function initCabinet() {
    updateRoleSections(getAuthUser());
    renderCabinetFavorites();

    const refreshButton = document.getElementById('cabinet-refresh-role');
    if (refreshButton && !refreshButton.__ma3CabinetBound) {
      refreshButton.__ma3CabinetBound = true;
      refreshButton.addEventListener('click', refreshRole);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initCabinet, 120);
  });

  document.addEventListener('ma3-auth-changed', (event) => {
    updateRoleSections(event.detail);
    renderCabinetFavorites();
  });

  window.MA3Cabinet = {
    refreshRole,
    renderCabinetFavorites,
    updateRoleSections
  };
})();
