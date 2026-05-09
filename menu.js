document.addEventListener('DOMContentLoaded', function() {
  const trigger = document.querySelector('.menu-trigger');
  const menu = document.querySelector('.quick-menu');
  const links = menu.querySelectorAll('a');

  // toggle menu open/close
  trigger.addEventListener('click', () => {
    menu.classList.toggle('open');
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
});
