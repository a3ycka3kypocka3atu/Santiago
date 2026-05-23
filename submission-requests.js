/* submission-requests.js - shared platform request popup */

(function () {
  'use strict';

  const LOGIN_URL = 'https://t.me/santioago_bot?start=login';

  let popup;
  let form;
  let titleEl;
  let introEl;
  let titleWrap;
  let titleInput;
  let textInput;
  let submitButton;
  let statusEl;
  let loginLink;
  let activeRequest = null;
  let savedPlaceholder = '';

  const KIND_LABELS = {
    profile: 'профілю',
    service: 'послуги',
    project: 'проєкту',
    event: 'події',
    role_application: 'заявки на майстра'
  };

  const OWNER_ALIASES = {
    andrisav: 'andrijpycha',
    waysantiago24: 'andrijpycha',
    andrijpycha: 'andrijpycha',
    kateryna_mihailovna: 'katerina',
    katerina: 'katerina',
    ivanprotinak: 'ivanprotinak'
  };

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizeKey(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  }

  function getAuthUser() {
    if (window.MA3Auth && window.MA3Auth.user) return window.MA3Auth.user;
    const id = localStorage.getItem('ma3-user-id');
    return {
      id,
      role: localStorage.getItem('ma3-user-role') || 'guest',
      name: localStorage.getItem('ma3-user-name') || '',
      isLoggedIn: !!id
    };
  }

  function getStoredProfile() {
    try {
      return JSON.parse(localStorage.getItem('ma3_user') || '{}') || {};
    } catch (err) {
      return {};
    }
  }

  function getUserKeys(user = getAuthUser()) {
    const profile = getStoredProfile();
    const rawKeys = [
      user.name,
      profile.full_name,
      profile.username,
      localStorage.getItem('ma3-user-name')
    ];
    const keys = rawKeys.map(normalizeKey).filter(Boolean);
    keys.forEach((key) => {
      if (OWNER_ALIASES[key]) keys.push(OWNER_ALIASES[key]);
    });
    return Array.from(new Set(keys));
  }

  function canEditEntity(button) {
    const user = getAuthUser();
    if (!user || !user.isLoggedIn || !['instructor', 'admin'].includes(user.role)) return false;

    const params = new URLSearchParams(window.location.search);
    if (params.get('mine') === '1') return true;

    const ownerKeys = [
      button.dataset.entityOwnerKey,
      button.dataset.entityContactKey
    ].map(normalizeKey).filter(Boolean);

    if (!ownerKeys.length) return true;
    const userKeys = getUserKeys(user);
    return ownerKeys.some((key) => userKeys.includes(key));
  }

  function refreshEditButtons() {
    document.querySelectorAll('[data-submission-mode="edit_existing"]').forEach((button) => {
      button.hidden = !canEditEntity(button);
    });
  }

  function ensurePopup() {
    if (popup) return popup;

    const wrapper = document.createElement('div');
    wrapper.className = 'submission-request-overlay';
    wrapper.id = 'submission-request-popup';
    wrapper.hidden = true;
    wrapper.setAttribute('aria-hidden', 'true');
    wrapper.setAttribute('role', 'dialog');
    wrapper.setAttribute('aria-labelledby', 'submission-request-title');
    wrapper.innerHTML = `
      <div class="submission-request-backdrop" data-submission-close></div>
      <div class="submission-request-dialog">
        <button class="submission-request-close" type="button" data-submission-close aria-label="Close">x</button>
        <h2 id="submission-request-title"></h2>
        <p class="submission-request-intro" id="submission-request-intro"></p>
        <form class="submission-request-form" id="submission-request-form">
          <label class="submission-request-title-wrap" id="submission-request-title-wrap">
            <span>Назва</span>
            <input id="submission-request-title-input" type="text" />
          </label>
          <label>
            <span>Текст для адміна</span>
            <textarea id="submission-request-text" rows="7" required></textarea>
          </label>
          <div class="submission-request-actions">
            <button class="submission-request-submit" id="submission-request-submit" type="submit">Надіслати адміну</button>
            <a class="submission-request-login" id="submission-request-login" href="${LOGIN_URL}" target="_blank" rel="noopener" hidden>Увійти через Telegram</a>
          </div>
          <p class="submission-request-status" id="submission-request-status" role="status" aria-live="polite"></p>
        </form>
      </div>
    `;

    document.body.appendChild(wrapper);

    popup = wrapper;
    form = document.getElementById('submission-request-form');
    titleEl = document.getElementById('submission-request-title');
    introEl = document.getElementById('submission-request-intro');
    titleWrap = document.getElementById('submission-request-title-wrap');
    titleInput = document.getElementById('submission-request-title-input');
    textInput = document.getElementById('submission-request-text');
    submitButton = document.getElementById('submission-request-submit');
    statusEl = document.getElementById('submission-request-status');
    loginLink = document.getElementById('submission-request-login');

    popup.querySelectorAll('[data-submission-close]').forEach((button) => {
      button.addEventListener('click', closePopup);
    });
    if (form) form.addEventListener('submit', submitRequest);
    if (textInput) {
      textInput.addEventListener('focus', () => {
        savedPlaceholder = textInput.placeholder || savedPlaceholder;
        textInput.placeholder = '';
      });
      textInput.addEventListener('blur', () => {
        if (!textInput.value.trim()) textInput.placeholder = savedPlaceholder;
      });
    }
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && popup && popup.classList.contains('open')) closePopup();
    });

    return popup;
  }

  function setStatus(message, type = '') {
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.dataset.state = type;
  }

  function getDefaultTitle(kind, mode, entityTitle) {
    if (kind === 'role_application') return 'Заявка стати майстром';
    if (mode === 'edit_existing') return `Зміна ${KIND_LABELS[kind] || 'сутності'}: ${entityTitle || ''}`.trim();
    return `Нова ${KIND_LABELS[kind] || 'заявка'}`;
  }

  function getDefaultIntro(kind, mode, entityTitle) {
    if (kind === 'role_application') {
      return 'Напишіть, чому ви хочете стати майстром Santiago і що можете давати людям. Адмін отримає заявку в Telegram-боті.';
    }
    if (mode === 'edit_existing') {
      return `Опишіть, що треба змінити${entityTitle ? ` у "${entityTitle}"` : ''}. Адмін отримає автора, текст і посилання на сутність у Telegram-боті. Якщо треба файл, надішліть його через бота.`;
    }
    return 'Опишіть, що треба створити. Текст піде адміну в Telegram-бот. Якщо треба файл, надішліть його через бота.';
  }

  function getDefaultPlaceholder(kind, mode) {
    if (kind === 'role_application') {
      return 'Хто ви, який досвід маєте, які формати хочете вести, посилання на портфоліо/соцмережі, чим можете бути корисні Santiago...';
    }
    if (mode === 'edit_existing') {
      return 'Що саме змінити: текст, ціну, дату, формат, опис, посилання, статус, видимість public/club/internal...';
    }
    return 'Опишіть суть заявки, деталі, посилання, дату/ціну/формат і все, що адміну потрібно для публікації...';
  }

  function openRequest(options = {}) {
    ensurePopup();

    const kind = options.kind || 'service';
    const mode = options.mode || (kind === 'role_application' ? 'apply_role' : 'edit_existing');
    const entityTitle = options.entityTitle || '';

    activeRequest = {
      kind,
      mode,
      entityTitle,
      entityUrl: options.entityUrl || window.location.pathname.split('/').pop() || 'index.html',
      entityKey: options.entityKey || ''
    };

    const modalTitle = options.modalTitle || (kind === 'role_application' ? 'Стати майстром' : (mode === 'edit_existing' ? 'Змінити сутність' : 'Нова заявка'));
    const defaultTitle = options.defaultTitle || getDefaultTitle(kind, mode, entityTitle);
    const intro = options.intro || getDefaultIntro(kind, mode, entityTitle);
    const placeholder = options.placeholder || getDefaultPlaceholder(kind, mode);

    if (titleEl) titleEl.textContent = modalTitle;
    if (introEl) introEl.textContent = intro;
    if (titleInput) titleInput.value = defaultTitle;
    if (titleWrap) titleWrap.hidden = kind === 'role_application';
    if (textInput) {
      textInput.value = '';
      textInput.placeholder = placeholder;
      savedPlaceholder = placeholder;
    }
    if (loginLink) loginLink.hidden = true;
    if (submitButton) submitButton.disabled = false;
    setStatus('', '');

    popup.hidden = false;
    requestAnimationFrame(() => {
      popup.classList.add('open');
      popup.setAttribute('aria-hidden', 'false');
      if (textInput) textInput.focus();
    });
  }

  function closePopup() {
    if (!popup) return;
    popup.classList.remove('open');
    popup.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
      if (!popup.classList.contains('open')) popup.hidden = true;
    }, 180);
  }

  async function submitRequest(event) {
    event.preventDefault();
    if (!activeRequest) return;

    const user = getAuthUser();
    const details = textInput ? textInput.value.trim() : '';

    if (!details) {
      setStatus('Напишіть текст для адміна.', 'error');
      return;
    }

    if (!user || !user.isLoggedIn || !user.id) {
      setStatus('Спочатку увійдіть через Telegram, щоб адмін бачив автора заявки.', 'error');
      if (loginLink) loginLink.hidden = false;
      return;
    }

    if (!window.supabaseClient) {
      setStatus('Сервіс заявок поки недоступний. Спробуйте через Telegram.', 'error');
      if (loginLink) loginLink.hidden = false;
      return;
    }

    const originalText = submitButton ? submitButton.textContent : '';
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Надсилаємо...';
    }

    try {
      const { error } = await window.supabaseClient.rpc('create_master_submission', {
        p_user_id: user.id,
        p_kind: activeRequest.kind,
        p_title: titleInput && titleInput.value.trim() ? titleInput.value.trim() : getDefaultTitle(activeRequest.kind, activeRequest.mode, activeRequest.entityTitle),
        p_description: details,
        p_details: details,
        p_mode: activeRequest.mode,
        p_entity_title: activeRequest.entityTitle || null,
        p_entity_url: activeRequest.entityUrl || null,
        p_entity_key: activeRequest.entityKey || null
      });
      if (error) throw error;

      setStatus('Заявку надіслано адміну в Telegram-бот.', 'success');
      setTimeout(closePopup, 1100);
    } catch (err) {
      console.warn('[SubmissionRequests] Request failed:', err);
      setStatus('Не вдалося надіслати заявку. Перевірте вхід через Telegram або оновлення бази.', 'error');
      if (submitButton) submitButton.disabled = false;
    } finally {
      if (submitButton) submitButton.textContent = originalText || 'Надіслати адміну';
    }
  }

  function openFromTrigger(trigger) {
    openRequest({
      kind: trigger.dataset.submissionRequest,
      mode: trigger.dataset.submissionMode,
      entityTitle: trigger.dataset.submissionEntityTitle,
      entityUrl: trigger.dataset.submissionEntityUrl,
      entityKey: trigger.dataset.submissionEntityKey,
      defaultTitle: trigger.dataset.submissionTitle,
      intro: trigger.dataset.submissionIntro,
      placeholder: trigger.dataset.submissionPlaceholder,
      modalTitle: trigger.dataset.submissionModalTitle
    });
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-submission-request]');
    if (!trigger || trigger.hidden) return;
    event.preventDefault();
    event.stopPropagation();
    openFromTrigger(trigger);
  });

  document.addEventListener('DOMContentLoaded', refreshEditButtons);
  document.addEventListener('ma3-auth-changed', refreshEditButtons);

  window.MA3SubmissionRequests = {
    open: openRequest,
    refreshEditButtons,
    normalizeKey
  };
})();
