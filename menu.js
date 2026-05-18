document.addEventListener('DOMContentLoaded', function() {
  const triggers = document.querySelectorAll('.menu-trigger');
  const menu = document.querySelector('.quick-menu');
  const links = menu.querySelectorAll('a');

  const CABINET_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>';

  function createCabinetButton(extraClass = '') {
    const button = document.createElement('a');
    button.href = 'cabinet.html';
    button.className = `cabinet-btn ${extraClass}`.trim();
    button.title = 'Cabinet';
    button.setAttribute('aria-label', 'Cabinet');
    button.innerHTML = CABINET_ICON;
    return button;
  }

  function ensureCabinetButtons() {
    document.querySelectorAll('.desktop-controls').forEach((controls) => {
      let button = controls.querySelector('.cabinet-btn');
      if (!button) {
        button = createCabinetButton();
        const loginButton = controls.querySelector('.tg-login-btn');
        controls.insertBefore(button, loginButton || controls.firstChild);
      }
      button.style.display = 'flex';
    });

    document.querySelectorAll('.menu-controls').forEach((controls) => {
      let button = controls.querySelector('.cabinet-btn');
      if (!button) {
        button = createCabinetButton('cabinet-btn--menu');
        controls.insertBefore(button, controls.firstChild);
      }
      button.style.display = 'flex';
    });
  }

  ensureCabinetButtons();

  // toggle menu open/close
  triggers.forEach(trigger => {
    trigger.addEventListener('click', () => {
      menu.classList.toggle('open');
    });
  });

  // handle navigation clicks
  links.forEach(link => {
    link.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      
      if (href && href.startsWith('#')) {
        e.preventDefault();
        // remove active from any previous
        menu.querySelectorAll('a.active').forEach(a => a.classList.remove('active'));
        this.classList.add('active');
        
        const targetEl = document.querySelector(href);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth' });
        }
        // close menu after clicking a link
        menu.classList.remove('open');
      } else {
        // close menu for normal links before navigating away
        menu.classList.remove('open');
      }
    });
  });

  // Global Auth Logic for Telegram Login Button
  function updateAuthUI(user) {
    const tgBtns = document.querySelectorAll('.tg-login-btn');
    tgBtns.forEach(btn => {
      const tgText = btn.querySelector('.tg-text');
      if (user && user.isLoggedIn) {
        btn.classList.add('logged-in');
        btn.href = 'https://t.me/santioago_bot';
        if (tgText) tgText.style.display = 'none';
      } else {
        btn.classList.remove('logged-in');
        btn.href = 'https://t.me/santioago_bot?start=login';
        if (tgText) tgText.style.display = 'inline';
      }
    });

    // Handle Cabinet button visibility
    const cabinetBtns = document.querySelectorAll('.cabinet-btn');
    cabinetBtns.forEach(btn => {
      btn.style.display = 'flex';
    });
  }

  window.MA3Menu = { updateAuthUI };

  // Initial check
  if (window.MA3Auth) {
    updateAuthUI(window.MA3Auth.user);
  }

  // Listen for changes
  document.addEventListener('ma3-auth-changed', (e) => {
    updateAuthUI(e.detail);
  });
});
