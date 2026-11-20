(() => {
  'use strict';

  const CONTAINER_ID = 'GTM-KD893LRD';
  const CONSENT_KEY = 'seven-desk-marketing-consent-v1';
  const SENT_PREFIX = 'seven-desk-paid-conversion:';
  let selection = null;
  let loaded = false;
  const emitted = new Set();

  try { selection = localStorage.getItem(CONSENT_KEY); } catch {}
  if (selection !== 'granted' && selection !== 'denied') selection = null;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  gtag('consent', 'default', {
    ad_storage: 'denied',
    analytics_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });

  function loadTagManager() {
    if (loaded || selection !== 'granted') return;
    loaded = true;
    gtag('consent', 'update', {
      ad_storage: 'granted',
      analytics_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
    });
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtm.js?id=' + CONTAINER_ID;
    document.head.appendChild(script);
  }

  function choose(value) {
    selection = value === 'granted' ? 'granted' : 'denied';
    try { localStorage.setItem(CONSENT_KEY, selection); } catch {}
    if (selection === 'granted') loadTagManager();
    else {
      gtag('consent', 'update', {
        ad_storage: 'denied', analytics_storage: 'denied',
        ad_user_data: 'denied', ad_personalization: 'denied',
      });
      // Previously loaded marketing scripts cannot be unloaded safely.
      if (loaded) window.location.reload();
    }
    renderPreference();
  }

  function subscriptionConfirmed(transactionId) {
    if (selection !== 'granted' || !loaded ||
        typeof transactionId !== 'string' || !transactionId ||
        transactionId.length > 255 || emitted.has(transactionId)) return false;
    const key = SENT_PREFIX + transactionId;
    try { if (sessionStorage.getItem(key) === '1') return false; } catch {}
    emitted.add(transactionId);
    try { sessionStorage.setItem(key, '1'); } catch {}
    window.dataLayer.push({
      event: 'seven_desk_subscription_paid',
      transaction_id: transactionId,
      currency: 'BRL',
    });
    return true;
  }

  function action(text, callback, className) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.className = className;
    button.addEventListener('click', callback);
    return button;
  }

  function renderPreference() {
    document.getElementById('sd-consent-panel')?.remove();
    document.getElementById('sd-consent-manage')?.remove();
    const manage = action('Preferências de cookies', () => {
      selection = null;
      renderPreference();
    }, 'sd-consent-manage');
    manage.id = 'sd-consent-manage';
    if (selection) {
      document.body.appendChild(manage);
      return;
    }

    const panel = document.createElement('section');
    panel.id = 'sd-consent-panel';
    panel.className = 'sd-consent-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Preferências de privacidade');
    const title = document.createElement('strong');
    title.textContent = 'Sua privacidade importa';
    const copy = document.createElement('p');
    copy.textContent = 'Usamos tecnologias opcionais do Google para medir anúncios. O site funciona normalmente sem elas. Você pode alterar sua escolha a qualquer momento.';
    const actions = document.createElement('div');
    actions.className = 'sd-consent-actions';
    actions.appendChild(action('Recusar opcionais', () => choose('denied'), 'sd-consent-decline'));
    actions.appendChild(action('Aceitar opcionais', () => choose('granted'), 'sd-consent-accept'));
    const details = document.createElement('a');
    details.href = '/privacidade.html';
    details.textContent = 'Saiba mais na Política de Privacidade';
    panel.append(title, copy, actions, details);
    document.body.appendChild(panel);
  }

  window.sevenDeskAnalytics = Object.freeze({
    subscriptionConfirmed,
    openPreferences() { selection = null; renderPreference(); },
  });
  if (selection === 'granted') loadTagManager();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderPreference, { once: true });
  } else renderPreference();
})();
