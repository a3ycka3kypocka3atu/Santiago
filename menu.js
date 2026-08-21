(function () {
  'use strict';

  const NAV_ITEMS = [
    ['index.html', 'Discover'],
    ['services.html', 'Services'],
    ['masters.html', 'Practitioners'],
    ['map.html', 'Map'],
    ['events.html', 'Events'],
    ['about.html', 'About']
  ];

  function currentPage() {
    const page = window.location.pathname.split('/').pop();
    return page || 'index.html';
  }

  function navList() {
    const activePage = currentPage();
    return NAV_ITEMS.map(([href, label]) => {
      const current = href === activePage ? ' aria-current="page" class="active"' : '';
      return `<li><a href="${href}"${current}>${label}</a></li>`;
    }).join('');
  }

  function preparePublicShell() {
    document.documentElement.lang = 'en';

    document.querySelectorAll('.home-icon, .lang-switcher, .tg-login-btn, .cabinet-btn, #user-badge, #guest-cta, #master-calendar-cta')
      .forEach((element) => {
        element.hidden = true;
        element.setAttribute('aria-hidden', 'true');
      });

    document.querySelectorAll('a[target="_blank"]').forEach((link) => {
      const values = new Set((link.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
      values.add('noopener');
      values.add('noreferrer');
      link.setAttribute('rel', Array.from(values).join(' '));
    });

    document.querySelectorAll('.site-nav ul').forEach((list) => {
      list.innerHTML = navList();
    });

    document.querySelectorAll('.footer p').forEach((paragraph) => {
      paragraph.textContent = '© 2026 Lumeya. Public holistic discovery.';
      paragraph.removeAttribute('data-i18n');
    });

    const main = document.querySelector('main, [role="main"], .page-wrapper');
    if (main && !main.id) main.id = 'main';
    if (main && !document.querySelector('.skip-link')) {
      const skip = document.createElement('a');
      skip.className = 'skip-link';
      skip.href = `#${main.id}`;
      skip.textContent = 'Skip to content';
      document.body.prepend(skip);
    }
  }

  function prepareMenu(menu, index) {
    const id = menu.id || `site-menu-${index + 1}`;
    menu.id = id;
    menu.innerHTML = `
      <div class="quick-menu__head">
        <span>Lumeya</span>
        <button class="menu-close" type="button" aria-label="Close menu">×</button>
      </div>
      <ul>${navList()}</ul>
      <a class="quick-menu__action" href="suggest.html">Suggest a listing or tell us what you need</a>`;
    menu.hidden = true;
    menu.inert = true;

    const triggers = Array.from(document.querySelectorAll('.menu-trigger'));
    const trigger = triggers[index] || triggers[0];
    if (!trigger) return;

    trigger.type = 'button';
    trigger.setAttribute('aria-controls', id);
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-label', 'Open menu');

    let previousFocus = null;

    function openMenu() {
      previousFocus = document.activeElement;
      menu.hidden = false;
      menu.inert = false;
      menu.classList.add('open');
      document.body.classList.add('menu-open');
      trigger.setAttribute('aria-expanded', 'true');
      trigger.setAttribute('aria-label', 'Close menu');
      menu.querySelector('.menu-close, a')?.focus();
    }

    function closeMenu({ restoreFocus = true } = {}) {
      menu.classList.remove('open');
      document.body.classList.remove('menu-open');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-label', 'Open menu');
      menu.hidden = true;
      menu.inert = true;
      if (restoreFocus && previousFocus instanceof HTMLElement) previousFocus.focus();
    }

    trigger.addEventListener('click', () => {
      if (menu.hidden) openMenu();
      else closeMenu();
    });
    menu.querySelector('.menu-close')?.addEventListener('click', () => closeMenu());
    menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => closeMenu({ restoreFocus: false })));

    menu.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(menu.querySelectorAll('button, a[href]'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !menu.hidden) closeMenu();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    preparePublicShell();
    document.querySelectorAll('.quick-menu').forEach(prepareMenu);
  });

  window.LumeyaNavigation = { items: NAV_ITEMS.slice() };
})();
