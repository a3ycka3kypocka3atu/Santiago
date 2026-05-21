(function () {
  'use strict';

  const STORAGE_KEY = 'language';
  const DEFAULT_LANG = 'ru';
  const SUPPORTED = ['en', 'cz', 'ru', 'ua'];
  const state = { category: 'all', status: 'all', owner: 'all', sort: 'priority' };
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
      url: 'project-incubator.html',
      owner: 'Santiago Incubator',
      title: {
        ru: 'Инкубатор проектов',
        en: 'Project Incubator',
        cz: 'Inkubátor projektů',
        ua: 'Інкубатор проєктів'
      },
      desc: {
        ru: 'Встречи, команды, партнёрства и фонд для запуска этичных, природных и полезных проектов.',
        en: 'Meetups, teams, partnerships, and a fund for launching ethical, natural, and useful projects.',
        cz: 'Setkání, týmy, partnerství a fond pro spuštění etických, přirozených a užitečných projektů.',
        ua: 'Зустрічі, команди, партнерства й фонд для запуску етичних, природних і корисних проєктів.'
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
      url: 'coliving.html',
      owner: 'Santiago Club',
      title: {
        ru: 'Коливинг Santiago',
        en: 'Santiago Coliving',
        cz: 'Santiago Coliving',
        ua: 'Колівінг Santiago'
      },
      desc: {
        ru: 'Концепт совместного проживания для своих: хорошие условия, поддержка, общие ресурсы и среда для запуска проектов.',
        en: 'A shared-living concept for the circle: good conditions, support, shared resources, and an environment for launching projects.',
        cz: 'Koncept společného bydlení pro náš okruh: dobré podmínky, podpora, sdílené zdroje a prostředí pro rozjezd projektů.',
        ua: 'Концепт спільного проживання для своїх: хороші умови, підтримка, спільні ресурси й середовище для запуску проєктів.'
      }
    },
    {
      slug: 'andrij-network-platform',
      icon: '🧭',
      category: 'community',
      status: 'building',
      format: 'hybrid',
      priority: 7,
      url: 'conscious-networking.html',
      owner: 'Andrij Pýcha',
      title: {
        ru: 'Платформа осознанного нетворкинга',
        en: 'Conscious Networking Platform',
        cz: 'Platforma vědomého networkingu',
        ua: 'Платформа усвідомленого нетворкінгу'
      },
      desc: {
        ru: 'Осознанные связи, встречи и взаимопомощь, чтобы люди сотрудничали и реализовывали полезные идеи.',
        en: 'Conscious connections, meetups, and mutual help so people can collaborate and realize useful ideas.',
        cz: 'Vědomá propojení, setkání a vzájemná pomoc, aby lidé spolupracovali a realizovali užitečné nápady.',
        ua: 'Усвідомлені зв’язки, зустрічі й взаємодопомога, щоб люди співпрацювали та реалізували корисні ідеї.'
      }
    },
    {
      slug: 'conscious-relationships',
      icon: '💞',
      category: 'community',
      status: 'concept',
      format: 'hybrid',
      priority: 8,
      url: 'conscious-relationships.html',
      owner: 'Andrij Pýcha',
      title: {
        ru: 'Платформа осознанных отношений',
        en: 'Conscious Relationships Platform',
        cz: 'Platforma vědomých vztahů',
        ua: 'Платформа усвідомлених стосунків'
      },
      desc: {
        ru: 'События и будущий бот для знакомств через ценности, намерения, совместимость и честный контакт между людьми.',
        en: 'Events and a future bot for meeting through values, intentions, compatibility, and honest contact between people.',
        cz: 'Akce a budoucí bot pro seznamování skrze hodnoty, záměry, kompatibilitu a upřímný kontakt mezi lidmi.',
        ua: 'Події та майбутній бот для знайомств через цінності, наміри, сумісність і чесний контакт між людьми.'
      }
    },
    {
      slug: 'ethical-automation-agency',
      icon: '⚙️',
      category: 'digital',
      status: 'building',
      format: 'online',
      priority: 10,
      url: 'ethical-automation-agency.html',
      owner: 'Andrij Pýcha',
      title: {
        ru: 'Этичная агентура маркетинга и автоматизации',
        en: 'Ethical Marketing & Automation Agency',
        cz: 'Etická marketingová a automatizační agentura',
        ua: 'Етична агенція маркетингу й автоматизації'
      },
      desc: {
        ru: 'Три агентских направления для стартапов, бизнеса и социальных проектов: маркетинг, AI, автоматизация и фонд реализации.',
        en: 'Three agency directions for startups, business, and social projects: marketing, AI, automation, and a realization fund.',
        cz: 'Tři agenturní směry pro startupy, byznys a sociální projekty: marketing, AI, automatizace a realizační fond.',
        ua: 'Три агентські напрями для стартапів, бізнесу й соціальних проєктів: маркетинг, AI, автоматизація та фонд реалізації.'
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

  function normalizeOwner(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  function t(key) {
    const dictionary = labels[currentLang] || labels[DEFAULT_LANG];
    return key.split('.').reduce((acc, part) => acc && acc[part], dictionary) || key;
  }

  function filteredProjects() {
    const result = projects.filter(project => {
      const category = state.category === 'all' || project.category === state.category;
      const status = state.status === 'all' || project.status === state.status;
      const owner = state.owner === 'all' || normalizeOwner(project.owner) === state.owner;
      return category && status && owner;
    });

    return result.sort((a, b) => {
      if (state.sort === 'title') return localize(a.title).localeCompare(localize(b.title));
      if (state.sort === 'status') return a.status.localeCompare(b.status) || a.priority - b.priority;
      if (state.sort === 'owner') return a.owner.localeCompare(b.owner) || a.priority - b.priority;
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
    state.owner = 'all';
    state.sort = 'priority';
    document.querySelectorAll('#projects-filters .filter-tab').forEach(tab => {
      const active = tab.dataset.value === 'all';
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    const sort = document.getElementById('projects-sort');
    if (sort) sort.value = 'priority';
    const owner = document.getElementById('projects-owner-filter');
    if (owner) owner.value = 'all';
    render();
  }

  function applyUrlFilters() {
    const params = new URLSearchParams(window.location.search);
    const ownerParam = params.get('owner');
    const mineParam = params.get('mine');
    const ownerValue = ownerParam || (mineParam === '1' ? 'andrijpycha' : '');
    if (!ownerValue) return;

    const owner = document.getElementById('projects-owner-filter');
    const normalizedOwner = normalizeOwner(ownerValue);
    const hasOwner = owner && Array.from(owner.options).some(option => option.value === normalizedOwner);
    if (!hasOwner) return;

    state.owner = normalizedOwner;
    owner.value = normalizedOwner;
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

    const owner = document.getElementById('projects-owner-filter');
    if (owner) {
      owner.addEventListener('change', () => {
        state.owner = owner.value;
        render();
      });
    }

    const reset = document.getElementById('projects-reset-filters');
    if (reset) reset.addEventListener('click', resetFilters);

    applyUrlFilters();
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
