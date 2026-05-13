/* cabinet.js - role-based cabinet sections */

(function () {
  'use strict';

  let adminViewRole = 'admin';

  const ROLE_COPY = {
    guest: {
      label: 'Login',
      title: 'Потрібен Telegram-вхід',
      text: 'Увійдіть через Telegram, щоб кабінет підтягнув вашу роль і персональні розділи.'
    },
    visitor: {
      label: 'Visitor',
      title: 'Базовий кабінет відвідувача',
      text: 'Доступні профіль, обране і нагадування для збережених подій.'
    },
    resident: {
      label: 'Club member',
      title: 'Кабінет учасника клубу',
      text: 'До базового простору додано клубний статус і підготовлений розділ клубних подій.'
    },
    instructor: {
      label: 'Mentor',
      title: 'Кабінет ментора',
      text: 'Доступні менторські заявки на профіль, послуги, події та майбутній робочий простір.'
    },
    admin: {
      label: 'Admin',
      title: 'Адмін-центр Santiago',
      text: 'Доступні всі рольові блоки та підготовлений простір для заявок, користувачів і контенту.'
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

  function getEffectiveRole(user) {
    const role = normalizeRole(user);
    if (role === 'admin' && adminViewRole) return adminViewRole;
    return role;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString([], {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function statusLabel(status) {
    const labels = {
      pending: 'Очікує',
      needs_info: 'Треба інфо',
      approved: 'В роботі',
      published: 'Опубліковано',
      rejected: 'Відхилено',
      confirmed: 'Підтверджено',
      cancelled: 'Скасовано',
      draft: 'Чернетка'
    };
    return labels[status] || status || 'Статус';
  }

  function emptyState(text) {
    return `<div class="favorites-empty">${escapeHtml(text)}</div>`;
  }

  function renderCabinetFavorites() {
    if (window.MA3Favorites) {
      window.MA3Favorites.renderCabinet('#cabinet-favorites-list');
    }
  }

  function updateViewSwitch(user, role) {
    const actualRole = normalizeRole(user);
    const switcher = document.getElementById('cabinet-view-switch');
    if (!switcher) return;

    switcher.hidden = actualRole !== 'admin';
    switcher.querySelectorAll('[data-cabinet-view]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.cabinetView === role);
    });
  }

  function updateRoleSections(user) {
    const actualRole = normalizeRole(user);
    const role = getEffectiveRole(user);
    const copy = ROLE_COPY[role] || ROLE_COPY.visitor;
    const badge = document.getElementById('cabinet-role-badge');
    const title = document.getElementById('cabinet-role-title');
    const text = document.getElementById('cabinet-role-text');

    if (badge) {
      badge.className = `cabinet-role-badge cabinet-role-badge--${role}`;
      badge.textContent = actualRole === 'admin' && role !== 'admin' ? `Admin as ${copy.label}` : copy.label;
    }

    if (title) title.textContent = copy.title;
    if (text) text.textContent = copy.text;
    updateViewSwitch(user, role);

    document.querySelectorAll('[data-role-section]').forEach((section) => {
      const roles = (section.dataset.roles || '')
        .split(/\s+/)
        .map((item) => item.trim())
        .filter(Boolean);

      section.hidden = !roles.includes(role);
    });
  }

  async function renderBookings(user) {
    const container = document.getElementById('cabinet-bookings-list');
    if (!container) return;
    if (!user || !user.isLoggedIn || !user.id || !window.supabaseClient) {
      container.innerHTML = emptyState('Увійдіть через Telegram, щоб побачити записи.');
      return;
    }

    try {
      const { data, error } = await window.supabaseClient.rpc('get_profile_booking_status', {
        p_user_id: user.id,
        p_event_ids: null
      });
      if (error) throw error;

      if (!data || !data.length) {
        container.innerHTML = emptyState('Записів поки немає.');
        return;
      }

      container.innerHTML = data.map((booking) => `
        <article class="cabinet-data-item">
          <div class="cabinet-data-item__top">
            <h4 class="cabinet-data-item__title">${escapeHtml(booking.title || 'Подія')}</h4>
            <span class="cabinet-status-pill cabinet-status-pill--${escapeHtml(booking.status)}">${escapeHtml(statusLabel(booking.status))}</span>
          </div>
          <p class="cabinet-data-item__meta">${escapeHtml(formatDate(booking.start_time) || 'Дата уточнюється')}</p>
        </article>
      `).join('');
    } catch (err) {
      console.warn('[Cabinet] Booking status unavailable:', err);
      container.innerHTML = emptyState('Статуси записів зʼявляться після оновлення бази.');
    }
  }

  async function renderSubmissions(user) {
    const container = document.getElementById('cabinet-submissions-list');
    if (!container) return;
    if (!user || !user.isLoggedIn || !user.id || !window.supabaseClient) {
      container.innerHTML = emptyState('Увійдіть через Telegram, щоб побачити заявки.');
      return;
    }

    try {
      const { data, error } = await window.supabaseClient.rpc('get_profile_submissions', {
        p_user_id: user.id
      });
      if (error) throw error;

      if (!data || !data.length) {
        container.innerHTML = emptyState('Заявок поки немає. Створення профілю, послуги, проєкту або події відкривається через бот.');
        return;
      }

      container.innerHTML = data.map((submission) => {
        const status = submission.display_status || submission.status;
        return `
          <article class="cabinet-data-item">
            <div class="cabinet-data-item__top">
              <h4 class="cabinet-data-item__title">${escapeHtml(submission.title)}</h4>
              <span class="cabinet-status-pill cabinet-status-pill--${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span>
            </div>
            <p class="cabinet-data-item__meta">${escapeHtml(submission.kind)} · ${escapeHtml(formatDate(submission.created_at))}</p>
            ${submission.admin_message ? `<p class="cabinet-data-item__text">${escapeHtml(submission.admin_message)}</p>` : ''}
            ${submission.published_url ? `<a class="cabinet-action" href="${escapeHtml(submission.published_url)}">Відкрити публікацію</a>` : ''}
          </article>
        `;
      }).join('');
    } catch (err) {
      console.warn('[Cabinet] Submissions unavailable:', err);
      container.innerHTML = emptyState('Заявки зʼявляться після оновлення бази.');
    }
  }

  async function renderMentorActivity(user) {
    const container = document.getElementById('cabinet-mentor-activity-list');
    if (!container) return;
    if (!user || !user.isLoggedIn || !user.id || !window.supabaseClient) {
      container.innerHTML = emptyState('Увійдіть через Telegram, щоб побачити активності.');
      return;
    }

    try {
      const { data, error } = await window.supabaseClient.rpc('get_mentor_activity_summary', {
        p_user_id: user.id
      });
      if (error) throw error;

      if (!data || !data.length) {
        container.innerHTML = emptyState('Поки немає опублікованих подій або послуг, привʼязаних до цього профілю.');
        return;
      }

      container.innerHTML = data.map((item) => `
        <article class="cabinet-data-item">
          <div class="cabinet-data-item__top">
            <h4 class="cabinet-data-item__title">${escapeHtml(item.title)}</h4>
            <span class="cabinet-status-pill">${escapeHtml(item.item_type)}</span>
          </div>
          <p class="cabinet-data-item__meta">
            ${item.start_time ? `${escapeHtml(formatDate(item.start_time))} · ` : ''}
            saved ${Number(item.favorite_count || 0)} · public coming ${Number(item.participant_count || 0)} · bookings ${Number(item.booking_count || 0)}
          </p>
          ${item.capacity ? `<p class="cabinet-data-item__text">Ліміт: ${Number(item.participant_count || 0)} / ${Number(item.capacity)}</p>` : ''}
          ${item.url ? `<a class="cabinet-action" href="${escapeHtml(item.url)}">Відкрити</a>` : ''}
        </article>
      `).join('');
    } catch (err) {
      console.warn('[Cabinet] Mentor activity unavailable:', err);
      container.innerHTML = emptyState('Активності зʼявляться після оновлення бази.');
    }
  }

  function countValues(object) {
    return Object.values(object || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  }

  async function renderAdminOverview(user) {
    const container = document.getElementById('cabinet-admin-overview');
    if (!container) return;
    if (!user || user.role !== 'admin' || !window.supabaseClient) {
      container.innerHTML = emptyState('Огляд доступний тільки admin/master.');
      return;
    }

    try {
      const { data, error } = await window.supabaseClient.rpc('get_admin_platform_overview', {
        p_user_id: user.id
      });
      if (error) throw error;

      const overview = data || {};
      const profiles = overview.profiles_by_role || {};
      const submissions = overview.submissions_by_status || {};
      const events = overview.events || {};
      const services = overview.services || {};
      const bookings = overview.bookings_by_status || {};

      container.innerHTML = [
        ['Profiles', countValues(profiles)],
        ['Submissions pending', Number(submissions.pending || 0) + Number(submissions.needs_info || 0)],
        ['Events confirmed', Number(events.confirmed || 0)],
        ['Services published', Number(services.published || 0)],
        ['Bookings pending', Number(bookings.pending || 0)],
        ['Bookings confirmed', Number(bookings.confirmed || 0)],
        ['Public coming', Number(overview.public_participations || 0)],
        ['Published requests', Number(submissions.published || 0)]
      ].map(([label, value]) => `
        <div class="cabinet-data-stat">
          <strong>${escapeHtml(value)}</strong>
          <span>${escapeHtml(label)}</span>
        </div>
      `).join('');
    } catch (err) {
      console.warn('[Cabinet] Admin overview unavailable:', err);
      container.innerHTML = emptyState('Огляд зʼявиться після оновлення бази.');
    }
  }

  function renderOperationalData(user) {
    const role = getEffectiveRole(user);
    renderBookings(user);

    if (role === 'instructor') {
      renderSubmissions(user);
      renderMentorActivity(user);
    }

    if (role === 'admin') {
      renderAdminOverview(user);
    }
  }

  function initCabinet() {
    const user = getAuthUser();
    updateRoleSections(user);
    renderCabinetFavorites();
    renderOperationalData(user);

    document.querySelectorAll('[data-cabinet-view]').forEach((button) => {
      if (button.__ma3CabinetViewBound) return;
      button.__ma3CabinetViewBound = true;
      button.addEventListener('click', () => {
        adminViewRole = button.dataset.cabinetView || 'admin';
        const current = getAuthUser();
        updateRoleSections(current);
        renderOperationalData(current);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initCabinet, 120);
  });

  document.addEventListener('ma3-auth-changed', (event) => {
    updateRoleSections(event.detail);
    renderCabinetFavorites();
    renderOperationalData(event.detail);
  });

  window.MA3Cabinet = {
    renderCabinetFavorites,
    updateRoleSections
  };
})();
