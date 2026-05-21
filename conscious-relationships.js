(function () {
  'use strict';

  const PROJECT_SLUG = 'conscious-relationships';
  const PROJECT_TITLE = 'Платформа усвідомлених стосунків';
  const LOGIN_URL = 'https://t.me/santioago_bot?start=login';

  let popup;
  let form;
  let commentInput;
  let submitButton;
  let loginButton;
  let statusEl;
  let currentUser = window.MA3Auth ? window.MA3Auth.user : { isLoggedIn: false, id: null };

  function setStatus(message, state = '') {
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.dataset.state = state;
  }

  function isLoggedIn() {
    return !!(currentUser && currentUser.isLoggedIn && currentUser.id);
  }

  function updateLoginState() {
    if (!submitButton || !loginButton) return;
    const loggedIn = isLoggedIn();
    submitButton.disabled = !loggedIn;
    loginButton.hidden = loggedIn;
    if (!loggedIn) {
      loginButton.href = LOGIN_URL;
      setStatus('Щоб майстер отримав посилання на вас, спочатку увійдіть через Telegram.', 'info');
    } else if (statusEl && statusEl.dataset.state === 'info') {
      setStatus('');
    }
  }

  function openPopup() {
    if (!popup) return;
    if (commentInput) commentInput.value = '';
    setStatus('');
    updateLoginState();
    popup.hidden = false;
    requestAnimationFrame(() => {
      popup.classList.add('open');
      popup.setAttribute('aria-hidden', 'false');
      if (isLoggedIn() && commentInput) commentInput.focus();
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

    if (!isLoggedIn()) {
      updateLoginState();
      return;
    }

    if (!window.supabaseClient) {
      setStatus('Заявки зараз недоступні. Спробуйте увійти через Telegram і написати майстру напряму.', 'error');
      return;
    }

    const originalText = submitButton ? submitButton.textContent : '';
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = '...';
    }

    try {
      const pageUrl = `${window.location.origin}${window.location.pathname}`;
      const { error } = await window.supabaseClient.rpc('request_project_master_contact', {
        p_user_id: currentUser.id,
        p_project_slug: PROJECT_SLUG,
        p_project_title: PROJECT_TITLE,
        p_page_url: pageUrl,
        p_comment: commentInput ? commentInput.value.trim() : '',
        p_target_master_slugs: ['andrijpycha']
      });

      if (error) throw error;

      setStatus('Заявку надіслано. Майстер отримає повідомлення в боті й напише вам.', 'success');
      if (commentInput) commentInput.value = '';
    } catch (err) {
      console.warn('[Relationships] Request failed:', err);
      setStatus('Не вдалося надіслати заявку. Спробуйте ще раз або напишіть через Telegram.', 'error');
      if (submitButton) submitButton.disabled = false;
    } finally {
      if (submitButton) submitButton.textContent = originalText || 'Підтвердити заявку';
    }
  }

  function setupPlatformPlaceholder() {
    document.querySelectorAll('[data-platform-link]').forEach((link) => {
      link.addEventListener('click', (event) => {
        const href = link.getAttribute('href');
        if (!href || href === '#') {
          event.preventDefault();
          link.blur();
        }
      });
    });
  }

  function init() {
    popup = document.getElementById('relationship-request-popup');
    form = document.getElementById('relationship-request-form');
    commentInput = document.getElementById('relationship-request-comment');
    submitButton = document.getElementById('relationship-request-submit');
    loginButton = document.getElementById('relationship-request-login');
    statusEl = document.getElementById('relationship-request-status');

    document.querySelectorAll('[data-relationship-request-open]').forEach((button) => {
      button.addEventListener('click', openPopup);
    });

    if (popup) {
      popup.querySelectorAll('[data-relationship-request-close]').forEach((button) => {
        button.addEventListener('click', closePopup);
      });
    }

    if (form) form.addEventListener('submit', submitRequest);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && popup && popup.classList.contains('open')) closePopup();
    });
    document.addEventListener('ma3-auth-changed', (event) => {
      currentUser = event.detail || currentUser;
      updateLoginState();
    });

    setupPlatformPlaceholder();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
