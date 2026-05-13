(function () {
  'use strict';

  const state = { direction: 'all', format: 'all', role: 'all' };

  function matches(card, key, value) {
    if (value === 'all') return true;
    return (` ${card.dataset[key] || ''} `).includes(` ${value} `);
  }

  function setTabState(tab) {
    const filterType = tab.dataset.filter;
    document.querySelectorAll(`#masters-filters .filter-tab[data-filter="${filterType}"]`).forEach(item => {
      const active = item === tab;
      item.classList.toggle('active', active);
      item.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  function applyFilters() {
    const cards = Array.from(document.querySelectorAll('#masters-grid .preview-card'));
    const grid = document.getElementById('masters-grid');
    const empty = document.getElementById('masters-empty');
    let visibleCount = 0;

    cards.forEach(card => {
      const visible = matches(card, 'direction', state.direction)
        && matches(card, 'format', state.format)
        && matches(card, 'role', state.role);

      card.style.display = visible ? '' : 'none';
      if (visible) visibleCount += 1;
    });

    if (grid) grid.style.display = visibleCount ? 'grid' : 'none';
    if (empty) empty.style.display = visibleCount ? 'none' : 'flex';
  }

  function resetFilters() {
    state.direction = 'all';
    state.format = 'all';
    state.role = 'all';

    document.querySelectorAll('#masters-filters .filter-tab').forEach(tab => {
      const active = tab.dataset.value === 'all';
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    const roleSelect = document.getElementById('master-role-filter');
    if (roleSelect) roleSelect.value = 'all';
    applyFilters();
  }

  function init() {
    document.querySelectorAll('#masters-filters .filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        state[tab.dataset.filter] = tab.dataset.value;
        setTabState(tab);
        applyFilters();
      });
    });

    const roleSelect = document.getElementById('master-role-filter');
    if (roleSelect) {
      roleSelect.addEventListener('change', () => {
        state.role = roleSelect.value;
        applyFilters();
      });
    }

    const reset = document.getElementById('masters-reset-filters');
    if (reset) reset.addEventListener('click', resetFilters);

    applyFilters();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
