/* ═══════════════════════════════════════════════════════════
   SERVICES — Dynamic Filter Engine (Fully Restored & Fixed)
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  let GRID, EMPTY_STATE, RESET_BTN;
  let bookingPopup, bookingForm, bookingTitle, bookingSummary, bookingDate, bookingTime, bookingNote, bookingSubmit, bookingLogin, bookingTelegram, bookingStatus;
  let activeBookingService = null;
  const state = { category: 'all', format: 'all', provider: 'all', sort: 'default' };
  let allCards = [];
  let currentUser = window.MA3Auth ? window.MA3Auth.user : { role: 'guest', isLoggedIn: false };

  const STORAGE_KEY = 'language';
  const DEFAULT_LANG = 'ru';
  const SUPPORTED = ['en', 'cz', 'ru', 'ua'];
  const TELEGRAM_BOT_URL = 'https://t.me/santioago_bot';

  function detectLanguage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED.includes(stored)) return stored;
    } catch(e) {}
    return DEFAULT_LANG;
  }

  let currentLang = detectLanguage();

  function t(key) {
    if (!key) return '';
    const lang = currentLang || detectLanguage();
    const translations = window.translations;
    
    if (translations && translations[lang] && translations[lang][key]) {
      return translations[lang][key];
    }
    if (translations && translations['en'] && translations['en'][key]) {
      return translations['en'][key];
    }
    return key;
  }

  function fmt(key) {
    const labels = {
      individual: { ru: 'Индивидуально', en: 'Individual', cz: 'Individuálně', ua: 'Індивідуально' },
      group: { ru: 'Групповое', en: 'Group', cz: 'Skupinové', ua: 'Групове' }
    };
    if (!labels[key]) return key || '';
    return labels[key][currentLang] || labels[key]['en'] || key;
  }

  function getRoleDiscount() {
    return currentUser && ['resident', 'instructor'].includes(currentUser.role) ? 0.1 : 0;
  }

  function getDisplayPrice(service) {
    const raw = t(service.price) || '';
    const match = raw.match(/(\d+(?:[.,]\d+)?)/);
    const discount = getRoleDiscount();
    if (!match || !discount) return raw;

    const normalPrice = Number(match[1].replace(',', '.'));
    if (!Number.isFinite(normalPrice)) return raw;

    const discounted = Math.round(normalPrice * (1 - discount));
    const note = {
      ru: 'цена резидента/ментора',
      en: 'resident/mentor price',
      cz: 'cena rezidenta/mentora',
      ua: 'ціна резидента/ментора'
    };
    return raw.replace(match[1], String(discounted)) + ` · ${note[currentLang] || note.en}`;
  }

  const SERVICE_BOOKING_LABELS = {
    book: { ru: 'Забронировать время', en: 'Book time', cz: 'Rezervovat čas', ua: 'Забронювати час' },
    title: { ru: 'Забронировать время', en: 'Book a time', cz: 'Rezervovat čas', ua: 'Забронювати час' },
    summary: {
      ru: 'Выберите желаемый день и время для услуги “{{service}}”.',
      en: 'Choose the preferred day and time for “{{service}}”.',
      cz: 'Vyberte preferovaný den a čas pro službu „{{service}}”.',
      ua: 'Оберіть бажаний день і час для послуги “{{service}}”.'
    },
    date: { ru: 'Дата', en: 'Date', cz: 'Datum', ua: 'Дата' },
    time: { ru: 'Время', en: 'Time', cz: 'Čas', ua: 'Час' },
    note: { ru: 'Комментарий', en: 'Note', cz: 'Poznámka', ua: 'Коментар' },
    placeholder: {
      ru: 'Запрос, пожелания или контакт для уточнения',
      en: 'Request, preferences, or a contact for confirmation',
      cz: 'Přání, dotaz nebo kontakt pro potvrzení',
      ua: 'Запит, побажання або контакт для уточнення'
    },
    submit: { ru: 'Отправить заявку', en: 'Send request', cz: 'Odeslat žádost', ua: 'Надіслати заявку' },
    login: { ru: 'Войти через Telegram', en: 'Log in via Telegram', cz: 'Přihlásit se přes Telegram', ua: 'Увійти через Telegram' },
    telegram: { ru: 'Продолжить в Telegram', en: 'Continue in Telegram', cz: 'Pokračovat v Telegramu', ua: 'Продовжити в Telegram' },
    loginRequired: {
      ru: 'Чтобы отправить заявку без входа на сайт, продолжите в Telegram.',
      en: 'To send the request without website login, continue in Telegram.',
      cz: 'Pro odeslání bez přihlášení na web pokračujte v Telegramu.',
      ua: 'Щоб надіслати заявку без входу на сайт, продовжіть у Telegram.'
    },
    missingClient: {
      ru: 'Сервис заявок пока недоступен. Попробуйте через Telegram.',
      en: 'Requests are temporarily unavailable. Try via Telegram.',
      cz: 'Žádosti jsou dočasně nedostupné. Zkuste Telegram.',
      ua: 'Сервіс заявок поки недоступний. Спробуйте через Telegram.'
    },
    invalidDate: { ru: 'Выберите корректную дату и время.', en: 'Choose a valid date and time.', cz: 'Vyberte platné datum a čas.', ua: 'Оберіть коректну дату й час.' },
    pastDate: { ru: 'Выберите будущий день и время.', en: 'Choose a future day and time.', cz: 'Vyberte budoucí den a čas.', ua: 'Оберіть майбутній день і час.' },
    success: {
      ru: 'Заявка отправлена. Статус появится в кабинете.',
      en: 'Request sent. The status will appear in your cabinet.',
      cz: 'Žádost byla odeslána. Stav uvidíte v kabinetu.',
      ua: 'Заявку надіслано. Статус зʼявиться в кабінеті.'
    },
    error: {
      ru: 'Не удалось отправить заявку. Попробуйте еще раз.',
      en: 'Could not send the request. Please try again.',
      cz: 'Žádost se nepodařilo odeslat. Zkuste to prosím znovu.',
      ua: 'Не вдалося надіслати заявку. Спробуйте ще раз.'
    },
    fallback: {
      ru: 'Можно завершить заявку в Telegram с выбранной датой и временем.',
      en: 'You can finish the request in Telegram with the selected date and time.',
      cz: 'Žádost můžete dokončit v Telegramu s vybraným datem a časem.',
      ua: 'Можна завершити заявку в Telegram з обраною датою й часом.'
    }
  };

  function serviceBookingLabel(key) {
    const entry = SERVICE_BOOKING_LABELS[key];
    if (!entry) return key;
    return entry[currentLang] || entry.en || key;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizeProvider(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');
  }

  function getProviderType(service) {
    return service.provider_type === 'project' ? 'project' : 'person';
  }

  function getProviderName(service) {
    return service.provider_name || service.instructor_name || '';
  }

  function getProviderSlug(service) {
    return service.provider_slug || normalizeProvider(getProviderName(service));
  }

  function getProviderLabel(service) {
    const providerName = getProviderName(service);
    if (!providerName) return '';
    const labels = {
      person: { ru: 'Мастер', en: 'Provider', cz: 'Poskytovatel', ua: 'Майстер' },
      project: { ru: 'Проект / команда', en: 'Project / team', cz: 'Projekt / tým', ua: 'Проєкт / команда' },
      contact: { ru: 'контакт', en: 'contact', cz: 'kontakt', ua: 'контакт' }
    };
    const type = getProviderType(service);
    const dictionary = labels[type] || labels.person;
    const prefix = dictionary[currentLang] || dictionary.en;
    const contact = service.contact_person && type === 'project'
      ? ` · ${(labels.contact[currentLang] || labels.contact.en)}: ${service.contact_person}`
      : '';
    return `${prefix}: ${providerName}${contact}`;
  }

  function getServiceSortTitle(service) {
    return (t(service.title) || service.slug || '').toLowerCase();
  }

  function sortCards() {
    if (!GRID || !allCards.length) return;
    const providerOrder = { project: 0, person: 1 };
    const sorted = [...allCards].sort((a, b) => {
      const serviceA = a._serviceData || {};
      const serviceB = b._serviceData || {};
      if (state.sort === 'provider') {
        const typeA = providerOrder[getProviderType(serviceA)] ?? 2;
        const typeB = providerOrder[getProviderType(serviceB)] ?? 2;
        if (typeA !== typeB) return typeA - typeB;
        return getProviderName(serviceA).localeCompare(getProviderName(serviceB)) || a._serviceIndex - b._serviceIndex;
      }
      if (state.sort === 'title') return getServiceSortTitle(serviceA).localeCompare(getServiceSortTitle(serviceB));
      return a._serviceIndex - b._serviceIndex;
    });

    sorted.forEach((card, i) => {
      card.style.animationDelay = `${i * 60}ms`;
      GRID.appendChild(card);
    });
  }

  function getServiceTitle(service) {
    return t(service.title) || service.slug || 'Santiago service';
  }

  function formatInputDate(date) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function setBookingStatus(message, type = '') {
    if (!bookingStatus) return;
    bookingStatus.textContent = message || '';
    bookingStatus.dataset.state = type;
  }

  function buildTelegramBookingUrl() {
    if (!activeBookingService || !bookingDate || !bookingTime || !bookingDate.value || !bookingTime.value) {
      return TELEGRAM_BOT_URL;
    }

    const dateCode = bookingDate.value.replace(/-/g, '');
    const timeCode = bookingTime.value.replace(':', '').slice(0, 4);
    const payload = `book_${activeBookingService.slug}_${dateCode}_${timeCode}`;
    return `${TELEGRAM_BOT_URL}?start=${encodeURIComponent(payload)}`;
  }

  function updateTelegramBookingLink() {
    if (!bookingTelegram) return;
    bookingTelegram.href = buildTelegramBookingUrl();
  }

  function updateBookingLoginState() {
    if (!bookingSubmit || !bookingLogin || !bookingTelegram) return;
    const isLoggedIn = !!(currentUser && currentUser.isLoggedIn && currentUser.id);
    bookingSubmit.disabled = !isLoggedIn;
    bookingLogin.hidden = true;
    bookingTelegram.hidden = isLoggedIn;
    updateTelegramBookingLink();
    if (!isLoggedIn) {
      setBookingStatus(serviceBookingLabel('loginRequired'), 'info');
    } else if (bookingStatus && bookingStatus.dataset.state === 'info') {
      setBookingStatus('');
    }
  }

  function updateBookingModalText() {
    if (!bookingPopup) return;
    const serviceTitle = activeBookingService ? getServiceTitle(activeBookingService) : '';
    if (bookingTitle) bookingTitle.textContent = serviceBookingLabel('title');
    if (bookingSummary) {
      bookingSummary.textContent = serviceBookingLabel('summary').replace('{{service}}', serviceTitle);
    }
    const dateLabel = document.getElementById('service-booking-date-label');
    const timeLabel = document.getElementById('service-booking-time-label');
    const noteLabel = document.getElementById('service-booking-note-label');
    if (dateLabel) dateLabel.textContent = serviceBookingLabel('date');
    if (timeLabel) timeLabel.textContent = serviceBookingLabel('time');
    if (noteLabel) noteLabel.textContent = serviceBookingLabel('note');
    if (bookingNote) bookingNote.placeholder = serviceBookingLabel('placeholder');
    if (bookingSubmit) bookingSubmit.textContent = serviceBookingLabel('submit');
    if (bookingLogin) bookingLogin.textContent = serviceBookingLabel('login');
    if (bookingTelegram) bookingTelegram.textContent = serviceBookingLabel('telegram');
    updateTelegramBookingLink();
  }

  function openServiceBooking(service) {
    if (!bookingPopup) return;
    activeBookingService = service;
    updateBookingModalText();

    const today = new Date();
    const minDate = formatInputDate(today);
    if (bookingDate) {
      bookingDate.min = minDate;
      bookingDate.value = bookingDate.value && bookingDate.value >= minDate ? bookingDate.value : minDate;
    }
    if (bookingTime && !bookingTime.value) bookingTime.value = '12:00';
    if (bookingNote) bookingNote.value = '';

    setBookingStatus('');
    updateTelegramBookingLink();
    updateBookingLoginState();
    bookingPopup.hidden = false;
    requestAnimationFrame(() => {
      bookingPopup.classList.add('open');
      bookingPopup.setAttribute('aria-hidden', 'false');
    });
  }

  function closeServiceBooking() {
    if (!bookingPopup) return;
    bookingPopup.classList.remove('open');
    bookingPopup.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
      if (!bookingPopup.classList.contains('open')) bookingPopup.hidden = true;
    }, 180);
  }

  async function submitServiceBooking(event) {
    event.preventDefault();
    if (!activeBookingService) return;

    if (!currentUser || !currentUser.isLoggedIn || !currentUser.id) {
      updateBookingLoginState();
      return;
    }

    if (!window.supabaseClient) {
      setBookingStatus(serviceBookingLabel('missingClient'), 'error');
      return;
    }

    const dateValue = bookingDate ? bookingDate.value : '';
    const timeValue = bookingTime ? bookingTime.value : '';
    const requestedAt = new Date(`${dateValue}T${timeValue || '00:00'}:00`);

    if (!dateValue || !timeValue || Number.isNaN(requestedAt.getTime())) {
      setBookingStatus(serviceBookingLabel('invalidDate'), 'error');
      return;
    }

    if (requestedAt.getTime() <= Date.now()) {
      setBookingStatus(serviceBookingLabel('pastDate'), 'error');
      return;
    }

    const originalText = bookingSubmit ? bookingSubmit.textContent : '';
    let requestSent = false;
    let showTelegramFallback = false;
    if (bookingSubmit) {
      bookingSubmit.disabled = true;
      bookingSubmit.textContent = '...';
    }

    try {
      const { error } = await window.supabaseClient.rpc('request_service_booking', {
        p_user_id: currentUser.id,
        p_service_slug: activeBookingService.slug,
        p_service_title: getServiceTitle(activeBookingService),
        p_requested_at: requestedAt.toISOString(),
        p_note: bookingNote ? bookingNote.value.trim() : ''
      });

      if (error) throw error;

      requestSent = true;
      setBookingStatus(serviceBookingLabel('success'), 'success');
      if (bookingSubmit) bookingSubmit.textContent = originalText || serviceBookingLabel('submit');
    } catch (err) {
      console.warn('[Services] Booking request failed:', err);
      showTelegramFallback = true;
      setBookingStatus(`${serviceBookingLabel('error')} ${serviceBookingLabel('fallback')}`, 'error');
      if (bookingTelegram) {
        updateTelegramBookingLink();
        bookingTelegram.hidden = false;
      }
      if (bookingSubmit) bookingSubmit.textContent = originalText || serviceBookingLabel('submit');
    } finally {
      if (requestSent) {
        if (bookingSubmit) bookingSubmit.disabled = true;
      } else if (showTelegramFallback) {
        if (bookingSubmit) bookingSubmit.disabled = false;
      } else {
        updateBookingLoginState();
      }
    }
  }

  function setupBookingModal() {
    bookingPopup = document.getElementById('service-booking-popup');
    if (!bookingPopup) return;

    bookingForm = document.getElementById('service-booking-form');
    bookingTitle = document.getElementById('service-booking-title');
    bookingSummary = document.getElementById('service-booking-summary');
    bookingDate = document.getElementById('service-booking-date');
    bookingTime = document.getElementById('service-booking-time');
    bookingNote = document.getElementById('service-booking-note');
    bookingSubmit = document.getElementById('service-booking-submit');
    bookingLogin = document.getElementById('service-booking-login');
    bookingTelegram = document.getElementById('service-booking-telegram');
    bookingStatus = document.getElementById('service-booking-status');

    bookingPopup.querySelectorAll('[data-service-booking-close]').forEach((button) => {
      button.addEventListener('click', closeServiceBooking);
    });

    if (bookingForm) bookingForm.addEventListener('submit', submitServiceBooking);
    [bookingDate, bookingTime].forEach((input) => {
      if (input) input.addEventListener('change', updateTelegramBookingLink);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && bookingPopup.classList.contains('open')) closeServiceBooking();
    });
  }

  function createCard(service) {
    const CATEGORY_ICONS = { body: '💆', mind: '🧘', incubator: '🚀', space: '🏛️' };
    const icon = service.icon_emoji || CATEGORY_ICONS[service.category] || '✨';
    const formatLabel = fmt(service.format);
    const detailPage = service.detail_page || '#';

    const card = document.createElement('article');
    card.className = 'preview-card';
    card.tabIndex = 0;
    card.dataset.category = service.category || 'body';
    card.dataset.format = service.format || 'individual';
    card.dataset.providerType = getProviderType(service);
    card.dataset.providerSlug = getProviderSlug(service);
    card.dataset.contactSlug = service.contact_person ? normalizeProvider(service.contact_person) : '';
    card.dataset.url = detailPage;

    const catLabel = t(`filter.${service.category}`) || service.category || '';

    card.innerHTML = `
      <div class="preview-card__icon">${icon}</div>
      <div class="preview-card__body">
        <div class="preview-card__meta">
          <span class="preview-badge">${catLabel}</span>
          <span class="preview-format">${formatLabel}</span>
        </div>
        <h3 class="preview-card__title">${t(service.title) || ''}</h3>
        <span class="preview-price">${getDisplayPrice(service)}</span>
        <p class="preview-desc">${t(service.description) || ''}</p>
        <div class="preview-card__footer">
          <span class="preview-master">${escapeHtml(getProviderLabel(service))}</span>
          <div class="preview-card__actions">
            <button class="preview-favorite" type="button" aria-label="В избранное"></button>
            <button class="preview-card__book" type="button" data-service-book>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>
              <span>${serviceBookingLabel('book')}</span>
            </button>
            <a class="preview-card__cta" href="${detailPage}">
              <span>${t('btn.details')}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
            </a>
          </div>
        </div>
      </div>
    `;

    card.addEventListener('click', (event) => {
      if (event.target.closest('a, button')) return;
      if (detailPage && detailPage !== '#') window.location.href = detailPage;
    });

    card.addEventListener('keydown', (event) => {
      if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('a, button')) {
        event.preventDefault();
        if (detailPage && detailPage !== '#') window.location.href = detailPage;
      }
    });

    const favoriteButton = card.querySelector('.preview-favorite');
    if (favoriteButton && window.MA3Favorites) {
      window.MA3Favorites.registerButton(favoriteButton, () => ({
        type: 'service',
        key: service.slug,
        title: t(service.title) || service.slug,
        subtitle: [getDisplayPrice(service), getProviderLabel(service)].filter(Boolean).join(' · '),
        url: detailPage,
        metadata: {
          slug: service.slug,
          category: service.category,
          format: service.format,
          provider_type: getProviderType(service),
          provider_name: getProviderName(service),
          provider_slug: getProviderSlug(service),
          contact_person: service.contact_person || ''
        }
      }));
    }

    const bookButton = card.querySelector('[data-service-book]');
    if (bookButton) {
      bookButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        openServiceBooking(service);
      });
    }

    return card;
  }

  function renderCards(services) {
    if (!GRID) return;
    GRID.innerHTML = '';
    allCards = [];

    if (!services || services.length === 0) {
      GRID.style.display = 'none';
      if (EMPTY_STATE) EMPTY_STATE.style.display = 'flex';
      return;
    }

    GRID.style.display = 'grid';
    if (EMPTY_STATE) EMPTY_STATE.style.display = 'none';

    services.forEach((service, i) => {
      const card = createCard(service);
      card._serviceData = service;
      card._serviceIndex = i;
      card.style.animationDelay = `${i * 60}ms`;
      GRID.appendChild(card);
      allCards.push(card);
    });

    sortCards();

    requestAnimationFrame(() => {
      allCards.forEach(card => card.classList.add('visible'));
    });
  }

  function applyFilters() {
    let visibleCount = 0;
    allCards.forEach(card => {
      const matchCategory = state.category === 'all' || card.dataset.category === state.category;
      const matchFormat = state.format === 'all' || card.dataset.format === state.format;
      const providerValue = normalizeProvider(state.provider);
      const matchProvider = state.provider === 'all'
        || card.dataset.providerType === providerValue
        || card.dataset.providerSlug === providerValue
        || card.dataset.contactSlug === providerValue;

      if (matchCategory && matchFormat && matchProvider) {
        card.style.display = '';
        setTimeout(() => card.classList.add('visible'), 10);
        visibleCount++;
      } else {
        card.classList.remove('visible');
        card.style.display = 'none';
      }
    });

    GRID.style.display = visibleCount === 0 ? 'none' : 'grid';
    if (EMPTY_STATE) EMPTY_STATE.style.display = visibleCount === 0 ? 'flex' : 'none';
  }

  function refreshCardText() {
    allCards.forEach(card => {
      const service = card._serviceData;
      if (!service) return;
      const titleEl = card.querySelector('.preview-card__title');
      const priceEl = card.querySelector('.preview-price');
      const descEl = card.querySelector('.preview-desc');
      const masterEl = card.querySelector('.preview-master');
      const ctaEl = card.querySelector('.preview-card__cta span');
      const bookEl = card.querySelector('.preview-card__book span');
      const badgeEl = card.querySelector('.preview-badge');
      const formatEl = card.querySelector('.preview-format');

      if (titleEl) titleEl.textContent = t(service.title);
      if (priceEl) priceEl.textContent = getDisplayPrice(service);
      if (descEl) descEl.textContent = t(service.description);
      if (masterEl) masterEl.textContent = getProviderLabel(service);
      if (ctaEl) ctaEl.textContent = t('btn.details');
      if (bookEl) bookEl.textContent = serviceBookingLabel('book');
      if (badgeEl) badgeEl.textContent = t(`filter.${service.category}`) || service.category;
      if (formatEl) formatEl.textContent = fmt(service.format);
    });
    updateBookingModalText();
  }

  async function init() {
    GRID = document.getElementById('services-grid');
    EMPTY_STATE = document.getElementById('services-empty');
    RESET_BTN = document.getElementById('reset-filters');

    // Wait for translations
    let retry = 0;
    while (!window.translations && retry < 20) {
      await new Promise(r => setTimeout(r, 100));
      retry++;
    }

    currentLang = detectLanguage();
    setupBookingModal();

    const staticServices = [
      {
        slug: 'deep-massage',
        title: 'services.massage.name',
        description: 'services.massage.short',
        price: 'services.massage.price',
        icon_emoji: '💆',
        category: 'body',
        format: 'individual',
        instructor_name: 'Ivan Protinak',
        provider_type: 'person',
        provider_name: 'Ivan Protinak',
        provider_slug: 'ivanprotinak',
        detail_page: 'offer.html'
      },
      {
        slug: 'wellness-katerina',
        title: 'services.kat.wellness.name',
        description: 'services.kat.wellness.short',
        price: 'services.kat.wellness.price',
        icon_emoji: '🌿',
        category: 'body',
        format: 'individual',
        instructor_name: 'Katerina',
        provider_type: 'person',
        provider_name: 'Katerina',
        provider_slug: 'katerina',
        detail_page: 'offer-katerina.html'
      },
      {
        slug: 'purpose-brand-discovery',
        title: 'services.andrij.purpose.name',
        description: 'services.andrij.purpose.short',
        price: 'services.andrij.purpose.price',
        icon_emoji: '🧭',
        category: 'mind',
        format: 'individual',
        instructor_name: 'Andrij Pýcha',
        provider_type: 'person',
        provider_name: 'Andrij Pýcha',
        provider_slug: 'andrijpycha',
        detail_page: 'profile-andrij.html'
      },
      {
        slug: 'conscious-networking-facilitation',
        title: 'services.andrij.networking.name',
        description: 'services.andrij.networking.short',
        price: 'services.andrij.networking.price',
        icon_emoji: '🤝',
        category: 'space',
        format: 'group',
        instructor_name: 'Andrij Pýcha',
        provider_type: 'project',
        provider_name: 'Conscious Networking Platform',
        provider_slug: 'andrij-network-platform',
        contact_person: 'Andrij Pýcha',
        detail_page: 'events.html'
      },
      {
        slug: 'interview-recording-production',
        title: 'services.andrij.recording.name',
        description: 'services.andrij.recording.short',
        price: 'services.andrij.recording.price',
        icon_emoji: '🎙️',
        category: 'incubator',
        format: 'individual',
        instructor_name: 'Andrij Pýcha',
        provider_type: 'project',
        provider_name: 'Santiago Talks & Interviews',
        provider_slug: 'santiago-interviews',
        contact_person: 'Andrij Pýcha',
        detail_page: 'openmic.html'
      },
      {
        slug: 'startup-marketing-automation',
        title: 'services.andrij.automation.name',
        description: 'services.andrij.automation.short',
        price: 'services.andrij.automation.price',
        icon_emoji: '🚀',
        category: 'incubator',
        format: 'individual',
        instructor_name: 'Andrij Pýcha',
        provider_type: 'project',
        provider_name: 'Ethical Marketing & Automation Agency',
        provider_slug: 'ethical-automation-agency',
        contact_person: 'Andrij Pýcha',
        detail_page: 'projects.html'
      },
      {
        slug: 'conscious-relationship-discovery',
        title: 'services.andrij.relationship.name',
        description: 'services.andrij.relationship.short',
        price: 'services.andrij.relationship.price',
        icon_emoji: '💞',
        category: 'mind',
        format: 'group',
        instructor_name: 'Andrij Pýcha',
        provider_type: 'project',
        provider_name: 'Conscious Relationships Platform',
        provider_slug: 'conscious-relationships',
        contact_person: 'Andrij Pýcha',
        detail_page: 'events.html'
      },
      {
        slug: 'alternative-knowledge-workshop',
        title: 'services.andrij.knowledge.name',
        description: 'services.andrij.knowledge.short',
        price: 'services.andrij.knowledge.price',
        icon_emoji: '📚',
        category: 'mind',
        format: 'group',
        instructor_name: 'Andrij Pýcha',
        provider_type: 'project',
        provider_name: 'Alternative Knowledge Lab',
        provider_slug: 'alternative-knowledge-lab',
        contact_person: 'Andrij Pýcha',
        detail_page: 'events.html'
      }
    ];

    renderCards(staticServices);
    setupFilters();

    const params = new URLSearchParams(window.location.search);
    const providerParam = params.get('provider') || params.get('instructor');
    if (providerParam) {
      const providerAliases = { andrij: 'andrijpycha', ivan: 'ivanprotinak' };
      const providerValue = providerAliases[providerParam] || providerParam;
      const providerSelect = document.getElementById('provider-filter');
      const hasOption = providerSelect && Array.from(providerSelect.options).some(option => option.value === providerValue);
      if (hasOption) {
        providerSelect.value = providerValue;
        state.provider = providerValue;
        applyFilters();
      }
    }

    const bookingSlug = params.get('book');
    if (bookingSlug) {
      const requestedService = staticServices.find(service => service.slug === bookingSlug);
      if (requestedService) setTimeout(() => openServiceBooking(requestedService), 80);
    }
  }

  function setupFilters() {
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const filterType = tab.dataset.filter;
        const filterValue = tab.dataset.value;

        document.querySelectorAll(`.filter-tab[data-filter="${filterType}"]`).forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        state[filterType] = filterValue;
        applyFilters();
      });
    });

    const providerSelect = document.getElementById('provider-filter');
    if (providerSelect) {
      providerSelect.addEventListener('change', () => {
        state.provider = providerSelect.value;
        applyFilters();
      });
    }

    const sortSelect = document.getElementById('services-sort');
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        state.sort = sortSelect.value;
        sortCards();
        applyFilters();
      });
    }

    if (RESET_BTN) {
      RESET_BTN.addEventListener('click', () => {
        state.category = 'all'; state.format = 'all'; state.provider = 'all'; state.sort = 'default';
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.toggle('active', t.dataset.value === 'all'));
        if (providerSelect) providerSelect.value = 'all';
        if (sortSelect) sortSelect.value = 'default';
        sortCards();
        applyFilters();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('ma3-lang-change', (e) => {
    currentLang = e.detail?.lang || DEFAULT_LANG;
    refreshCardText();
    sortCards();
    applyFilters();
  });

  document.addEventListener('ma3-auth-changed', (e) => {
    currentUser = e.detail || currentUser;
    refreshCardText();
    updateBookingLoginState();
  });

  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('lang-btn')) {
      currentLang = e.target.getAttribute('data-lang');
      refreshCardText();
      sortCards();
      applyFilters();
    }
  });

})();
