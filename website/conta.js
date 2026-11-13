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
}

async function refresh() {
  const { data, error } = await auth.getSession();
  if (error) throw error;
  displaySession(data);
}

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
