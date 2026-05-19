/* Open Mic request popup */

(function () {
  'use strict';

  const TELEGRAM_BOT_URL = 'https://t.me/santioago_bot';
  const STORAGE_KEY = 'language';
  const DEFAULT_LANG = 'ru';
  const SUPPORTED = ['en', 'cz', 'ru', 'ua'];

  let popup;
  let form;
  let title;
  let summary;
  let messageLabel;
  let messageInput;
  let submitButton;
  let loginLink;
  let telegramLink;
  let status;
  let currentUser = window.MA3Auth ? window.MA3Auth.user : { role: 'guest', isLoggedIn: false };

  const LABELS = {
    title: {
      ru: 'Заявка на Open Mic',
      en: 'Open Mic request',
      cz: 'Žádost na Open Mic',
      ua: 'Заявка на Open Mic'
    },
    summary: {
      ru: 'Напишите, с чем хотите выступить, какой формат вам ближе и сколько времени нужно.',
      en: 'Write what you want to perform with, which format fits you, and how much time you need.',
      cz: 'Napište, s čím chcete vystoupit, jaký formát vám sedí a kolik času potřebujete.',
      ua: 'Напишіть, з чим хочете виступити, який формат вам ближчий і скільки часу потрібно.'
    },
    message: {
      ru: 'Текст заявки',
      en: 'Request text',
      cz: 'Text žádosti',
      ua: 'Текст заявки'
    },
    placeholder: {
      ru: 'Тема, формат, опыт, пожелания по дате или контакту',
      en: 'Topic, format, experience, date wishes, or contact details',
      cz: 'Téma, formát, zkušenost, přání k datu nebo kontakt',
      ua: 'Тема, формат, досвід, побажання щодо дати або контакту'
    },
    submit: {
      ru: 'Отправить заявку',
      en: 'Send request',
      cz: 'Odeslat žádost',
      ua: 'Надіслати заявку'
    },
    login: {
      ru: 'Войти через Telegram',
      en: 'Log in via Telegram',
      cz: 'Přihlásit se přes Telegram',
      ua: 'Увійти через Telegram'
    },
    telegram: {
      ru: 'Продолжить в Telegram',
      en: 'Continue in Telegram',
      cz: 'Pokračovat v Telegramu',
      ua: 'Продовжити в Telegram'
    },
    loginRequired: {
      ru: 'Чтобы отправить заявку на сайте, войдите через Telegram. Можно также продолжить заявку в Telegram.',
      en: 'Log in via Telegram to send the request on the site. You can also continue in Telegram.',
      cz: 'Pro odeslání žádosti na webu se přihlaste přes Telegram. Žádost můžete dokončit i v Telegramu.',
      ua: 'Щоб надіслати заявку на сайті, увійдіть через Telegram. Також можна продовжити в Telegram.'
    },
    missingText: {
      ru: 'Напишите текст заявки.',
      en: 'Write the request text.',
      cz: 'Napište text žádosti.',
      ua: 'Напишіть текст заявки.'
    },
    missingClient: {
      ru: 'Сервис заявок пока недоступен. Попробуйте через Telegram.',
      en: 'Requests are temporarily unavailable. Try Telegram.',
      cz: 'Žádosti jsou dočasně nedostupné. Zkuste Telegram.',
      ua: 'Сервіс заявок поки недоступний. Спробуйте Telegram.'
    },
    sending: {
      ru: 'Отправляем...',
      en: 'Sending...',
      cz: 'Odesíláme...',
      ua: 'Надсилаємо...'
    },
    success: {
      ru: 'Заявка отправлена. Админ увидит ее в кабинете.',
      en: 'Request sent. The admin will see it in the cabinet.',
      cz: 'Žádost byla odeslána. Admin ji uvidí v kabinetu.',
      ua: 'Заявку надіслано. Адмін побачить її в кабінеті.'
    },
    error: {
      ru: 'Не удалось отправить заявку. Попробуйте еще раз или продолжите в Telegram.',
      en: 'Could not send the request. Try again or continue in Telegram.',
      cz: 'Žádost se nepodařilo odeslat. Zkuste to znovu nebo pokračujte v Telegramu.',
      ua: 'Не вдалося надіслати заявку. Спробуйте ще раз або продовжіть у Telegram.'
    }
  };

  function detectLanguage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED.includes(stored)) return stored;
    } catch (err) {}
    return DEFAULT_LANG;
  }

  function label(key) {
    const lang = detectLanguage();
    const entry = LABELS[key];
    if (!entry) return key;
    return entry[lang] || entry.en || key;
  }

  function setStatus(message, type = '') {
    if (!status) return;
    status.textContent = message || '';
    status.dataset.state = type;
  }

  function updateTexts() {
    if (title) title.textContent = label('title');
    if (summary) summary.textContent = label('summary');
    if (messageLabel) messageLabel.textContent = label('message');
    if (messageInput) messageInput.placeholder = label('placeholder');
    if (submitButton) submitButton.textContent = label('submit');
    if (loginLink) loginLink.textContent = label('login');
    if (telegramLink) telegramLink.textContent = label('telegram');
  }

  function updateLoginState() {
    if (!submitButton || !loginLink || !telegramLink) return;
    const isLoggedIn = !!(currentUser && currentUser.isLoggedIn && currentUser.id);
    submitButton.disabled = !isLoggedIn;
    loginLink.hidden = true;
    telegramLink.hidden = isLoggedIn;
    if (!isLoggedIn) {
      setStatus(label('loginRequired'), 'info');
    } else if (status && status.dataset.state === 'info') {
      setStatus('');
    }
  }

  function openPopup(event) {
    if (event) event.preventDefault();
    if (!popup) return;
    updateTexts();
    if (messageInput) messageInput.value = '';
    setStatus('');
    updateLoginState();
    popup.hidden = false;
    requestAnimationFrame(() => {
      popup.classList.add('open');
      popup.setAttribute('aria-hidden', 'false');
      if (messageInput) messageInput.focus();
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

    if (!currentUser || !currentUser.isLoggedIn || !currentUser.id) {
      updateLoginState();
      return;
    }

    const message = messageInput ? messageInput.value.trim() : '';
    if (!message) {
      setStatus(label('missingText'), 'error');
      return;
    }

    if (!window.supabaseClient) {
      setStatus(label('missingClient'), 'error');
      return;
    }

    const originalText = submitButton ? submitButton.textContent : '';
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = label('sending');
    }
    setStatus('');

    try {
      const { error } = await window.supabaseClient.rpc('request_openmic_submission', {
        p_user_id: currentUser.id,
        p_message: message
      });
      if (error) throw error;

      setStatus(label('success'), 'success');
      if (messageInput) messageInput.value = '';
      setTimeout(closePopup, 850);
    } catch (err) {
      console.warn('[OpenMic] Request failed:', err);
      setStatus(label('error'), 'error');
      if (telegramLink) telegramLink.hidden = false;
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalText || label('submit');
      }
      if (!currentUser || !currentUser.isLoggedIn || !currentUser.id) {
        updateLoginState();
      }
    }
  }

  function init() {
    popup = document.getElementById('openmic-request-popup');
    if (!popup) return;

    form = document.getElementById('openmic-request-form');
    title = document.getElementById('openmic-request-title');
    summary = document.getElementById('openmic-request-summary');
    messageLabel = document.getElementById('openmic-request-message-label');
    messageInput = document.getElementById('openmic-request-message');
    submitButton = document.getElementById('openmic-request-submit');
    loginLink = document.getElementById('openmic-request-login');
    telegramLink = document.getElementById('openmic-request-telegram');
    status = document.getElementById('openmic-request-status');

    if (telegramLink) telegramLink.href = `${TELEGRAM_BOT_URL}?start=openmic`;
    document.querySelectorAll('[data-openmic-request]').forEach((button) => {
      button.addEventListener('click', openPopup);
    });
    popup.querySelectorAll('[data-openmic-request-close]').forEach((button) => {
      button.addEventListener('click', closePopup);
    });
    if (form) form.addEventListener('submit', submitRequest);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && popup.classList.contains('open')) closePopup();
    });
    document.addEventListener('ma3-auth-changed', (event) => {
      currentUser = event.detail || (window.MA3Auth ? window.MA3Auth.user : currentUser);
      updateLoginState();
    });
    document.addEventListener('click', (event) => {
      if (event.target && event.target.classList.contains('lang-btn')) {
        setTimeout(updateTexts, 0);
      }
    });

    updateTexts();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
