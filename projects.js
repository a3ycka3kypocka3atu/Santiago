(function () {
  'use strict';

  const STORAGE_KEY = 'language';
  const DEFAULT_LANG = 'ru';
  const SUPPORTED = ['en', 'cz', 'ru', 'ua'];
  const state = { category: 'all', status: 'all', sort: 'priority' };
  let currentLang = detectLanguage();

  const labels = {
    ru: {
      category: { space: 'Пространство', community: 'Комьюнити', incubator: 'Инкубатор', media: 'Медиа', living: 'Коливинг', digital: 'Digital' },
      status: { active: 'Активный', building: 'В сборке', concept: 'Концепт' },
      format: { offline: 'Офлайн', online: 'Онлайн', hybrid: 'Гибрид', residential: 'Совместный быт' },
      ownerPrefix: 'Куратор',
      details: 'Подробнее'
    },
    en: {
      category: { space: 'Space', community: 'Community', incubator: 'Incubator', media: 'Media', living: 'Coliving', digital: 'Digital' },
      status: { active: 'Active', building: 'Building', concept: 'Concept' },
      format: { offline: 'Offline', online: 'Online', hybrid: 'Hybrid', residential: 'Shared Living' },
      ownerPrefix: 'Curator',
      details: 'Learn More'
    },
    cz: {
      category: { space: 'Prostor', community: 'Komunita', incubator: 'Inkubátor', media: 'Média', living: 'Coliving', digital: 'Digital' },
      status: { active: 'Aktivní', building: 'Ve vývoji', concept: 'Koncept' },
      format: { offline: 'Offline', online: 'Online', hybrid: 'Hybrid', residential: 'Společné bydlení' },
      ownerPrefix: 'Kurátor',
      details: 'Více informací'
    },
    ua: {
      category: { space: 'Простір', community: 'Спільнота', incubator: 'Інкубатор', media: 'Медіа', living: 'Колівінг', digital: 'Digital' },
      status: { active: 'Активний', building: 'У збірці', concept: 'Концепт' },
      format: { offline: 'Офлайн', online: 'Онлайн', hybrid: 'Гібрид', residential: 'Спільний побут' },
      ownerPrefix: 'Куратор',
      details: 'Детальніше'
    }
  };

  const projects = [
    {
      slug: 'santiago-space',
      icon: '🏛️',
      category: 'space',
      status: 'active',
      format: 'offline',
      priority: 1,
      url: 'community.html',
      owner: 'Santiago Way',
      title: {
        ru: 'Пространство Santiago',
        en: 'Santiago Space',
        cz: 'Prostor Santiago',
        ua: 'Простір Santiago'
      },
      desc: {
        ru: 'Физический хаб в Праге: зал для практик, встреч, тестирования авторских форматов и будущего расширения по Чехии.',
        en: 'A physical hub in Prague for practices, meetups, testing author formats, and future expansion across Czechia.',
        cz: 'Fyzický hub v Praze pro praxe, setkání, testování autorských formátů a budoucí rozšíření po Česku.',
        ua: 'Фізичний хаб у Празі для практик, зустрічей, тестування авторських форматів і майбутнього розширення Чехією.'
      }
    },
    {
      slug: 'santiago-club',
      icon: '🤝',
      category: 'community',
      status: 'active',
      format: 'hybrid',
      priority: 2,
      url: 'community.html',
      owner: 'Santiago Club',
      title: {
        ru: 'Клуб Santiago',
        en: 'Santiago Club',
        cz: 'Klub Santiago',
        ua: 'Клуб Santiago'
      },
      desc: {
        ru: 'Сообщество резидентов, мастеров и партнёров для взаимопомощи, нетворкинга, бартеров навыками и запуска совместных инициатив.',
        en: 'A community of residents, masters, and partners for support, networking, skill exchange, and shared initiatives.',
        cz: 'Komunita rezidentů, mistrů a partnerů pro podporu, networking, výměnu dovedností a společné iniciativy.',
        ua: 'Спільнота резидентів, майстрів і партнерів для взаємодопомоги, нетворкінгу, обміну навичками та спільних ініціатив.'
      }
    },
    {
      slug: 'project-incubator',
      icon: '🚀',
      category: 'incubator',
      status: 'building',
      format: 'hybrid',
      priority: 3,
      url: 'openmic.html',
      owner: 'Santiago Incubator',
      title: {
        ru: 'Инкубатор проектов',
        en: 'Project Incubator',
        cz: 'Inkubátor projektů',
        ua: 'Інкубатор проєктів'
      },
      desc: {
        ru: 'Среда, где идеи проходят путь от открытого питча до команды, первых тестов, партнёрств и понятной модели реализации.',
        en: 'A place where ideas move from open pitch to team, first tests, partnerships, and a clear implementation model.',
        cz: 'Prostředí, kde nápady přecházejí od otevřeného pitche k týmu, testům, partnerstvím a modelu realizace.',
        ua: 'Середовище, де ідеї проходять шлях від відкритого пітчу до команди, перших тестів, партнерств і моделі реалізації.'
      }
    },
    {
      slug: 'open-mic-talks',
      icon: '🎙️',
      category: 'media',
      status: 'active',
      format: 'offline',
      priority: 4,
      url: 'openmic.html',
      owner: 'Open Mic',
      title: {
        ru: 'Open Mic & Santiago Talks',
        en: 'Open Mic & Santiago Talks',
        cz: 'Open Mic & Santiago Talks',
        ua: 'Open Mic & Santiago Talks'
      },
      desc: {
        ru: 'Открытая сцена для лекций, презентаций проектов, нетворкинг-питчингов, перформансов и медийного контента.',
        en: 'An open stage for talks, project presentations, networking pitches, performances, and media content.',
        cz: 'Otevřená scéna pro přednášky, prezentace projektů, networkingové pitche, performance a mediální obsah.',
        ua: 'Відкрита сцена для лекцій, презентацій проєктів, нетворкінг-пітчів, перформансів і медійного контенту.'
      }
    },
    {
      slug: 'coliving',
      icon: '🏡',
      category: 'living',
      status: 'concept',
      format: 'residential',
      priority: 5,
      url: 'community.html',
      owner: 'Santiago Club',
      title: {
        ru: 'Коливинг Santiago',
        en: 'Santiago Coliving',
        cz: 'Santiago Coliving',
        ua: 'Колівінг Santiago'
      },
      desc: {
        ru: 'Будущий формат совместного проживания для своих: дешевле быт, ближе команда, быстрее запуск общих проектов.',
        en: 'A future shared-living format for the circle: easier living, closer teams, and faster launch of shared projects.',
        cz: 'Budoucí formát společného bydlení: jednodušší život, bližší tým a rychlejší start společných projektů.',
        ua: 'Майбутній формат спільного проживання для своїх: простіший побут, ближча команда, швидший запуск спільних проєктів.'
      }
    },
    {
      slug: 'digital-community',
      icon: '💻',
      category: 'digital',
      status: 'building',
      format: 'online',
      priority: 6,
      url: 'cabinet.html',
      owner: 'Santiago Platform',
      title: {
        ru: 'Digital Community Platform',
        en: 'Digital Community Platform',
        cz: 'Digital Community Platform',
        ua: 'Digital Community Platform'
      },
      desc: {
        ru: 'Профили, кабинет, избранное, заявки, события и Telegram-связка — цифровой слой для прозрачного взаимодействия клуба.',
        en: 'Profiles, cabinet, favorites, requests, events, and Telegram flow: the digital layer for transparent club interaction.',
        cz: 'Profily, kabinet, oblíbené položky, žádosti, události a Telegram: digitální vrstva pro transparentní interakci klubu.',
        ua: 'Профілі, кабінет, обране, заявки, події та Telegram-зв’язка: цифровий шар для прозорої взаємодії клубу.'
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

  function t(key) {
    const dictionary = labels[currentLang] || labels[DEFAULT_LANG];
    return key.split('.').reduce((acc, part) => acc && acc[part], dictionary) || key;
  }

  function filteredProjects() {
    const result = projects.filter(project => {
      const category = state.category === 'all' || project.category === state.category;
      const status = state.status === 'all' || project.status === state.status;
      return category && status;
    });

    return result.sort((a, b) => {
      if (state.sort === 'title') return localize(a.title).localeCompare(localize(b.title));
      if (state.sort === 'status') return a.status.localeCompare(b.status) || a.priority - b.priority;
      return a.priority - b.priority;
    });
  }

  function createCard(project) {
    const card = document.createElement('article');
    card.className = 'preview-card';
    card.tabIndex = 0;
    card.dataset.url = project.url;

    card.innerHTML = `
      <div class="preview-card__icon">${project.icon}</div>
      <div class="preview-card__body">
        <div class="preview-card__meta">
          <span class="preview-badge">${t(`category.${project.category}`)}</span>
          <span class="preview-format">${t(`status.${project.status}`)}</span>
        </div>
        <h3 class="preview-card__title">${localize(project.title)}</h3>
        <span class="preview-price">${t(`format.${project.format}`)}</span>
        <p class="preview-desc">${localize(project.desc)}</p>
        <div class="preview-card__footer">
          <span class="preview-master">${t('ownerPrefix')}: ${project.owner}</span>
          <a class="preview-card__cta" href="${project.url}">
            <span>${t('details')}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
          </a>
        </div>
      </div>
    `;

    card.addEventListener('click', event => {
      if (event.target.closest('a, button')) return;
      window.location.href = project.url;
    });

    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        window.location.href = project.url;
      }
    });

    return card;
  }

  function render() {
    const grid = document.getElementById('projects-grid');
    const empty = document.getElementById('projects-empty');
    if (!grid) return;

    const visible = filteredProjects();
    grid.innerHTML = '';

    if (!visible.length) {
      grid.style.display = 'none';
      if (empty) empty.style.display = 'flex';
      return;
    }

    grid.style.display = 'grid';
    if (empty) empty.style.display = 'none';
    visible.forEach(project => grid.appendChild(createCard(project)));
  }

  function setTabState(tab) {
    const filterType = tab.dataset.filter;
    document.querySelectorAll(`#projects-filters .filter-tab[data-filter="${filterType}"]`).forEach(item => {
      const active = item === tab;
      item.classList.toggle('active', active);
      item.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  function resetFilters() {
    state.category = 'all';
    state.status = 'all';
    state.sort = 'priority';
    document.querySelectorAll('#projects-filters .filter-tab').forEach(tab => {
      const active = tab.dataset.value === 'all';
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    const sort = document.getElementById('projects-sort');
    if (sort) sort.value = 'priority';
    render();
  }

  function init() {
    document.querySelectorAll('#projects-filters .filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        state[tab.dataset.filter] = tab.dataset.value;
        setTabState(tab);
        render();
      });
    });

    const sort = document.getElementById('projects-sort');
    if (sort) {
      sort.addEventListener('change', () => {
        state.sort = sort.value;
        render();
      });
    }

    const reset = document.getElementById('projects-reset-filters');
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
