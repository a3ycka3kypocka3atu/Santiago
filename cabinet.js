/* cabinet.js - role-based cabinet sections */

(function () {
  'use strict';

  let adminViewRole = 'admin';
  let adminMasterViewRole = 'instructor';
  let masterViewRole = 'instructor';
  let currentRequestKind = null;

  const MASTER_REQUESTS = {
    profile: {
      title: 'Редагування профілю',
      defaultTitle: 'Редагування профілю майстра',
      hint: 'Напишіть, що треба змінити або додати у вашому профілі: біографія, практики, посилання, фото, формулювання.',
      placeholder: 'Наприклад: додати новий опис практики, замінити біографію, оновити посилання...'
    },
    service: {
      title: 'Нова послуга',
      defaultTitle: '',
      hint: 'Опишіть нову послугу так, щоб адмін міг оформити її на платформі.',
      placeholder: 'Формат, тривалість, ціна, для кого, що людина отримує, public/club/internal...'
    },
    event: {
      title: 'Нова подія',
      defaultTitle: '',
      hint: 'Опишіть подію або формат. Адмін перевірить текст і створить її у календарі.',
      placeholder: 'Тема, дата/час, тривалість, місце, ціна, ліміт, хто веде, опис для сторінки...'
    },
    project: {
      title: 'Новий проєкт',
      defaultTitle: '',
      hint: 'Опишіть проєкт, серію або колаборацію. Адмін оформить її на платформі вручну.',
      placeholder: 'Ідея, ціль, формат, команда, матеріали, посилання, що має зʼявитися на платформі...'
    }
  };

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
      text: 'До базового простору додано клубні події, участь і швидкий перехід до календаря.'
    },
    instructor: {
      label: 'Master',
      title: 'Кабінет майстра',
      text: 'Доступні заявки майстра на профіль, послуги, події, проєкти та майбутній робочий простір.'
    },
    admin: {
      label: 'Admin',
      title: 'Адмін-центр Santiago',
      text: 'Доступні всі рольові блоки та підготовлений простір для заявок, користувачів і контенту.'
    }
  };

  const PERSONAL_COPY = {
    visitor: {
      title: 'Мій простір',
      text: 'Базові речі для відвідувача: профіль, збережене, нагадування і швидкий перехід до подій та послуг.'
    },
    resident: {
      title: 'Простір учасника клубу',
      text: 'Клубний режим: ваші записи, обране, нагадування і швидкий перехід до подій, де ви берете участь як member Santiago.'
    },
    instructor: {
      title: 'Особистий простір майстра',
      text: 'Персональна частина кабінету майстра: профіль, збережене, нагадування і записи окремо від робочих інструментів.'
    },
    admin: {
      title: 'Особистий простір майстра',
      text: 'Персональна частина кабінету майстра: профіль, збережене, нагадування і записи окремо від робочих інструментів.'
    }
  };

  const MASTER_VIEW_COPY = {
    instructor: {
      title: 'Кабінет майстра — ваші інструменти',
      text: 'Тут зібрані заявки, профіль, послуги, події та проєкти, які майстер передає адміну в роботу.',
      header: 'Кабінет майстра',
      headerText: 'Робоча зона для профілю, послуг, подій, проєктів і заявок. Майстер може почати дію з кабінету або календаря.'
    },
    resident: {
      title: 'Кабінет майстра — простір учасника клубу',
      text: 'Ви залишаєтесь у кабінеті майстра, але зараз дивитесь member view: клубні події, власні записи, обране і участь.',
      header: 'Кабінет майстра: member view',
      headerText: 'Це клубний простір всередині кабінету майстра. Тут видно те, що важливо для участі: події, записи, обране і нагадування.'
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
    if (role === 'admin') {
      return adminViewRole === 'instructor' ? adminMasterViewRole : (adminViewRole || 'admin');
    }
    if (role === 'instructor' && ['resident', 'instructor'].includes(masterViewRole)) {
      return masterViewRole;
    }
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

  function getSubmissionTitle(kind, titleInput) {
    const config = MASTER_REQUESTS[kind] || MASTER_REQUESTS.event;
    const title = String(titleInput || '').trim();
    if (title) return title;
    return config.defaultTitle || config.title;
  }

  function setRequestStatus(text, type) {
    const status = document.getElementById('cabinet-request-status');
    if (!status) return;
    status.textContent = text || '';
    status.classList.toggle('is-error', type === 'error');
    status.classList.toggle('is-success', type === 'success');
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function openMasterRequest(kind) {
    const user = getAuthUser();
    if (normalizeRole(user) !== 'instructor' && normalizeRole(user) !== 'admin') return;

    const config = MASTER_REQUESTS[kind] || MASTER_REQUESTS.event;
    currentRequestKind = kind;

    const popup = document.getElementById('cabinet-request-popup');
    const title = document.getElementById('cabinet-request-title');
    const hint = document.getElementById('cabinet-request-hint');
    const kindInput = document.getElementById('cabinet-request-kind');
    const titleWrap = document.getElementById('cabinet-request-title-wrap');
    const titleInput = document.getElementById('cabinet-request-title-input');
    const detailsInput = document.getElementById('cabinet-request-text');
    const submit = document.getElementById('cabinet-request-submit');

    if (!popup || !titleInput || !detailsInput || !kindInput) return;
    if (title) title.textContent = config.title;
    if (hint) hint.textContent = config.hint;
    kindInput.value = kind;
    titleInput.value = kind === 'profile' ? config.defaultTitle : '';
    detailsInput.value = '';
    detailsInput.placeholder = config.placeholder;
    if (titleWrap) titleWrap.hidden = kind === 'profile';
    if (submit) submit.disabled = false;
    setRequestStatus('', null);

    popup.classList.add('open');
    popup.setAttribute('aria-hidden', 'false');
    detailsInput.focus();
  }

  function closeMasterRequest() {
    const popup = document.getElementById('cabinet-request-popup');
    if (!popup) return;
    popup.classList.remove('open');
    popup.setAttribute('aria-hidden', 'true');
    currentRequestKind = null;
  }

  async function submitMasterRequest(event) {
    event.preventDefault();

    const user = getAuthUser();
    const kindInput = document.getElementById('cabinet-request-kind');
    const titleInput = document.getElementById('cabinet-request-title-input');
    const detailsInput = document.getElementById('cabinet-request-text');
    const submit = document.getElementById('cabinet-request-submit');
    const kind = (kindInput && kindInput.value) || currentRequestKind || 'event';
    const details = detailsInput ? detailsInput.value.trim() : '';

    if (!user || !user.isLoggedIn || !user.id) {
      setRequestStatus('Увійдіть через Telegram, щоб надіслати заявку.', 'error');
      return;
    }

    if (!details) {
      setRequestStatus('Напишіть текст для адміна.', 'error');
      return;
    }

    if (!window.supabaseClient) {
      setRequestStatus('Supabase недоступний. Спробуйте пізніше.', 'error');
      return;
    }

    const title = getSubmissionTitle(kind, titleInput && titleInput.value);
    const originalText = submit ? submit.textContent : '';
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Надсилаємо...';
    }
    setRequestStatus('', null);

    try {
      const { error } = await window.supabaseClient.rpc('create_master_submission', {
        p_user_id: user.id,
        p_kind: kind,
        p_title: title,
        p_description: details,
        p_details: details,
        p_mode: kind === 'profile' ? 'profile_edit' : 'create_new'
      });
      if (error) throw error;

      setRequestStatus('Заявку надіслано адміну.', 'success');
      renderSubmissions(user);
      setTimeout(closeMasterRequest, 650);
    } catch (err) {
      console.warn('[Cabinet] Master request failed:', err);
      setRequestStatus('Не вдалося надіслати заявку. Перевірте підключення або оновлення бази.', 'error');
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = originalText || 'Надіслати адміну';
      }
    }
  }

  function renderCabinetFavorites() {
    const container = document.getElementById('cabinet-favorites-list');
    if (window.MA3Favorites && container && !container.closest('[hidden]')) {
      window.MA3Favorites.renderCabinet(container);
    }
  }

  function updateViewSwitch(user, role) {
    const actualRole = normalizeRole(user);
    const switchers = document.querySelectorAll('[data-cabinet-view-switch]');
    if (!switchers.length) return;

    switchers.forEach((switcher) => {
      const scope = switcher.dataset.cabinetViewSwitch;
      const allowedViews = scope === 'admin'
        ? (actualRole === 'admin' ? ['visitor', 'resident', 'instructor', 'admin'] : [])
        : (actualRole === 'instructor' || (actualRole === 'admin' && adminViewRole === 'instructor') ? ['instructor', 'resident'] : []);
      const activeRole = scope === 'admin'
        ? adminViewRole
        : (actualRole === 'admin' ? adminMasterViewRole : masterViewRole);

      switcher.hidden = !allowedViews.length;

      switcher.querySelectorAll('[data-cabinet-view]').forEach((button) => {
        button.hidden = !allowedViews.includes(button.dataset.cabinetView);
        button.classList.toggle('is-active', button.dataset.cabinetView === activeRole);
      });

      if (scope === 'master') {
        switcher.classList.toggle('is-tools-view', activeRole === 'instructor');
        switcher.classList.toggle('is-member-view', activeRole === 'resident');
      }
    });
  }

  function updateRoleSections(user) {
    const actualRole = normalizeRole(user);
    const role = getEffectiveRole(user);
    const isMasterContext = actualRole === 'instructor' || (actualRole === 'admin' && adminViewRole === 'instructor');
    const isMasterToolsView = isMasterContext && role === 'instructor';
    const showMasterShell = isMasterContext && role !== 'admin';
    const masterViewCopyRole = actualRole === 'admin' && isMasterContext ? adminMasterViewRole : role;
    const statusRole = actualRole === 'admin' ? 'admin' : role;
    const copy = ROLE_COPY[statusRole] || ROLE_COPY.visitor;
    const badge = document.getElementById('cabinet-role-badge');
    const title = document.getElementById('cabinet-role-title');
    const text = document.getElementById('cabinet-role-text');

    if (badge) {
      badge.className = `cabinet-role-badge cabinet-role-badge--${statusRole}`;
      if (actualRole === 'instructor' && role !== 'instructor') {
        badge.textContent = `Master as ${copy.label}`;
      } else {
        badge.textContent = copy.label;
      }
    }

    if (title) title.textContent = copy.title;
    if (text) text.textContent = copy.text;

    const personalCopy = PERSONAL_COPY[role] || PERSONAL_COPY.visitor;
    setText('cabinet-personal-title', personalCopy.title);
    setText('cabinet-personal-text', personalCopy.text);

    const masterCopy = MASTER_VIEW_COPY[masterViewCopyRole] || MASTER_VIEW_COPY.instructor;
    setText('cabinet-master-title', masterCopy.header);
    setText('cabinet-master-text', masterCopy.headerText);
    setText('cabinet-master-switch-title', masterCopy.title);
    setText('cabinet-master-switch-text', masterCopy.text);

    updateViewSwitch(user, role);

    document.querySelectorAll('[data-role-section]').forEach((section) => {
      const roles = (section.dataset.roles || '')
        .split(/\s+/)
        .map((item) => item.trim())
        .filter(Boolean);

      section.hidden = !roles.includes(role) || (isMasterToolsView && !section.closest('[data-master-shell]'));
    });

    document.querySelectorAll('[data-master-shell]').forEach((section) => {
      section.hidden = !showMasterShell;
    });
  }

  async function renderBookings(user) {
    const container = document.getElementById('cabinet-bookings-list');
    if (!container) return;
    if (!user || !user.isLoggedIn || !user.id || !window.supabaseClient) {
      container.innerHTML = emptyState('Увійдіть через Telegram, щоб побачити записи.');
      return;
    }

    let eventBookings = [];
    let serviceRequests = [];

    try {
      const { data, error } = await window.supabaseClient.rpc('get_profile_booking_status', {
        p_user_id: user.id,
        p_event_ids: null
      });
      if (error) throw error;
      eventBookings = data || [];
    } catch (err) {
      console.warn('[Cabinet] Booking status unavailable:', err);
    }

    try {
      const { data, error } = await window.supabaseClient.rpc('get_profile_service_booking_requests', {
        p_user_id: user.id
      });
      if (error) throw error;
      serviceRequests = data || [];
    } catch (err) {
      console.warn('[Cabinet] Service booking requests unavailable:', err);
      try {
        const { data, error } = await window.supabaseClient.rpc('get_profile_submissions', {
          p_user_id: user.id
        });
        if (error) throw error;
        serviceRequests = (data || [])
          .filter((submission) => submission.kind === 'service' && String(submission.title || '').startsWith('Бронювання:'))
          .map((submission) => ({
            service_title: String(submission.title || '').replace(/^Бронювання:\s*/, '') || 'Послуга',
            requested_at: null,
            requested_text: String(submission.details || '').split('\n')[0].replace(/^Бажаний час:\s*/, ''),
            status: submission.status,
            display_status: submission.display_status,
            created_at: submission.created_at
          }));
      } catch (fallbackErr) {
        console.warn('[Cabinet] Service booking fallback unavailable:', fallbackErr);
      }
    }

    if (!eventBookings.length && !serviceRequests.length) {
      container.innerHTML = emptyState('Записів поки немає.');
      return;
    }

    const eventRows = eventBookings.map((booking) => `
        <article class="cabinet-data-item">
          <div class="cabinet-data-item__top">
            <h4 class="cabinet-data-item__title">${escapeHtml(booking.title || 'Подія')}</h4>
            <span class="cabinet-status-pill cabinet-status-pill--${escapeHtml(booking.status)}">${escapeHtml(statusLabel(booking.status))}</span>
          </div>
          <p class="cabinet-data-item__meta">${escapeHtml(formatDate(booking.start_time) || 'Дата уточнюється')} · Подія</p>
        </article>
      `);

    const serviceRows = serviceRequests.map((request) => {
      const status = request.display_status || request.status;
      const requestedTime = formatDate(request.requested_at) || request.requested_text || formatDate(request.created_at) || 'Час уточнюється';
      return `
        <article class="cabinet-data-item">
          <div class="cabinet-data-item__top">
            <h4 class="cabinet-data-item__title">${escapeHtml(request.service_title || 'Послуга')}</h4>
            <span class="cabinet-status-pill cabinet-status-pill--${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span>
          </div>
          <p class="cabinet-data-item__meta">${escapeHtml(requestedTime)} · Послуга</p>
        </article>
      `;
    });

    container.innerHTML = [...eventRows, ...serviceRows].join('');
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
        container.innerHTML = emptyState('Заявок поки немає. Створіть заявку з блоку вище.');
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

  async function renderAdminSubmissions(user) {
    const container = document.getElementById('cabinet-admin-submissions-list');
    if (!container) return;
    if (!user || !user.isLoggedIn || !user.id || !window.supabaseClient) {
      container.innerHTML = emptyState('Увійдіть як адмін, щоб побачити заявки.');
      return;
    }

    try {
      const { data, error } = await window.supabaseClient.rpc('get_admin_submissions', {
        p_user_id: user.id
      });
      if (error) throw error;

      if (!data || !data.length) {
        container.innerHTML = emptyState('Нових заявок немає.');
        return;
      }

      container.innerHTML = data.map((submission) => {
        const status = submission.display_status || submission.status;
        const author = [submission.author_name, submission.author_username ? `@${submission.author_username}` : '']
          .filter(Boolean)
          .join(' · ');
        const canAct = ['pending', 'needs_info'].includes(status);
        return `
          <article class="cabinet-data-item" data-admin-submission="${escapeHtml(submission.id)}">
            <div class="cabinet-data-item__top">
              <h4 class="cabinet-data-item__title">${escapeHtml(submission.title)}</h4>
              <span class="cabinet-status-pill cabinet-status-pill--${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span>
            </div>
            <p class="cabinet-data-item__meta">${escapeHtml(submission.kind)} · ${escapeHtml(author || 'Майстер')} · ${escapeHtml(formatDate(submission.created_at))}</p>
            ${submission.description ? `<p class="cabinet-data-item__text">${escapeHtml(submission.description)}</p>` : ''}
            ${submission.details && submission.details !== submission.description ? `<p class="cabinet-data-item__text">${escapeHtml(submission.details)}</p>` : ''}
            <div class="cabinet-data-item__actions">
              ${canAct ? `<button class="cabinet-action" type="button" data-admin-submission-action="approved" data-submission-id="${escapeHtml(submission.id)}">Approve</button>` : ''}
              ${canAct ? `<button class="cabinet-action" type="button" data-admin-submission-action="needs_info" data-submission-id="${escapeHtml(submission.id)}">Треба інфо</button>` : ''}
              ${canAct ? `<button class="cabinet-action" type="button" data-admin-submission-action="rejected" data-submission-id="${escapeHtml(submission.id)}">Reject</button>` : ''}
            </div>
          </article>
        `;
      }).join('');
    } catch (err) {
      console.warn('[Cabinet] Admin submissions unavailable:', err);
      container.innerHTML = emptyState('Заявки адміна зʼявляться після оновлення бази.');
    }
  }

  async function updateAdminSubmission(event) {
    const button = event.target.closest('[data-admin-submission-action]');
    if (!button) return;

    const user = getAuthUser();
    const submissionId = button.dataset.submissionId;
    const workflowStatus = button.dataset.adminSubmissionAction;
    const originalText = button.textContent;

    if (!submissionId || !workflowStatus || !window.supabaseClient) return;
    button.disabled = true;
    button.textContent = '...';

    try {
      const { error } = await window.supabaseClient.rpc('update_admin_submission_status', {
        p_user_id: user.id,
        p_submission_id: submissionId,
        p_workflow_status: workflowStatus,
        p_admin_message: null,
        p_published_url: null
      });
      if (error) throw error;
      renderAdminSubmissions(user);
    } catch (err) {
      console.warn('[Cabinet] Admin submission update failed:', err);
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  function renderOperationalData(user) {
    const actualRole = normalizeRole(user);
    const role = getEffectiveRole(user);
    renderBookings(user);

    if (role === 'instructor') {
      renderSubmissions(user);
    }

    if (role === 'admin') {
      renderAdminSubmissions(user);
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
        const current = getAuthUser();
        const actualRole = normalizeRole(current);
        const requestedRole = button.dataset.cabinetView || actualRole;
        const switcher = button.closest('[data-cabinet-view-switch]');
        const scope = switcher ? switcher.dataset.cabinetViewSwitch : '';
        if (scope === 'admin' && actualRole === 'admin') {
          adminViewRole = requestedRole;
          if (requestedRole === 'instructor') adminMasterViewRole = 'instructor';
        } else if (scope === 'master' && actualRole === 'admin' && adminViewRole === 'instructor' && ['instructor', 'resident'].includes(requestedRole)) {
          adminMasterViewRole = requestedRole;
        } else if (scope === 'master' && actualRole === 'instructor' && ['instructor', 'resident'].includes(requestedRole)) {
          masterViewRole = requestedRole;
        }
        updateRoleSections(current);
        renderCabinetFavorites();
        renderOperationalData(current);
      });
    });

    document.querySelectorAll('[data-master-request]').forEach((button) => {
      if (button.__ma3MasterRequestBound) return;
      button.__ma3MasterRequestBound = true;
      button.addEventListener('click', () => openMasterRequest(button.dataset.masterRequest));
    });

    document.querySelectorAll('[data-master-card-link]').forEach((card) => {
      if (card.__ma3MasterCardLinkBound) return;
      card.__ma3MasterCardLinkBound = true;
      const openCardLink = () => {
        const href = card.dataset.masterCardLink;
        if (href) window.location.href = href;
      };
      card.addEventListener('click', (event) => {
        if (event.target.closest('a, button, input, textarea, select')) return;
        openCardLink();
      });
      card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        if (event.target.closest('a, button, input, textarea, select')) return;
        event.preventDefault();
        openCardLink();
      });
    });

    document.querySelectorAll('[data-master-request-close]').forEach((button) => {
      if (button.__ma3MasterRequestCloseBound) return;
      button.__ma3MasterRequestCloseBound = true;
      button.addEventListener('click', closeMasterRequest);
    });

    const requestPopup = document.getElementById('cabinet-request-popup');
    if (requestPopup && !requestPopup.__ma3MasterRequestBackdropBound) {
      requestPopup.__ma3MasterRequestBackdropBound = true;
      requestPopup.addEventListener('click', (event) => {
        if (event.target === requestPopup) closeMasterRequest();
      });
    }

    const requestForm = document.getElementById('cabinet-request-form');
    if (requestForm && !requestForm.__ma3MasterRequestSubmitBound) {
      requestForm.__ma3MasterRequestSubmitBound = true;
      requestForm.addEventListener('submit', submitMasterRequest);
    }

    const adminList = document.getElementById('cabinet-admin-submissions-list');
    if (adminList && !adminList.__ma3AdminSubmissionBound) {
      adminList.__ma3AdminSubmissionBound = true;
      adminList.addEventListener('click', updateAdminSubmission);
    }
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
    updateRoleSections,
    openMasterRequest
  };
})();
