(() => {
  'use strict';

  const toggle = document.getElementById('menu-toggle');
  const nav = document.getElementById('mobile-navigation');
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  function setMenu(open) {
    if (!toggle || !nav) return;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    nav.hidden = !open;
  }

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });
    nav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => setMenu(false));
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') setMenu(false);
    });
    document.addEventListener('click', event => {
      if (!nav.hidden && !nav.contains(event.target) && !toggle.contains(event.target)) {
        setMenu(false);
      }
    });
    window.matchMedia('(min-width: 981px)').addEventListener('change', event => {
      if (event.matches) setMenu(false);
    });
  }

  // Keep FAQ interactions accessible and avoid multiple expanded answers.
  const questions = Array.from(document.querySelectorAll('.faq-list details'));
  questions.forEach(question => {
    question.addEventListener('toggle', () => {
      if (!question.open) return;
      questions.forEach(other => {
        if (other !== question) other.open = false;
      });
    });
  });

  // The site intentionally links to the current official release listing,
  // never to a hard-coded binary that may be unavailable or unverified.
})();
