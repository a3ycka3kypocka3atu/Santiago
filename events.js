(function () {
  'use strict';

  const STORAGE_KEY = 'language';
  const DEFAULT_LANG = 'ru';
  const SUPPORTED = ['en', 'cz', 'ru', 'ua'];
  const state = { category: 'all', status: 'all', owner: 'all', sort: 'priority' };
  let currentLang = detectLanguage();

  const labels = {
    ru: {
      category: {
        networking: 'Нетворкинг',
        relationship: 'Отношения',
        media: 'Медиа',
        project: 'Проекты',
        knowledge: 'Знание'
      },
      status: { regular: 'Регулярно', upcoming: 'Ближайшее', concept: 'Концепт' },
      format: { offline: 'Офлайн', online: 'Онлайн', hybrid: 'Гибрид' },
      ownerPrefix: 'Ведущий',
      details: 'Подробнее',
      month: 'Ближайший формат',
      all: 'Все',
      categoryLabel: 'Категория',
      statusLabel: 'Статус',
      ownerLabel: 'Куратор',
      sortLabel: 'Сортировка',
      allOwners: 'Все кураторы',
      sortPriority: 'По приоритету',
      sortTitle: 'По названию',
      sortCategory: 'По категории',
      sortStatus: 'По статусу',
      empty: 'По этим критериям событий не найдено'
    },
    en: {
      category: {
        networking: 'Networking',
        relationship: 'Relationships',
        media: 'Media',
        project: 'Projects',
        knowledge: 'Knowledge'
      },
      status: { regular: 'Regular', upcoming: 'Upcoming', concept: 'Concept' },
      format: { offline: 'Offline', online: 'Online', hybrid: 'Hybrid' },
      ownerPrefix: 'Host',
      details: 'Learn More',
      month: 'Next format',
      all: 'All',
      categoryLabel: 'Category',
      statusLabel: 'Status',
      ownerLabel: 'Curator',
      sortLabel: 'Sort',
      allOwners: 'All curators',
      sortPriority: 'By priority',
      sortTitle: 'By title',
      sortCategory: 'By category',
      sortStatus: 'By status',
      empty: 'No events match these filters'
    },
    cz: {
      category: {
        networking: 'Networking',
        relationship: 'Vztahy',
        media: 'Média',
        project: 'Projekty',
        knowledge: 'Poznání'
      },
      status: { regular: 'Pravidelně', upcoming: 'Nejbližší', concept: 'Koncept' },
      format: { offline: 'Offline', online: 'Online', hybrid: 'Hybrid' },
      ownerPrefix: 'Hostitel',
      details: 'Více informací',
      month: 'Nejbližší formát',
      all: 'Vše',
      categoryLabel: 'Kategorie',
      statusLabel: 'Status',
      ownerLabel: 'Kurátor',
      sortLabel: 'Řazení',
      allOwners: 'Všichni kurátoři',
      sortPriority: 'Podle priority',
      sortTitle: 'Podle názvu',
      sortCategory: 'Podle kategorie',
      sortStatus: 'Podle statusu',
      empty: 'Pro tyto filtry nebyly nalezeny žádné události'
    },
    ua: {
      category: {
        networking: 'Нетворкінг',
        relationship: 'Стосунки',
        media: 'Медіа',
        project: 'Проєкти',
        knowledge: 'Знання'
      },
      status: { regular: 'Регулярно', upcoming: 'Найближче', concept: 'Концепт' },
      format: { offline: 'Офлайн', online: 'Онлайн', hybrid: 'Гібрид' },
      ownerPrefix: 'Ведучий',
      details: 'Детальніше',
      month: 'Найближчий формат',
      all: 'Всі',
      categoryLabel: 'Категорія',
      statusLabel: 'Статус',
      ownerLabel: 'Куратор',
      sortLabel: 'Сортування',
      allOwners: 'Усі куратори',
      sortPriority: 'За пріоритетом',
      sortTitle: 'За назвою',
      sortCategory: 'За категорією',
      sortStatus: 'За статусом',
      empty: 'За цими критеріями подій не знайдено'
    }
  };

  const events = [
    {
      slug: 'mutual-help-networking',
      icon: '🤝',
      category: 'networking',
      status: 'regular',
      format: 'offline',
      priority: 1,
      owner: 'Andrij Pýcha',
      ownerKey: 'andrijpycha',
      url: 'services.html?book=conscious-networking-facilitation',
      next: {
        ru: 'по запросу / клубная серия',
        en: 'on request / club series',
        cz: 'na vyžádání / klubová série',
        ua: 'за запитом / клубна серія'
      },
      title: {
        ru: 'Нетворкинг взаимопомощи',
        en: 'Mutual Help Networking',
        cz: 'Networking vzájemné pomoci',
        ua: 'Нетворкінг взаємодопомоги'
      },
      desc: {
        ru: 'Камерные встречи, где участники показывают, кто они, что создают, кому могут помочь и кого ищут для следующего шага.',
        en: 'Small-format meetups where people share who they are, what they build, who they can help, and who they need next.',
        cz: 'Komorní setkání, kde lidé sdílí, kdo jsou, co tvoří, komu mohou pomoct a koho hledají pro další krok.',
        ua: 'Камерні зустрічі, де учасники показують, хто вони, що створюють, кому можуть допомогти і кого шукають далі.'
      }
    },
    {
      slug: 'conscious-relationships',
      icon: '💞',
      category: 'relationship',
      status: 'concept',
      format: 'hybrid',
      priority: 2,
      owner: 'Andrij Pýcha',
      ownerKey: 'andrijpycha',
      url: 'services.html?book=conscious-relationship-discovery',
      next: {
        ru: 'первая группа в сборке',
        en: 'first group forming',
        cz: 'první skupina se skládá',
        ua: 'перша група у зборі'
      },
      title: {
        ru: 'Осознанные знакомства',
        en: 'Conscious Relationship Discovery',
        cz: 'Vědomé seznamování',
        ua: 'Усвідомлені знайомства'
      },
      desc: {
        ru: 'Формат для знакомства через ценности, намерения, совместимость и честный контакт, а не через случайный свайп.',
        en: 'A format for meeting through values, intentions, compatibility, and honest contact instead of random swiping.',
        cz: 'Formát seznamování skrze hodnoty, záměry, kompatibilitu a upřímný kontakt místo náhodného swipování.',
        ua: 'Формат знайомства через цінності, наміри, сумісність і чесний контакт, а не випадковий свайп.'
      }
    },
    {
      slug: 'santiago-talks',
      icon: '🎙️',
      category: 'media',
      status: 'regular',
      format: 'offline',
      priority: 3,
      owner: 'Open Mic',
      ownerKey: 'openmic',
      url: 'openmic.html',
      next: {
        ru: 'записи и живые разговоры',
        en: 'recordings and live talks',
        cz: 'nahrávky a živé rozhovory',
        ua: 'записи і живі розмови'
      },
      title: {
        ru: 'Santiago Talks и интервью',
        en: 'Santiago Talks & Interviews',
        cz: 'Santiago Talks a rozhovory',
        ua: 'Santiago Talks та інтервʼю'
      },
      desc: {
        ru: 'Разговоры о пути, проектах, опыте и идеях. Может быть живой встречей, записью интервью или открытым разговором.',
        en: 'Conversations about personal paths, projects, experience, and ideas as live meetups, interviews, or open talks.',
        cz: 'Rozhovory o cestě, projektech, zkušenostech a nápadech jako živá setkání, rozhovory nebo otevřené debaty.',
        ua: 'Розмови про шлях, проєкти, досвід та ідеї як жива зустріч, запис інтервʼю або відкритий діалог.'
      }
    },
    {
      slug: 'project-co-creation-circle',
      icon: '🚀',
      category: 'project',
      status: 'upcoming',
      format: 'hybrid',
      priority: 4,
      owner: 'Santiago Incubator',
      ownerKey: 'santiagoincubator',
      url: 'projects.html',
      next: {
        ru: 'питчи, роли, первые тесты',
        en: 'pitches, roles, first tests',
        cz: 'pitche, role, první testy',
        ua: 'пітчі, ролі, перші тести'
      },
      title: {
        ru: 'Круг со-творчества проектов',
        en: 'Project Co-Creation Circle',
        cz: 'Kruh spolutvorby projektů',
        ua: 'Коло співтворення проєктів'
      },
      desc: {
        ru: 'Вечер для идей, стартапов и инициатив: участники презентуют задумки, получают обратную связь и находят команду.',
        en: 'An evening for ideas, startups, and initiatives: participants pitch, receive feedback, and find collaborators.',
        cz: 'Večer pro nápady, startupy a iniciativy: účastníci prezentují, získávají feedback a hledají tým.',
        ua: 'Вечір для ідей, стартапів та ініціатив: учасники презентують задум, отримують фідбек і знаходять команду.'
      }
    },
    {
      slug: 'alternative-knowledge-lab',
      icon: '📚',
      category: 'knowledge',
      status: 'concept',
      format: 'hybrid',
      priority: 5,
      owner: 'Andrij Pýcha',
      ownerKey: 'andrijpycha',
      url: 'services.html?book=alternative-knowledge-workshop',
      next: {
        ru: 'лекции и лаборатории',
        en: 'lectures and labs',
        cz: 'přednášky a laboratoře',
        ua: 'лекції та лабораторії'
      },
      title: {
        ru: 'Альтернативная история, наука и энергия',
        en: 'Alternative History, Science & Energy',
        cz: 'Alternativní historie, věda a energie',
        ua: 'Альтернативна історія, наука та енергія'
      },
      desc: {
        ru: 'Лекции и обсуждения о необычных взглядах на историю, науку, восприятие, энергию и скрытые процессы.',
        en: 'Lectures and discussions around unusual perspectives on history, science, perception, energy, and hidden processes.',
        cz: 'Přednášky a diskuse o neobvyklých pohledech na historii, vědu, vnímání, energii a skryté procesy.',
        ua: 'Лекції та обговорення незвичних поглядів на історію, науку, сприйняття, енергію та приховані процеси.'
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

  function label(path) {
    const dictionary = labels[currentLang] || labels[DEFAULT_LANG];
    return path.split('.').reduce((acc, part) => acc && acc[part], dictionary) || path;
  }

  function filteredEvents() {
    const visible = events.filter(event => {
      const category = state.category === 'all' || event.category === state.category;
      const status = state.status === 'all' || event.status === state.status;
      const owner = state.owner === 'all' || event.ownerKey === state.owner;
      return category && status && owner;
    });

    return visible.sort((a, b) => {
      if (state.sort === 'title') return localize(a.title).localeCompare(localize(b.title));
      if (state.sort === 'category') return a.category.localeCompare(b.category) || a.priority - b.priority;
      if (state.sort === 'status') return a.status.localeCompare(b.status) || a.priority - b.priority;
      return a.priority - b.priority;
    });
  }

  function createCard(event) {
    const card = document.createElement('article');
    card.className = 'preview-card';
    card.tabIndex = 0;
    card.dataset.url = event.url;

    card.innerHTML = `
      <div class="preview-card__icon">${event.icon}</div>
      <div class="preview-card__body">
        <div class="preview-card__meta">
          <span class="preview-badge">${label(`category.${event.category}`)}</span>
          <span class="preview-format">${label(`status.${event.status}`)}</span>
        </div>
        <h3 class="preview-card__title">${localize(event.title)}</h3>
        <span class="preview-price">${label('month')}: ${localize(event.next)} · ${label(`format.${event.format}`)}</span>
        <p class="preview-desc">${localize(event.desc)}</p>
        <div class="preview-card__footer">
          <span class="preview-master">${label('ownerPrefix')}: ${event.owner}</span>
          <a class="preview-card__cta" href="${event.url}">
            <span>${label('details')}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
          </a>
        </div>
      </div>
    `;

    card.addEventListener('click', clickEvent => {
      if (clickEvent.target.closest('a, button')) return;
      window.location.href = event.url;
    });

    card.addEventListener('keydown', keyEvent => {
      if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
        keyEvent.preventDefault();
        window.location.href = event.url;
      }
    });

    return card;
  }

  function render() {
    const grid = document.getElementById('events-grid');
    const empty = document.getElementById('events-empty');
    if (!grid) return;

    updateStaticText();
    const visible = filteredEvents();
    grid.innerHTML = '';

    if (!visible.length) {
      grid.style.display = 'none';
      if (empty) empty.style.display = 'flex';
      return;
    }

    grid.style.display = 'grid';
    if (empty) empty.style.display = 'none';
    visible.forEach(event => grid.appendChild(createCard(event)));
  }

  function setText(selector, value) {
    const node = document.querySelector(selector);
    if (node) node.textContent = value;
  }

  function updateStaticText() {
    setText('#events-filters .filter-label[data-events-label="category"]', label('categoryLabel'));
    setText('#events-filters .filter-label[data-events-label="status"]', label('statusLabel'));
    setText('#events-filters .filter-label[data-events-label="owner"]', label('ownerLabel'));
    setText('#events-filters .filter-label[data-events-label="sort"]', label('sortLabel'));
    setText('#events-filters [data-filter="category"][data-value="all"]', label('all'));
    setText('#events-filters [data-filter="category"][data-value="networking"]', label('category.networking'));
    setText('#events-filters [data-filter="category"][data-value="relationship"]', label('category.relationship'));
    setText('#events-filters [data-filter="category"][data-value="media"]', label('category.media'));
    setText('#events-filters [data-filter="category"][data-value="project"]', label('category.project'));
    setText('#events-filters [data-filter="category"][data-value="knowledge"]', label('category.knowledge'));
    setText('#events-filters [data-filter="status"][data-value="all"]', label('all'));
    setText('#events-filters [data-filter="status"][data-value="regular"]', label('status.regular'));
    setText('#events-filters [data-filter="status"][data-value="upcoming"]', label('status.upcoming'));
    setText('#events-filters [data-filter="status"][data-value="concept"]', label('status.concept'));
    setText('#events-owner-filter option[value="all"]', label('allOwners'));
    setText('#events-sort option[value="priority"]', label('sortPriority'));
    setText('#events-sort option[value="title"]', label('sortTitle'));
    setText('#events-sort option[value="category"]', label('sortCategory'));
    setText('#events-sort option[value="status"]', label('sortStatus'));
    setText('#events-empty .services-empty__text', label('empty'));
  }

  function setTabState(tab) {
    const filterType = tab.dataset.filter;
    document.querySelectorAll(`#events-filters .filter-tab[data-filter="${filterType}"]`).forEach(item => {
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
    document.querySelectorAll('#events-filters .filter-tab').forEach(tab => {
      const active = tab.dataset.value === 'all';
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    const owner = document.getElementById('events-owner-filter');
    if (owner) owner.value = 'all';
    const sort = document.getElementById('events-sort');
    if (sort) sort.value = 'priority';
    render();
  }

  function applyUrlFilters() {
    const params = new URLSearchParams(window.location.search);
    const ownerParam = params.get('owner');
    const instructorParam = params.get('instructor');
    const mineParam = params.get('mine');
    const ownerValue = ownerParam || (instructorParam === 'andrij' || mineParam === '1' ? 'andrijpycha' : '');
    if (ownerValue) {
      const owner = document.getElementById('events-owner-filter');
      const hasOwner = owner && Array.from(owner.options).some(option => option.value === ownerValue);
      if (hasOwner) {
        state.owner = ownerValue;
        owner.value = ownerValue;
      }
    }

    const categoryParam = params.get('category');
    const categoryTab = categoryParam && document.querySelector(`#events-filters .filter-tab[data-filter="category"][data-value="${categoryParam}"]`);
    if (categoryTab) {
      state.category = categoryParam;
      setTabState(categoryTab);
    }
  }

  function init() {
    document.querySelectorAll('#events-filters .filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        state[tab.dataset.filter] = tab.dataset.value;
        setTabState(tab);
        render();
      });
    });

    const owner = document.getElementById('events-owner-filter');
    if (owner) {
      owner.addEventListener('change', () => {
        state.owner = owner.value;
        render();
      });
    }

    const sort = document.getElementById('events-sort');
    if (sort) {
      sort.addEventListener('change', () => {
        state.sort = sort.value;
        render();
      });
    }

    const reset = document.getElementById('events-reset-filters');
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
