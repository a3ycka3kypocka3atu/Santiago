(function () {
  'use strict';

  const STORAGE_KEY = 'language';
  const DEFAULT_LANG = 'ru';
  const SUPPORTED = ['en', 'cz', 'ru', 'ua'];
  const state = { type: 'all', format: 'all', city: 'all', sort: 'priority' };
  let currentLang = detectLanguage();

  const labels = {
    ru: {
      type: { studio: 'Студия', venue: 'Заведение', living: 'Коливинг', digital: 'Цифровое' },
      format: { practice: 'Практики', events: 'События', rent: 'Аренда', residential: 'Жизнь', online: 'Онлайн' },
      status: { active: 'Активно', building: 'В сборке', concept: 'Концепт' },
      cityPrefix: 'Город',
      details: 'Подробнее'
    },
    en: {
      type: { studio: 'Studio', venue: 'Venue', living: 'Coliving', digital: 'Digital' },
      format: { practice: 'Practices', events: 'Events', rent: 'Rental', residential: 'Living', online: 'Online' },
      status: { active: 'Active', building: 'Building', concept: 'Concept' },
      cityPrefix: 'City',
      details: 'Learn More'
    },
    cz: {
      type: { studio: 'Studio', venue: 'Podnik', living: 'Coliving', digital: 'Digitální' },
      format: { practice: 'Praxe', events: 'Události', rent: 'Pronájem', residential: 'Bydlení', online: 'Online' },
      status: { active: 'Aktivní', building: 'Ve vývoji', concept: 'Koncept' },
      cityPrefix: 'Město',
      details: 'Více informací'
    },
    ua: {
      type: { studio: 'Студія', venue: 'Заклад', living: 'Колівінг', digital: 'Цифрове' },
      format: { practice: 'Практики', events: 'Події', rent: 'Оренда', residential: 'Життя', online: 'Онлайн' },
      status: { active: 'Активно', building: 'У збірці', concept: 'Концепт' },
      cityPrefix: 'Місто',
      details: 'Детальніше'
    }
  };

  const spaces = [
    {
      slug: 'santiago-studio-praha',
      icon: '🏛️',
      type: 'studio',
      status: 'active',
      formats: ['practice', 'events', 'rent'],
      city: 'Praha',
      cityKey: 'praha',
      priority: 1,
      url: 'calendar.html#full-calendar',
      title: {
        ru: 'Студия Santiago',
        en: 'Santiago Studio',
        cz: 'Studio Santiago',
        ua: 'Студія Santiago'
      },
      desc: {
        ru: 'Основной зал в Праге для телесных практик, женских кругов, встреч клуба, Open Mic, съёмок и аренды под авторские форматы.',
        en: 'The main hall in Prague for body practices, women’s circles, club meetups, Open Mic, filming, and rental for original formats.',
        cz: 'Hlavní sál v Praze pro pohybové praxe, ženské kruhy, setkání klubu, Open Mic, natáčení a pronájem pro autorské formáty.',
        ua: 'Основна зала у Празі для тілесних практик, жіночих кіл, зустрічей клубу, Open Mic, зйомок і оренди під авторські формати.'
      }
    },
    {
      slug: 'partner-venues',
      icon: '☕',
      type: 'venue',
      status: 'building',
      formats: ['events', 'practice'],
      city: 'Praha',
      cityKey: 'praha',
      priority: 2,
      url: 'community.html#community-roles',
      title: {
        ru: 'Партнёрские заведения',
        en: 'Partner Venues',
        cz: 'Partnerské podniky',
        ua: 'Партнерські заклади'
      },
      desc: {
        ru: 'Будущая витрина кафе, клубов, залов и атмосферных мест, где можно проводить встречи, презентации, практики и камерные события Santiago.',
        en: 'A future showcase of cafes, clubs, halls, and atmospheric places for Santiago meetups, presentations, practices, and intimate events.',
        cz: 'Budoucí přehled kaváren, klubů, sálů a atmosférických míst pro setkání, prezentace, praxe a komorní akce Santiago.',
        ua: 'Майбутня вітрина кафе, клубів, залів і атмосферних місць для зустрічей, презентацій, практик і камерних подій Santiago.'
      }
    },
    {
      slug: 'santiago-coliving-space',
      icon: '🏡',
      type: 'living',
      status: 'concept',
      formats: ['residential', 'events'],
      city: 'Praha',
      cityKey: 'praha',
      priority: 3,
      url: 'coliving.html',
      title: {
        ru: 'Коливинг Santiago',
        en: 'Santiago Coliving',
        cz: 'Santiago Coliving',
        ua: 'Колівінг Santiago'
      },
      desc: {
        ru: 'Концепт совместного проживания для своих: спокойная база, общие ресурсы, поддержка, бытовая экология и среда для запуска проектов.',
        en: 'A shared-living concept for the circle: a calm base, shared resources, support, household ecology, and a place to launch projects.',
        cz: 'Koncept společného bydlení pro náš okruh: klidná základna, sdílené zdroje, podpora, domácí ekologie a prostředí pro projekty.',
        ua: 'Концепт спільного проживання для своїх: спокійна база, спільні ресурси, підтримка, побутова екологія і середовище для запуску проєктів.'
      }
    },
    {
      slug: 'digital-community-space',
      icon: '💠',
      type: 'digital',
      status: 'building',
      formats: ['online', 'events'],
      city: 'Online',
      cityKey: 'online',
      priority: 4,
      url: 'cabinet.html',
      title: {
        ru: 'Цифровое пространство клуба',
        en: 'Digital Club Space',
        cz: 'Digitální prostor klubu',
        ua: 'Цифровий простір клубу'
      },
      desc: {
        ru: 'Кабинеты, заявки, профили, проекты и будущая карта связей, чтобы пространства, люди и инициативы жили в одной инфраструктуре.',
        en: 'Cabinets, submissions, profiles, projects, and a future connection map so spaces, people, and initiatives live in one infrastructure.',
        cz: 'Kabinety, přihlášky, profily, projekty a budoucí mapa propojení, aby prostory, lidé a iniciativy žili v jedné infrastruktuře.',
        ua: 'Кабінети, заявки, профілі, проєкти й майбутня карта зв’язків, щоб простори, люди та ініціативи жили в одній інфраструктурі.'
      }
    }
  ];

  function detectLanguage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED.includes(stored)) return stored;
    } catch (e) {}
    return DEFAULT_LANG;
  }

  function localize(value) {
    if (!value) return '';
    return value[currentLang] || value[DEFAULT_LANG] || Object.values(value)[0] || '';
  }

  function t(path) {
    const dictionary = labels[currentLang] || labels[DEFAULT_LANG];
    return path.split('.').reduce((acc, part) => acc && acc[part], dictionary) || path;
  }

  function filteredSpaces() {
    const result = spaces.filter(space => {
      const type = state.type === 'all' || space.type === state.type;
      const format = state.format === 'all' || space.formats.includes(state.format);
      const city = state.city === 'all' || space.cityKey === state.city;
      return type && format && city;
    });

    return result.sort((a, b) => {
      if (state.sort === 'title') return localize(a.title).localeCompare(localize(b.title));
      if (state.sort === 'status') return a.status.localeCompare(b.status) || a.priority - b.priority;
      return a.priority - b.priority;
    });
  }

  function createCard(space) {
    const card = document.createElement('article');
    card.className = 'preview-card';
    card.tabIndex = 0;
    card.dataset.url = space.url;

    const primaryFormat = space.formats[0] || 'events';

    card.innerHTML = `
      <div class="preview-card__icon">${space.icon}</div>
      <div class="preview-card__body">
        <div class="preview-card__meta">
          <span class="preview-badge">${t(`type.${space.type}`)}</span>
          <span class="preview-format">${t(`status.${space.status}`)}</span>
        </div>
        <h3 class="preview-card__title">${localize(space.title)}</h3>
        <span class="preview-price">${t(`format.${primaryFormat}`)}</span>
        <p class="preview-desc">${localize(space.desc)}</p>
        <div class="preview-card__footer">
          <span class="preview-master">${t('cityPrefix')}: ${space.city}</span>
          <a class="preview-card__cta" href="${space.url}">
            <span>${t('details')}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
          </a>
        </div>
      </div>
    `;

    card.addEventListener('click', event => {
      if (event.target.closest('a, button')) return;
      window.location.href = space.url;
    });

    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        window.location.href = space.url;
      }
    });

    return card;
  }

  function render() {
    const grid = document.getElementById('spaces-grid');
    const empty = document.getElementById('spaces-empty');
    if (!grid) return;

    const visible = filteredSpaces();
    grid.innerHTML = '';

    if (!visible.length) {
      grid.style.display = 'none';
      if (empty) empty.style.display = 'flex';
      return;
    }

    grid.style.display = 'grid';
    if (empty) empty.style.display = 'none';
    visible.forEach(space => grid.appendChild(createCard(space)));
  }

  function setTabState(tab) {
    const filterType = tab.dataset.filter;
    document.querySelectorAll(`#spaces-filters .filter-tab[data-filter="${filterType}"]`).forEach(item => {
      const active = item === tab;
      item.classList.toggle('active', active);
      item.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  function resetFilters() {
    state.type = 'all';
    state.format = 'all';
    state.city = 'all';
    state.sort = 'priority';
    document.querySelectorAll('#spaces-filters .filter-tab').forEach(tab => {
      const active = tab.dataset.value === 'all';
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    const city = document.getElementById('spaces-city-filter');
    const sort = document.getElementById('spaces-sort');
    if (city) city.value = 'all';
    if (sort) sort.value = 'priority';
    render();
  }

  function init() {
    document.querySelectorAll('#spaces-filters .filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        state[tab.dataset.filter] = tab.dataset.value;
        setTabState(tab);
        render();
      });
    });

    const city = document.getElementById('spaces-city-filter');
    if (city) {
      city.addEventListener('change', () => {
        state.city = city.value;
        render();
      });
    }

    const sort = document.getElementById('spaces-sort');
    if (sort) {
      sort.addEventListener('change', () => {
        state.sort = sort.value;
        render();
      });
    }

    const reset = document.getElementById('spaces-reset-filters');
    if (reset) reset.addEventListener('click', resetFilters);

    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('ma3-lang-change', event => {
    currentLang = event.detail?.lang || detectLanguage();
    render();
  });

  document.addEventListener('click', event => {
    if (event.target.classList.contains('lang-btn')) {
      currentLang = event.target.getAttribute('data-lang') || detectLanguage();
      render();
    }
  });
})();
