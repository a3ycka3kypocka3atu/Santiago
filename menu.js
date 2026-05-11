document.addEventListener('DOMContentLoaded', function() {
  const triggers = document.querySelectorAll('.menu-trigger');
  const menu = document.querySelector('.quick-menu');
  const links = menu.querySelectorAll('a');

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
      if (user && user.isLoggedIn) {
        btn.style.display = 'flex';
      } else {
        btn.style.display = 'none';
      }
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
