/* ═══════════════════════════════════════════════════════════
   SERVICES — Dynamic Filter Engine
   Multi-filter: category · format · instructor
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const GRID = document.getElementById('services-grid');
  const EMPTY_STATE = document.getElementById('services-empty');
  const RESET_BTN = document.getElementById('reset-filters');

  // Active filters state
  const state = {
    category: 'all',
    format: 'all',
    instructor: 'all'
  };

  // All service cards rendered from Supabase
  let allCards = [];

  // ── i18n ──────────────────────────────────────────────────
  const STORAGE_KEY = 'language';
  const DEFAULT_LANG = 'ru';
  const SUPPORTED = ['en', 'cz', 'ru', 'ua'];

  function detectLanguage() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;
    const nav = (navigator.language || '').toLowerCase();
    if (nav.startsWith('cs') || nav.startsWith('cz')) return 'cz';
    if (nav.startsWith('ru')) return 'ru';
    if (nav.startsWith('uk')) return 'ua';
    return DEFAULT_LANG;
  }

  let currentLang = detectLanguage();

  function t(key) {
    const lang = currentLang || detectLanguage();
    if (window.translations && window.translations[lang] && window.translations[lang][key]) {
      return window.translations[lang][key];
    }
    // Fallback to English
    if (window.translations && window.translations['en'] && window.translations['en'][key]) {
      return window.translations['en'][key];
    }
    return key;
  }

  // ── Supabase Client ──────────────────────────────────────
  function getClient() {
    if (window.supabaseClient) return window.supabaseClient;
    const sb = window.supabase;
    if (!sb) return null;
    window.supabaseClient = sb.createClient(
      'https://placeholder.supabase.co',
      'placeholder-anon-key'
    );
    return window.supabaseClient;
  }

  // ── Card Rendering ────────────────────────────────────────
  const CATEGORY_ICONS = {
    body: '💆',
    mind: '🧘',
    incubator: '🚀',
    space: '🏛️'
  };

  const FORMAT_LABELS = {
    individual: { ru: 'Индивидуально', en: 'Individual', cz: 'Individuálně', ua: 'Індивідуально' },
    group: { ru: 'Групповое', en: 'Group', cz: 'Skupinové', ua: 'Групове' }
  };

  function fmt(key) {
    return FORMAT_LABELS[key] ? (FORMAT_LABELS[key][currentLang] || FORMAT_LABELS[key]['en']) : key;
  }

  function createCard(service) {
    const icon = service.icon_emoji || CATEGORY_ICONS[service.category] || '✨';
    const formatLabel = fmt(service.format) || '';

    const a = document.createElement('a');
    a.href = service.detail_page || '#';
    a.className = 'preview-card';
    a.dataset.category = service.category || 'body';
    a.dataset.format = service.format || 'individual';
    a.dataset.instructor = service.instructor_name
      ? service.instructor_name.toLowerCase().replace(/\s+/g, '')
      : '';

    // Category badge
    const catKey = `filter.${service.category}`;
    const catLabel = t(catKey) || service.category || '';

    a.innerHTML = `
      <div class="preview-card__icon">${icon}</div>
      <div class="preview-card__body">
        <div class="preview-card__meta">
          <span class="preview-badge">${catLabel}</span>
          <span class="preview-format">${formatLabel}</span>
        </div>
        <h3 class="preview-card__title">${service.title || ''}</h3>
        <span class="preview-price">${service.price || ''}</span>
        <p class="preview-desc">${service.description || ''}</p>
        <div class="preview-card__footer">
          <span class="preview-master">${service.instructor_name || ''}</span>
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
    GRID.innerHTML = '';
    allCards = [];

    if (!services || services.length === 0) {
      GRID.style.display = 'none';
      EMPTY_STATE.hidden = false;
      return;
    }

    GRID.style.display = '';
    EMPTY_STATE.hidden = true;

    services.forEach((service, i) => {
      const card = createCard(service);
      card.style.animationDelay = `${i * 60}ms`;
      GRID.appendChild(card);
      allCards.push(card);
    });

    // Trigger staggered entrance
    requestAnimationFrame(() => {
      allCards.forEach(card => card.classList.add('visible'));
    });
  }

  // ── Filtering ────────────────────────────────────────────
  function applyFilters() {
    let visibleCount = 0;

    allCards.forEach(card => {
      const matchCategory = state.category === 'all' || card.dataset.category === state.category;
      const matchFormat = state.format === 'all' || card.dataset.format === state.format;
      const matchInstructor =
        state.instructor === 'all' ||
        card.dataset.instructor.toLowerCase().includes(state.instructor.toLowerCase());

      if (matchCategory && matchFormat && matchInstructor) {
        card.classList.remove('is-hidden');
        card.style.opacity = '1';
        visibleCount++;
      } else {
        card.classList.add('is-hidden');
        card.style.opacity = '0';
      }
    });

    GRID.style.display = visibleCount === 0 ? 'none' : '';
    EMPTY_STATE.hidden = visibleCount > 0;
  }

  // ── Tab Click Handler ────────────────────────────────────
  document.querySelectorAll('.services-filters .filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const filterType = tab.dataset.filter;
      const filterValue = tab.dataset.value;

      // Update active state within this filter group
      document.querySelectorAll(`.services-filters .filter-tab[data-filter="${filterType}"]`).forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      state[filterType] = filterValue;
      applyFilters();
    });
  });

  // ── Instructor Select Handler ─────────────────────────────
  const instructorSelect = document.getElementById('instructor-filter');
  if (instructorSelect) {
    instructorSelect.addEventListener('change', () => {
      state.instructor = instructorSelect.value;
      applyFilters();
    });
  }

  // ── Reset Filters ────────────────────────────────────────
  if (RESET_BTN) {
    RESET_BTN.addEventListener('click', () => {
      // Reset state
      state.category = 'all';
      state.format = 'all';
      state.instructor = 'all';

      // Reset tab UI
      document.querySelectorAll('.services-filters .filter-tab[data-value="all"]').forEach(tab => {
        document.querySelectorAll(`.services-filters .filter-tab[data-filter="${tab.dataset.filter}"]`).forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
      });

      // Reset select
      if (instructorSelect) instructorSelect.value = 'all';

      // Show all cards
      allCards.forEach(card => {
        card.classList.remove('is-hidden');
        card.style.opacity = '1';
      });

      GRID.style.display = '';
      EMPTY_STATE.hidden = true;
    });
  }

  // ── Init: Fetch Services from Supabase ───────────────────
  async function init() {
    const sb = getClient();
    if (!sb) {
      console.warn('[services] Supabase client not ready, showing static fallback');
      showStaticCards();
      return;
    }

    try {
      const { data, error } = await sb
        .from('services')
        .select('slug, title, description, price, icon_emoji, category, format, instructor_name, detail_page')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        showStaticCards();
        return;
      }

      renderCards(data);
      applyFilters();
    } catch (err) {
      console.warn('[services] Supabase fetch failed, showing static fallback:', err.message);
      showStaticCards();
    }
  }

  // ── Static Fallback Cards (when no Supabase data) ────────
  function showStaticCards() {
    const staticServices = [
      {
        slug: 'deep-massage',
        title: t('services.massage.name') || 'Deep Recovery Massage & Tea Ceremony',
        description: t('services.massage.short') || 'Therapeutic massage with body diagnostics, male and female programs. Includes 30–60 min tea ceremony.',
        price: t('services.massage.price') || '1200 CZK',
        icon_emoji: '💆',
        category: 'body',
        format: 'individual',
        instructor_name: 'Ivan Protinak',
        detail_page: 'offer.html'
      },
      {
        slug: 'wellness-katerina',
        title: t('services.kat.wellness.name') || 'Wellness Programs & SPA Retreats',
        description: t('services.kat.wellness.short') || 'Body practices, aromatherapy, lymphatic drainage training, intimate SPA retreats with aroma rituals.',
        price: t('services.kat.wellness.price') || 'Individual',
        icon_emoji: '🌿',
        category: 'body',
        format: 'individual',
        instructor_name: 'Katerina',
        detail_page: 'offer-katerina.html'
      }
    ];
    renderCards(staticServices);
    applyFilters();
  }

  // ── CSS animation for card entrance ─────────────────────
  const style = document.createElement('style');
  style.textContent = `
    .preview-card {
      opacity: 0;
      transform: translateY(16px);
      transition: opacity 0.35s ease, transform 0.35s ease;
    }
    .preview-card.visible {
      opacity: 1 !important;
      transform: translateY(0) !important;
    }
    .preview-card.is-hidden {
      opacity: 0 !important;
      transform: translateY(8px);
      transition: opacity 0.25s ease, transform 0.25s ease;
    }
  `;
  document.head.appendChild(style);

  // Start when DOM + translations ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Listen for language changes
  document.addEventListener('ma3-lang-change', (e) => {
    currentLang = e.detail?.lang || DEFAULT_LANG;
    // Re-render cards with fresh translations
    const hidden = Array.from(document.querySelectorAll('.preview-card.is-hidden'));
    const visible = Array.from(document.querySelectorAll('.preview-card:not(.is-hidden)'));
    // Simple: just reinit to get fresh labels
    if (visible.length === 0 && allCards.length > 0) {
      EMPTY_STATE.querySelector('.services-empty__text').textContent = t('services.empty.text');
    }
  });

})();