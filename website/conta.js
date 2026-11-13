import { createAuthClient } from '@neon/auth';

const el = id => document.getElementById(id);
const message = el('account-message');
const form = el('account-form');
let auth;
let signup = false;

function status(text, error = false) {
  message.textContent = text;
  message.classList.toggle('error', error);
}

function setMode(create) {
  signup = create;
  el('show-login').setAttribute('aria-pressed', String(!create));
  el('show-signup').setAttribute('aria-pressed', String(create));
  el('account-name-label').hidden = !create;
  el('account-name').required = create;
  el('account-password').autocomplete = create ? 'new-password' : 'current-password';
  el('account-submit').textContent = create ? 'Criar conta' : 'Entrar';
  status('');
}

function displaySession(session) {
  const user = session?.user;
  el('account-signed-in').hidden = !user;
  el('account-signed-out').hidden = !!user;
  el('account-user').textContent = user?.email || '';
  el('account-plan-actions').hidden = !user;
  if (!user) el('account-subscription').textContent = '';
}

async function refresh() {
  const { data, error } = await auth.getSession();
  if (error) throw error;
  displaySession(data);
  if (data?.user) await Promise.all([loadSubscription(), loadCheckoutAvailability()]);
}

async function loadSubscription() {
  const target = el('account-subscription');
  target.textContent = 'Consultando período de teste...';
  try {
    // The installed Neon wrapper injects its JWT into the session token.
    const { data, error } = await auth.getSession();
    const token = data?.session?.token;
    if (error || typeof token !== 'string' || token.split('.').length !== 3) throw new Error();
    const response = await fetch('/api/subscription', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (!response.ok) throw new Error();
    const subscription = await response.json();
    const date = new Date(subscription.status === 'trial' ? subscription.trialEndsAt : subscription.accessEndsAt);
    if (Number.isNaN(date.getTime())) throw new Error();
    const formatted = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(date);
    target.textContent = subscription.status === 'trial' ? `Período grátis de teste até ${formatted}.` :
      subscription.status === 'paid' ? `Período de acesso até ${formatted}.` : 'Período de acesso encerrado.';
  } catch { target.textContent = 'Não foi possível consultar o período de teste.'; }
}

const paymentButtons = [...document.querySelectorAll('[data-plan]')];

async function loadCheckoutAvailability() {
  const notice = el('account-checkout-notice');
  paymentButtons.forEach(button => { button.disabled = true; });
  notice.textContent = 'Pagamento indisponível durante a preparação do sistema.';
  try {
    const response = await fetch('/api/billing-status', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    if (data?.checkoutAvailable !== true) return;
    paymentButtons.forEach(button => { button.disabled = false; });
    notice.textContent = 'Escolha um plano para abrir o pagamento seguro.';
  } catch { /* Unavailable is the safe default. */ }
}

async function startCheckout(plan) {
  const notice = el('account-checkout-notice');
  paymentButtons.forEach(button => { button.disabled = true; });
  notice.textContent = 'Preparando seu pagamento...';
  try {
    const { data, error } = await auth.getSession();
    const token = data?.session?.token;
    if (error || typeof token !== 'string' || token.split('.').length !== 3) throw new Error('Not authenticated');
    const response = await fetch('/api/checkout', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ plan }),
    });
    if (!response.ok) throw new Error('Checkout unavailable');
    const { url: link } = await response.json();
    const url = new URL(link);
    if (url.protocol !== 'https:' ||
        !['checkout.infinitepay.io', 'checkout.infinitepay.com.br'].includes(url.hostname) ||
        url.username || url.password || url.port) throw new Error('Untrusted checkout URL');
    window.location.assign(url.href);
  } catch {
    notice.textContent = 'Não foi possível iniciar o pagamento. Tente novamente mais tarde.';
    await loadCheckoutAvailability();
  }
}
paymentButtons.forEach(button => button.addEventListener('click', () => startCheckout(button.dataset.plan)));

el('show-login').addEventListener('click', () => setMode(false));
el('show-signup').addEventListener('click', () => setMode(true));
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = el('account-submit');
  button.disabled = true;
  status('Aguarde...');
  try {
    const email = el('account-email').value.trim();
    const password = el('account-password').value;
    const result = signup
      ? await auth.signUp.email({ name: el('account-name').value.trim(), email, password })
      : await auth.signIn.email({ email, password });
    if (result.error) throw result.error;
    el('account-password').value = '';
    await refresh();
    status(signup ? 'Conta de teste criada.' : 'Entrada realizada.');
  } catch {
    status('Não foi possível continuar. Confira os dados ou tente novamente.', true);
  } finally { button.disabled = false; }
});
el('account-signout').addEventListener('click', async () => {
  try {
    const { error } = await auth.signOut();
    if (error) throw error;
    displaySession(null);
    status('Você saiu da conta.');
  } catch { status('Não foi possível sair. Tente novamente.', true); }
});

(async () => {
  try {
    const response = await fetch('/api/auth-config', { cache: 'no-store' });
    if (!response.ok) throw new Error();
    const { authUrl } = await response.json();
    auth = createAuthClient(authUrl);
    await refresh();
    status('');
  } catch { status('A área de contas ainda não está disponível.', true); }
})();
