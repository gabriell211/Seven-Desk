/* Seven Desk visual preferences, independent from authentication/session state. */
(() => {
  'use strict';

  const STORAGE_KEY = 'sevendesk.theme';
  const valid = new Set(['light', 'dark', 'system']);
  const root = document.documentElement;
  const media = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

  function readChoice() {
    try {
      const value = window.localStorage.getItem(STORAGE_KEY);
      return valid.has(value) ? value : 'system';
    } catch (_) {
      return 'system';
    }
  }

  let choice = readChoice();

  function effectiveTheme() {
    return choice === 'system' ? (media?.matches ? 'dark' : 'light') : choice;
  }

  function applyTheme() {
    const theme = effectiveTheme();
    root.dataset.theme = theme;
    root.dataset.themePreference = choice;
    root.style.colorScheme = theme;

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#130d22' : '#faf7ff');

    document.querySelectorAll('[data-theme-select]').forEach(select => {
      if (select.value !== choice) select.value = choice;
    });
  }

  function setChoice(value) {
    if (!valid.has(value)) return;
    choice = value;
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch (_) {
      // Privacy-mode browsing still allows choosing the theme for this page.
    }
    applyTheme();
  }

  // Executes synchronously from the head so dark mode is applied before CSS paint.
  applyTheme();

  const onSystemChange = () => {
    if (choice === 'system') applyTheme();
  };
  if (media?.addEventListener) media.addEventListener('change', onSystemChange);
  else if (media?.addListener) media.addListener(onSystemChange);

  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY || event.key === null) {
      choice = readChoice();
      applyTheme();
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-theme-select]').forEach(select => {
      select.value = choice;
      select.addEventListener('change', () => setChoice(select.value));
    });
    applyTheme();
  });
})();
