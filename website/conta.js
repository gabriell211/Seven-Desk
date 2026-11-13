import { createAuthClient } from '@neon/auth';

const el = id => document.getElementById(id);
const form = el('account-form');
const message = el('account-message');
const paymentButtons = [...document.querySelectorAll('[data-plan]')];
const params = new URLSearchParams(window.location.search);
const isResetPage = window.location.pathname === '/redefinir-senha';
const resetToken = isResetPage ? params.get('token') : null;
let auth;
let signup = window.location.pathname === '/cadastro';
let availability = {loginEnabled:false, registrationEnabled:false, recoveryEnabled:false};

// One-time reset tokens should not remain visible in browser history/referrers.
if (isResetPage && window.location.search) {
  window.history.replaceState({}, '', window.location.pathname);
}

function status(text, error = false) {
  message.textContent = text;
  message.classList.toggle('error', error);
}
function showServiceMessage(text) {
  const banner = el('account-service-message');
  banner.textContent = text;
  banner.hidden = !text;
}
function setMode(create) {
  signup = create;
  el('account-signed-out').hidden = false;
  el('account-recovery-form').hidden = true;
  el('account-reset-form').hidden = true;
  form.hidden = false;
  el('account-tabs').hidden = false;
  el('show-login').setAttribute('aria-pressed', String(!create));
  el('show-signup').setAttribute('aria-pressed', String(create));
  el('account-name-label').hidden = !create;
  el('account-name').required = create;
  el('account-password').autocomplete = create ? 'new-password' : 'current-password';
  el('account-submit').textContent = create ? 'Criar conta' : 'Entrar';
  el('account-submit').disabled = create ? !availability.registrationEnabled : !availability.loginEnabled;
  el('account-forgot-link').hidden = create;
  el('account-title').textContent = create ? 'Crie sua conta' : 'Entre na sua conta';
  el('account-intro').textContent = create
    ? 'Cadastre-se para acompanhar seu período gratuito e gerenciar seus planos.'
    : 'Acesse seus dados e acompanhe sua assinatura.';
  showServiceMessage(create && !availability.registrationEnabled
    ? 'Cadastros ainda não estão disponíveis. Estamos preparando a verificação de e-mail e a integração com o aplicativo.'
    : !create && !availability.loginEnabled
      ? 'O acesso à conta está temporariamente desativado enquanto finalizamos a integração.'
      : '');
  status('');
}
function setRecoveryMode(reset) {
  el('account-signed-out').hidden = false;
  form.hidden = true;
  el('account-tabs').hidden = true;
  el('account-recovery-form').hidden = reset;
  el('account-reset-form').hidden = !reset;
  const available = availability.recoveryEnabled;
  el(reset ? 'reset-submit' : 'recovery-submit').disabled = !available;
  el('account-title').textContent = reset ? 'Redefina sua senha' : 'Recupere seu acesso';
  el('account-intro').textContent = reset
    ? 'Escolha uma senha forte para proteger sua conta.'
    : 'Informe o e-mail para receber instruções de recuperação.';
  showServiceMessage(!available
    ? 'A recuperação de senha está temporariamente indisponível até a configuração segura do serviço de e-mail.'
    : '');
  if (reset && (!resetToken || resetToken.length > 2048)) {
    el('reset-submit').disabled = true;
    status('Link de redefinição inválido ou expirado. Solicite outro.', true);
  } else status('');
}
function displaySession(session) {
  const user = session?.user;
  el('account-signed-in').hidden = !user;
  el('account-signed-out').hidden = !!user;
  el('account-user').textContent = user?.email || '';
  el('account-plan-actions').hidden = !user;
  if (!user) el('account-subscription').textContent = '';
  if (user) {
    showServiceMessage('');
    el('account-title').textContent = 'Sua conta Seven Desk';
    el('account-intro').textContent = 'Acompanhe suas informações e o status da assinatura.';
  }
}
async function refresh() {
  const {data, error} = await auth.getSession();
  if (error) throw error;
  displaySession(data);
  if (data?.user) await Promise.all([loadSubscription(), loadCheckoutAvailability()]);
}
async function loadSubscription() {
  const target = el('account-subscription');
  target.textContent = 'Consultando período de acesso...';
  try {
    const {data, error} = await auth.getSession();
    const token = data?.session?.token;
    if (error || typeof token !== 'string' || token.split('.').length !== 3) throw new Error('Invalid session');
    const response = await fetch('/api/subscription', {headers: {Authorization: `Bearer ${token}`}, cache: 'no-store'});
    if (!response.ok) throw new Error('Unavailable');
    const subscription = await response.json();
    const date = new Date(subscription.status === 'trial' ? subscription.trialEndsAt : subscription.accessEndsAt);
    if (Number.isNaN(date.getTime())) throw new Error('Invalid date');
    const formatted = new Intl.DateTimeFormat('pt-BR', {dateStyle:'long', timeStyle:'short'}).format(date);
    target.textContent = subscription.status === 'trial' ? `Período gratuito até ${formatted}.` :
      subscription.status === 'paid' ? `Assinatura ativa até ${formatted}.` : 'Seu período de acesso terminou.';
  } catch { target.textContent = 'O status da assinatura está temporariamente indisponível.'; }
}
async function loadCheckoutAvailability() {
  const notice = el('account-checkout-notice');
  for (const button of paymentButtons) button.disabled = true;
  notice.textContent = 'Pagamentos temporariamente indisponíveis.';
  try {
    const response = await fetch('/api/billing-status', {cache:'no-store'});
    if (!response.ok || (await response.json()).checkoutAvailable !== true) return;
    for (const button of paymentButtons) button.disabled = false;
    notice.textContent = 'Escolha seu plano para continuar para o checkout seguro.';
  } catch { /* Fail closed: no unchecked payments. */ }
}
async function startCheckout(plan) {
  const notice = el('account-checkout-notice');
  for (const button of paymentButtons) button.disabled = true;
  notice.textContent = 'Preparando pagamento seguro...';
  try {
    const {data, error} = await auth.getSession();
    const token = data?.session?.token;
    if (error || typeof token !== 'string' || token.split('.').length !== 3) throw new Error('Not authenticated');
    const response = await fetch('/api/checkout', {
      method:'POST', cache:'no-store',
      headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`},
      body:JSON.stringify({plan}),
    });
    if (!response.ok) throw new Error('Checkout unavailable');
    const {url:link} = await response.json();
    const url = new URL(link);
    if (url.protocol !== 'https:' ||
      !['checkout.infinitepay.io', 'checkout.infinitepay.com.br'].includes(url.hostname) ||
      url.username || url.password || url.port) throw new Error('Untrusted checkout URL');
    window.location.assign(url.href);
  } catch {
    await loadCheckoutAvailability();
    notice.textContent = 'Não foi possível iniciar o pagamento. Tente novamente mais tarde.';
  }
}
paymentButtons.forEach(button=>button.addEventListener('click',()=>startCheckout(button.dataset.plan)));
el('show-login').addEventListener('click',()=>setMode(false));
el('show-signup').addEventListener('click',()=>setMode(true));

form.addEventListener('submit', async event=>{
  event.preventDefault();
  if (signup ? !availability.registrationEnabled : !availability.loginEnabled) return;
  const button = el('account-submit');
  button.disabled = true;
  status('Validando suas informações...');
  try {
    const email = el('account-email').value.trim();
    const password = el('account-password').value;
    const name = el('account-name').value.trim();
    if (!email || password.length < 8 || password.length > 128 ||
        (signup && (name.length < 2 || name.length > 100))) throw new Error('Invalid input');
    const response = signup
      ? await auth.signUp.email({name,email,password})
      : await auth.signIn.email({email,password});
    if (response.error) throw response.error;
    el('account-password').value = '';
    if (signup) {
      status('Cadastro recebido. Verifique seu e-mail antes de acessar sua conta.');
      setMode(false);
      status('Cadastro recebido. Verifique seu e-mail antes de acessar sua conta.');
    } else {
      await refresh();
      status('Entrada realizada.');
    }
  } catch {
    status('Não foi possível concluir. Confira os dados ou tente novamente.', true);
  } finally {
    button.disabled = signup ? !availability.registrationEnabled : !availability.loginEnabled;
  }
});
el('account-recovery-form').addEventListener('submit', async event=>{
  event.preventDefault();
  if (!availability.recoveryEnabled) return;
  const button = el('recovery-submit'); button.disabled = true;
  try {
    const email = el('recovery-email').value.trim();
    if (!email || email.length > 254) throw new Error('Invalid email');
    const result = await auth.requestPasswordReset({email, redirectTo:`${window.location.origin}/redefinir-senha`});
    if (result.error) throw result.error;
    status('Se houver uma conta cadastrada, enviaremos instruções ao e-mail informado.');
  } catch {
    status('Não foi possível solicitar a recuperação agora. Tente novamente mais tarde.', true);
  } finally { button.disabled = !availability.recoveryEnabled; }
});
el('account-reset-form').addEventListener('submit', async event=>{
  event.preventDefault();
  if (!availability.recoveryEnabled || !resetToken || resetToken.length > 2048) return;
  const button = el('reset-submit');button.disabled = true;
  try {
    const password = el('reset-password').value;
    const confirm = el('reset-confirm').value;
    if (password.length < 8 || password.length > 128 || password !== confirm) throw new Error('Invalid password');
    const result = await auth.resetPassword({newPassword:password,token:resetToken});
    if (result.error) throw result.error;
    el('reset-password').value = '';el('reset-confirm').value = '';
    status('Senha redefinida. Entre novamente com sua nova senha.');
  } catch {
    status('Não foi possível redefinir a senha. Verifique o link ou solicite outro.', true);
  } finally { button.disabled = !availability.recoveryEnabled; }
});
el('account-signout').addEventListener('click',async()=>{
  try {
    const result = await auth.signOut();
    if (result.error) throw result.error;
    displaySession(null);
    setMode(false);
    status('Você saiu da conta.');
  } catch {status('Não foi possível sair. Tente novamente.',true);}
});
(async()=>{
  try {
    const response = await fetch('/api/account-availability', {cache:'no-store'});
    if (!response.ok) throw new Error('Account status unavailable');
    availability = await response.json();
    if (!availability.loginEnabled) {
      displaySession(null);
      if (isResetPage) setRecoveryMode(true);
      else if (window.location.pathname === '/recuperar-senha') setRecoveryMode(false);
      else setMode(signup);
      return;
    }
    const settings = await fetch('/api/auth-config', {cache:'no-store'});
    if (!settings.ok) throw new Error('Authentication configuration unavailable');
    const {authUrl} = await settings.json();
    auth = createAuthClient(authUrl);
    await refresh();
    if (!el('account-signed-in').hidden) { status(''); return; }
    if (isResetPage) setRecoveryMode(true);
    else if (window.location.pathname === '/recuperar-senha') setRecoveryMode(false);
    else setMode(signup);
  } catch {
    availability={loginEnabled:false,registrationEnabled:false,recoveryEnabled:false};
    displaySession(null); setMode(signup);
    status('Não foi possível carregar a área de conta agora.',true);
  }
})();
