/* ═══════════════════════════════════════════════════════════
   SERVICES — Dynamic Filter Engine (Fully Restored & Fixed)
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  let GRID, EMPTY_STATE, RESET_BTN;
  const state = { category: 'all', format: 'all', instructor: 'all' };
  let allCards = [];
  let currentUser = window.MA3Auth ? window.MA3Auth.user : { role: 'guest', isLoggedIn: false };

  const STORAGE_KEY = 'language';
  const DEFAULT_LANG = 'ru';
  const SUPPORTED = ['en', 'cz', 'ru', 'ua'];

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

  function createCard(service) {
    const CATEGORY_ICONS = { body: '💆', mind: '🧘', incubator: '🚀', space: '🏛️' };
    const icon = service.icon_emoji || CATEGORY_ICONS[service.category] || '✨';
    const formatLabel = fmt(service.format);

    const a = document.createElement('a');
    a.href = service.detail_page || '#';
    a.className = 'preview-card';
    a.dataset.category = service.category || 'body';
    a.dataset.format = service.format || 'individual';
    a.dataset.instructor = service.instructor_name ? service.instructor_name.toLowerCase().replace(/\s+/g, '') : '';

    const catLabel = t(`filter.${service.category}`) || service.category || '';

    a.innerHTML = `
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
          <span class="preview-master">${t(service.instructor_name) || ''}</span>
          <span class="preview-card__cta">
            <span>${t('btn.details')}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
          </span>
        </div>
      </div>
    `;
    return a;
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
      card.style.animationDelay = `${i * 60}ms`;
      GRID.appendChild(card);
      allCards.push(card);
    });

    requestAnimationFrame(() => {
      allCards.forEach(card => card.classList.add('visible'));
    });
  }

  function applyFilters() {
    let visibleCount = 0;
    allCards.forEach(card => {
      const matchCategory = state.category === 'all' || card.dataset.category === state.category;
      const matchFormat = state.format === 'all' || card.dataset.format === state.format;
      const matchInstructor = state.instructor === 'all' || card.dataset.instructor.includes(state.instructor.toLowerCase().replace(/\s+/g, ''));

      if (matchCategory && matchFormat && matchInstructor) {
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
      const badgeEl = card.querySelector('.preview-badge');
      const formatEl = card.querySelector('.preview-format');

      if (titleEl) titleEl.textContent = t(service.title);
      if (priceEl) priceEl.textContent = getDisplayPrice(service);
      if (descEl) descEl.textContent = t(service.description);
      if (masterEl) masterEl.textContent = t(service.instructor_name);
      if (ctaEl) ctaEl.textContent = t('btn.details');
      if (badgeEl) badgeEl.textContent = t(`filter.${service.category}`) || service.category;
      if (formatEl) formatEl.textContent = fmt(service.format);
    });
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
        detail_page: 'offer-katerina.html'
      }
    ];

    renderCards(staticServices);
    setupFilters();
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

    const instSelect = document.getElementById('instructor-filter');
    if (instSelect) {
      instSelect.addEventListener('change', () => {
        state.instructor = instSelect.value;
        applyFilters();
      });
    }

    if (RESET_BTN) {
      RESET_BTN.addEventListener('click', () => {
        state.category = 'all'; state.format = 'all'; state.instructor = 'all';
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.toggle('active', t.dataset.value === 'all'));
        if (instSelect) instSelect.value = 'all';
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
  });

  document.addEventListener('ma3-auth-changed', (e) => {
    currentUser = e.detail || currentUser;
    refreshCardText();
  });

  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('lang-btn')) {
      currentLang = e.target.getAttribute('data-lang');
      refreshCardText();
    }
  });

})();
