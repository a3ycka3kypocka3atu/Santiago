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
  const isLoggedIn = !!localStorage.getItem('ma3-user-id');
  const tgBtns = document.querySelectorAll('.tg-login-btn');
  
  tgBtns.forEach(btn => {
    if (isLoggedIn) {
      btn.classList.add('logged-in');
      btn.href = 'https://t.me/santioago_bot'; // Direct link when logged in
    } else {
      btn.classList.remove('logged-in');
      // When logged out, act as login trigger (here simply redirecting to bot to start the login flow, or if there's a login script, it will handle it)
      btn.href = 'https://t.me/santioago_bot?start=login';
    }
  });
});
