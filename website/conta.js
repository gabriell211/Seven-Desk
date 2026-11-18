import {createAuthClient} from 'better-auth/client';
import {emailOTPClient,jwtClient} from 'better-auth/client/plugins';

const el = id => document.getElementById(id);
const form = el('account-form');
const message = el('account-message');
const paymentButtons = [...document.querySelectorAll('[data-plan]')];
const isResetPage = window.location.pathname === '/redefinir-senha';
let auth;
let signup = window.location.pathname === '/cadastro';
let verificationEmail = '';
let availability = {loginEnabled:false, registrationEnabled:false, recoveryEnabled:false};

function status(text, error = false) {
  message.textContent = text;
  message.classList.toggle('error', error);
}
function showServiceMessage(text) {
  const banner = el('account-service-message');
  banner.textContent = text;
  banner.hidden = !text;
}
function updateDocumentFields() {
  const company = el('account-type-pj').checked;
  el('account-name-label').firstChild.textContent = company ? 'Razão social' : 'Nome completo';
  el('account-name').autocomplete = company ? 'organization' : 'name';
  el('account-document-label').firstChild.textContent = company ? 'CNPJ' : 'CPF';
  el('account-document').inputMode = company ? 'text' : 'numeric';
  el('account-document').placeholder = company ? 'CNPJ (14 caracteres; aceita letras)' : 'CPF (11 dígitos)';
  el('account-document').value = '';
}
function setMode(create) {
  signup = create;
  el('account-signed-out').hidden = false;
  el('account-recovery-form').hidden = true;
  el('account-reset-form').hidden = true;
  el('account-verification-form').hidden = true;
  form.hidden = false;
  el('account-tabs').hidden = false;
  el('show-login').setAttribute('aria-pressed', String(!create));
  el('show-signup').setAttribute('aria-pressed', String(create));
  el('account-name-label').hidden = !create;
  el('account-type-section').hidden = !create;
  el('account-document-label').hidden = !create;
  el('account-document').disabled = !create;
  el('account-document').required = create;
  el('account-name').required = create;
  el('account-password').autocomplete = create ? 'new-password' : 'current-password';
  el('account-password').minLength = create ? 12 : 8;
  updateDocumentFields();
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
  el('account-verification-form').hidden = true;
  const available = availability.recoveryEnabled;
  el(reset ? 'reset-submit' : 'recovery-submit').disabled = !available;
  el('account-title').textContent = reset ? 'Redefina sua senha' : 'Recupere seu acesso';
  el('account-intro').textContent = reset
    ? 'Informe seu e-mail, o código de seis dígitos recebido e uma nova senha.'
    : 'Informe seu e-mail para solicitar um código de recuperação.';
  showServiceMessage(!available
    ? 'A recuperação de senha será ativada após a homologação do fluxo de redefinição.'
    : '');
  if (reset && !el('reset-email').value) el('reset-email').value = el('recovery-email').value.trim();
  status('');
}
function setVerificationMode(email) {
  verificationEmail = email;
  el('account-signed-out').hidden = false;
  form.hidden = true;
  el('account-tabs').hidden = true;
  el('account-recovery-form').hidden = true;
  el('account-reset-form').hidden = true;
  el('account-verification-form').hidden = false;
  el('account-title').textContent = 'Verifique seu e-mail';
  el('account-intro').textContent = 'Digite o código de 6 dígitos enviado para o endereço cadastrado. O código expira em 15 minutos.';
  showServiceMessage('');
  status('');
}

const clientViewMeta = Object.freeze({
  overview:['Visão geral','Gerencie sua conta e acompanhe seus dispositivos em um só lugar.'],
  devices:['Computadores e técnicos','Gerencie seus acessos e códigos individuais com segurança.'],
  profile:['Meu perfil','Mantenha seus dados e sua foto atualizados.'],
  billing:['Assinatura e planos','Acompanhe a validade do seu acesso e as opções de assinatura.'],
  settings:['Configurações','Controle suas preferências e informações de segurança.'],
});
let activeClientView = 'overview';
function showClientView(view, focus = false) {
  if (!Object.hasOwn(clientViewMeta,view)) return;
  activeClientView = view;
  document.querySelectorAll('[data-account-panel]').forEach(panel => {
    panel.hidden = panel.dataset.accountPanel !== view;
  });
  document.querySelectorAll('.client-nav [data-account-view]').forEach(button => {
    if (button.dataset.accountView === view) button.setAttribute('aria-current','page');
    else button.removeAttribute('aria-current');
  });
  const [title,description] = clientViewMeta[view];
  el('account-view-title').textContent = title;
  el('account-view-breadcrumb').textContent = title;
  el('account-view-description').textContent = description;
  if (focus) el('account-view-title').focus();
}
document.querySelectorAll('[data-account-view]').forEach(button => {
  button.addEventListener('click',()=>showClientView(button.dataset.accountView,true));
});

function displaySession(session) {
  const user = session?.user?.emailVerified === true ? session.user : null;
  el('account-signed-in').hidden = !user;
  el('account-signed-out').hidden = !!user;
  document.body.classList.toggle('account-authenticated',Boolean(user));
  el('account-user').textContent = user?.email || '';
  el('account-profile-name').value = user?.name || '';
  el('account-sidebar-name').textContent = user?.name?.trim() || 'Minha conta';
  el('account-sidebar-email').textContent = user?.email || '';
  el('account-sidebar-initial').textContent = (user?.name?.trim()?.[0] || user?.email?.[0] || 'S').toLocaleUpperCase('pt-BR');
  // Profile images are hosted by Seven Desk; never render arbitrary image URLs.
  let safeImage = null;
  if (typeof user?.image === 'string') {
    try {
      const url = new URL(user.image,window.location.origin);
      if (url.protocol === 'https:' && (url.origin === window.location.origin ||
          url.hostname === 'www.sevendesk.tech') && url.pathname.startsWith('/avatars/'))
        safeImage = url.href;
    } catch { /* Ignore invalid profile images. */ }
  }
  for (const id of ['account-profile-photo','account-sidebar-avatar']) {
    const image = el(id);
    image.hidden = !safeImage;
    if (safeImage) image.src = safeImage;
    else image.removeAttribute('src');
  }
  el('account-sidebar-initial').hidden = !!safeImage;
  for (const id of ['account-summary-slots','account-summary-devices','account-summary-technicians'])
    el(id).textContent = '—';
  el('account-summary-status').textContent = user ? 'Consultando...' : '—';
  el('account-summary-subscription').textContent = user ? 'Consultando período de acesso...' : '';
  showClientView(user ? activeClientView : 'overview');
  el('account-plan-actions').hidden = !user;
  el('account-app-access').hidden = true;
  el('account-app-token').value = '';
  el('account-app-token-label').hidden = true;
  el('account-app-copy').hidden = true;
  el('account-tech-code').value = '';
  el('account-tech-code-label').hidden = true;
  el('account-tech-code-copy').hidden = true;
  el('account-device-list').replaceChildren();
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
  if (data?.user?.emailVerified === true) await Promise.all([loadSubscription(), loadCheckoutAvailability(), loadAppAccess()]);
}
async function appAuthorization() {
  const {data,error}=await auth.token();
  const token=data?.token;
  if(error||typeof token!=='string'||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))
    throw new Error('Authentication required');
  return 'Bearer '+token;
}

function trustedTechnicianImage(value, slot) {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === 'https:' &&
      (url.origin === window.location.origin || url.hostname === 'www.sevendesk.tech') &&
      new RegExp('^/avatars/[0-9a-f-]{36}/technician-' + slot + '\\.(?:jpg|png|webp)
  const availabilityNotice = el('account-device-unavailable');
  availabilityNotice.hidden = false;
  availabilityNotice.textContent = 'Verificando disponibilidade dos dispositivos...';
  try {
    const response = await fetch('/api/app-token', {
      headers: {Authorization: await appAuthorization()}, cache:'no-store',
    });
    if (!response.ok) throw new Error('Device management unavailable');
    const {devices,maxSlots} = await response.json();
    if (!Array.isArray(devices)) throw new Error('Invalid devices payload');
    availabilityNotice.hidden = true;
    el('account-app-access').hidden = false;
    el('account-app-notice').textContent =
      'Cadastre o técnico e gere o código tec_ exclusivo. Depois gere o código sd2_ de ativação do computador. Um código não substitui o outro.';
    const list = el('account-device-list');
    list.replaceChildren();
    const availableSlots = Number.isInteger(maxSlots) ? Math.max(1,Math.min(maxSlots,500)) : 5;
    const bySlot = new Map(devices.filter(item => {
      const slot = Number(item?.slot);
      return Number.isInteger(slot) && slot >= 1 && slot <= availableSlots;
    }).map(item => [Number(item.slot),item]));
    const registered = [...bySlot.values()];
    const activated = registered.filter(item => item.activated === true).length;
    el('account-summary-slots').textContent = String(Math.max(0,availableSlots-activated));
    el('account-summary-devices').textContent = String(activated);
    el('account-summary-technicians').textContent = String(registered.filter(item =>
      typeof item.technician_name === 'string' && item.technician_name.trim().length > 0
    ).length);
    for (let slot = 1; slot <= availableSlots; slot++)
      list.append(createTechnicianCard(slot,bySlot.get(slot)));
  } catch {
    availabilityNotice.hidden = false;
    availabilityNotice.textContent = 'Não foi possível carregar os dispositivos. Tente novamente mais tarde.';
  }
}

function showTechnicianCode(code,slot){
  if(typeof code!=='string'||!/^tec_[A-Za-z0-9_-]{32}$/.test(code))
    throw new Error('Código do técnico inválido');
  el('account-tech-code').value=code;
  el('account-tech-code-label').hidden=true;
  el('account-tech-code-copy').hidden=true;
  showCardCode(slot,'technician',code);
  el('account-app-notice').textContent=
    `Código exclusivo do técnico ${slot}: copie e guarde agora. `
    +'Não será exibido novamente e não permite acesso remoto sozinho.';
}
async function rotateTechnicianCode(slot,button){
  button.disabled=true;
  try{
    const response=await fetch('/api/technician-code',{
      method:'POST',cache:'no-store',
      headers:{'Content-Type':'application/json',Authorization:await appAuthorization()},
      body:JSON.stringify({slot}),
    });
    if(!response.ok)throw new Error('Código indisponível');
    const result=await response.json();
    await loadAppAccess();
    showTechnicianCode(result.technicianCode,slot);
  }catch{
    el('account-app-notice').textContent='Não foi possível atualizar o código do técnico.';
  }finally{button.disabled=false;}
}

async function updateTechnicianProfile(slot, value, file, button) {
  const notice = el('account-app-notice');
  const name = value.trim();
  if (name.length < 2 || name.length > 100 ||
      (file && (file.size > 2*1024*1024 ||
        !['image/jpeg','image/png','image/webp'].includes(file.type)))) {
    notice.textContent = 'Informe o nome do técnico e uma foto válida de até 2 MB.';
    return;
  }
  button.disabled = true;
  notice.textContent = `Salvando perfil do técnico ${slot}...`;
  try {
    const headers = {Authorization: await appAuthorization()};
    const saved = await fetch('/api/technician-profile', {
      method:'POST',cache:'no-store',
      headers:{...headers,'Content-Type':'application/json'},
      body:JSON.stringify({slot,name}),
    });
    if (!saved.ok) throw new Error('Unable to save technician');
    const profile = await saved.json();
    if(profile.technicianCode)showTechnicianCode(profile.technicianCode,slot);
    if (file) {
      const uploaded = await fetch(`/api/technician-photo?slot=${slot}`, {
        method:'POST',cache:'no-store',
        headers:{...headers,'Content-Type':file.type},
        body:file,
      });
      if (!uploaded.ok) throw new Error('Unable to save technician photo');
    }
    await loadAppAccess();
    if(profile.technicianCode)showTechnicianCode(profile.technicianCode,slot);
    else notice.textContent = `Nome e foto do técnico ${slot} sincronizados com o aplicativo.`;
  } catch {
    notice.textContent = 'Não foi possível concluir o perfil. Confira os dados e tente novamente.';
  } finally {
    button.disabled = false;
  }
}

async function updateAppDevice(slot, label, revoke) {
  const notice = el('account-app-notice');
  const name = label.trim();
  if (!revoke && (name.length < 1 || name.length > 60)) {
    notice.textContent = 'Informe um nome de até 60 caracteres.';
    return;
  }
  try {
    const response = await fetch('/api/app-token', {
      method: revoke ? 'DELETE' : 'POST', cache: 'no-store',
      headers: {'Content-Type':'application/json', Authorization: await appAuthorization()},
      body: JSON.stringify({slot, label:name}),
    });
    if (!response.ok) throw new Error('Activation unavailable');
    const result = await response.json();
    if (!revoke) {
      if (typeof result.token !== 'string' || !/^sd(?:2)?_[A-Za-z0-9_-]{43}$/.test(result.token)) throw new Error('Invalid activation');
      el('account-app-token').value = result.token;
      el('account-app-token-label').hidden = true;
      el('account-app-copy').hidden = true;
    } else {
      el('account-app-token').value = '';
      el('account-app-token-label').hidden = true;
      el('account-app-copy').hidden = true;
    }
    await loadAppAccess();
    if (!revoke) showCardCode(slot,'activation',result.token);
    notice.textContent = revoke
      ? `Acesso do computador ${slot} revogado.`
      : `Código do computador ${slot}: copie agora e cole no aplicativo. Ele não será exibido novamente.`;
  } catch { notice.textContent = 'Não foi possível atualizar o computador agora.'; }
}
async function loadSubscription() {
  const target = el('account-subscription');
  const summary = el('account-summary-subscription');
  target.textContent = 'Consultando período de acesso...';
  summary.textContent = target.textContent;
  try {
    const response = await fetch('/api/subscription', {headers: {Authorization: await appAuthorization()}, cache:'no-store'});
    if (!response.ok) throw new Error('Unavailable');
    const subscription = await response.json();
    const date = new Date(subscription.status === 'trial' ? subscription.trialEndsAt : subscription.accessEndsAt);
    if (Number.isNaN(date.getTime())) throw new Error('Invalid date');
    const formatted = new Intl.DateTimeFormat('pt-BR', {dateStyle:'long', timeStyle:'short'}).format(date);
    target.textContent = subscription.status === 'trial' ? `Período gratuito até ${formatted}.` :
      subscription.status === 'paid' ? `Assinatura ativa até ${formatted}.` : 'Seu período de acesso terminou.';
    summary.textContent = target.textContent;
    el('account-summary-status').textContent = subscription.status === 'trial'
      ? 'Período grátis' : subscription.status === 'paid' ? 'Ativa' : 'Encerrada';
  } catch {
    target.textContent = 'O status da assinatura está temporariamente indisponível.';
    summary.textContent = target.textContent;
    el('account-summary-status').textContent = 'Indisponível';
  }
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
    const response = await fetch('/api/checkout', {
      method:'POST', cache:'no-store',
      headers:{'Content-Type':'application/json', Authorization:await appAuthorization()},
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
el('account-profile-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = el('account-profile-save');
  const message = el('account-profile-message');
  const name = el('account-profile-name').value.trim();
  const file = el('account-profile-file').files?.[0];
  if (name.length < 2 || name.length > 100 ||
      (file && (file.size > 2 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)))) {
    message.textContent = 'Informe um nome válido e uma foto JPG, PNG ou WebP de até 2 MB.';
    return;
  }
  button.disabled = true;
  message.textContent = 'Salvando seu perfil...';
  try {
    let image;
    if (file) {
      const response = await fetch('/api/avatar-upload', {
        method:'POST', cache:'no-store',
        headers:{'Content-Type':file.type, Authorization:await appAuthorization()},
        body:file,
      });
      if (!response.ok) throw new Error('Upload unavailable');
      image = (await response.json()).url;
      if (typeof image !== 'string' || !image.startsWith('https://www.sevendesk.tech/avatars/')) throw new Error('Invalid image URL');
    }
    const result = await auth.updateUser(image ? {name, image} : {name});
    if (result.error) throw result.error;
    el('account-profile-file').value = '';
    await refresh();
    message.textContent = 'Perfil salvo. Nome e foto serão sincronizados no aplicativo.';
  } catch { message.textContent = 'Não foi possível salvar seu perfil agora.'; }
  finally { button.disabled = false; }
});
el('account-tech-code-copy').addEventListener('click',async()=>{
  const input=el('account-tech-code');
  input.select();
  try{
    await navigator.clipboard.writeText(input.value);
    el('account-app-notice').textContent='Código do técnico copiado com segurança.';
  }catch{
    el('account-app-notice').textContent='Selecione e copie o código do técnico.';
  }
});
el('account-app-copy').addEventListener('click', async()=>{
  const field=el('account-app-token');
  field.select();
  try {
    await navigator.clipboard.writeText(field.value);
    el('account-app-notice').textContent='Código copiado. Cole no aplicativo Seven Desk.';
  } catch {el('account-app-notice').textContent='Selecione e copie o código mostrado acima.';}
});
el('account-type-pf').addEventListener('change',updateDocumentFields);
el('account-type-pj').addEventListener('change',updateDocumentFields);
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
    if (!email || password.length < (signup ? 12 : 8) || password.length > 128 ||
        (signup && (name.length < 2 || name.length > 100))) throw new Error('Invalid input');
    const response = signup
      ? await (async()=>{
          const accountType=el('account-type-pj').checked ? 'PJ' : 'PF';
          const document=el('account-document').value.trim();
          if (!document || document.length > 24) throw new Error('Invalid document');
          const created=await fetch('/api/registration',{
            method:'POST',cache:'no-store',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({name,email,password,accountType,document}),
          });
          const body=await created.json();
          if(!created.ok)return {error:{code:body.code||'REGISTRATION_ERROR'}};
          return {data:body};
        })()
      : await auth.signIn.email({email,password});
    if (response.error) {
      const code = String(response.error.code || '').toUpperCase();
      if (!signup && (code === 'EMAIL_NOT_VERIFIED' || code === 'EMAIL_VERIFICATION_REQUIRED')) {
        el('account-password').value = '';
        setVerificationMode(email);
        status('Confirme o e-mail da sua conta. Digite o código recebido ou solicite um novo.');
        return;
      }
      throw response.error;
    }
    el('account-password').value = '';
    if (signup) {
      el('account-document').value = '';
      if (response.data?.user?.emailVerified !== true) {
        setVerificationMode(email);
        status('Cadastro recebido. Informe o código enviado ao seu e-mail.');
      } else {
        setMode(false);
        status('Cadastro recebido. Entre com suas credenciais.');
      }
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
el('account-verification-form').addEventListener('submit', async event=>{
  event.preventDefault();
  const code = el('verification-code').value.trim();
  if (!/^[0-9]{6}$/.test(code) || !verificationEmail || !availability.registrationEnabled) {
    status('Informe um código válido de seis dígitos.', true);
    return;
  }
  const button = el('verify-email-submit');
  button.disabled = true;
  try {
    const {error} = await auth.emailOtp.verifyEmail({email:verificationEmail, otp:code});
    if (error) throw error;
    el('verification-code').value = '';
    const session = await auth.getSession();
    if (session.data?.user?.emailVerified === true) {
      await refresh();
      status('E-mail confirmado com sucesso.');
    } else {
      setMode(false);
      status('E-mail confirmado. Entre em sua conta.');
    }
  } catch {
    status('Código incorreto ou expirado. Solicite outro e tente novamente.', true);
  } finally {button.disabled=false;}
});
el('verification-resend').addEventListener('click', async ()=>{
  if (!verificationEmail || !availability.registrationEnabled) return;
  const button=el('verification-resend');button.disabled=true;
  try {
    const {error} = await auth.emailOtp.sendVerificationOtp({email:verificationEmail, type:'email-verification'});
    if (error) throw error;
    status('Novo código solicitado. Confira seu e-mail.');
  } catch {
    status('Não foi possível reenviar o código. Tente novamente mais tarde.',true);
  } finally {button.disabled=false;}
});

el('account-recovery-form').addEventListener('submit', async event=>{
  event.preventDefault();
  if (!availability.recoveryEnabled) return;
  const button = el('recovery-submit'); button.disabled = true;
  const email = el('recovery-email').value.trim();
  if (!email || email.length > 254 || !el('recovery-email').checkValidity()) {
    status('Informe um e-mail válido.', true);
    button.disabled = false;
    return;
  }
  try {
    const {error} = await auth.emailOtp.requestPasswordReset({email});
    if (error) throw error;
    el('reset-email').value = email;
    setRecoveryMode(true);
    status('Se houver uma conta, o código de recuperação será enviado para o e-mail informado.');
  } catch {
    status('Não foi possível solicitar o código agora. Tente novamente mais tarde.', true);
  } finally { button.disabled = !availability.recoveryEnabled; }
});
el('account-reset-form').addEventListener('submit', async event=>{
  event.preventDefault();
  if (!availability.recoveryEnabled) return;
  const button = el('reset-submit'); button.disabled = true;
  try {
    const email = el('reset-email').value.trim();
    const otp = el('reset-code').value.trim();
    const password = el('reset-password').value;
    const confirm = el('reset-confirm').value;
    if (!el('reset-email').checkValidity() || !/^[0-9]{6}$/.test(otp) ||
        password.length < 8 || password.length > 128 || password !== confirm) {
      throw new Error('Invalid recovery inputs');
    }
    const {error} = await auth.emailOtp.resetPassword({email,otp,password});
    if (error) throw error;
    el('reset-code').value = '';
    el('reset-password').value = '';
    el('reset-confirm').value = '';
    setMode(false);
    status('Senha redefinida. Entre com sua nova senha.');
  } catch {
    status('Não foi possível redefinir a senha. Confira o código e a nova senha ou solicite outro.', true);
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
    if(new URL(authUrl).origin!==window.location.origin)throw new Error('Invalid auth origin');
    auth=createAuthClient({baseURL:window.location.origin,basePath:'/api/auth',plugins:[emailOTPClient(),jwtClient()]});
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
).test(url.pathname)
      ? url.href : '';
  } catch { return ''; }
}

function createTechnicianCard(slot, device) {
  const card = document.createElement('article');
  card.className = 'technician-card';
  card.dataset.technicianSlot = String(slot);
  card.setAttribute('aria-label', 'Técnico e computador ' + slot);
  // Static markup only; all remote profile data is assigned as text or input values.
  card.innerHTML = [
    '<header class="technician-card-header">',
    '<div class="technician-card-avatar"><span class="technician-card-initials" aria-hidden="true">T</span><img class="technician-card-photo" alt="Foto do técnico no atendimento" width="72" height="72" hidden></div>',
    '<div class="technician-card-identity"><small class="technician-card-kicker"></small><h3></h3><p></p></div>',
    '<span class="technician-card-badge"></span></header>',
    '<div class="technician-card-fields">',
    '<label>Nome exibido ao cliente<input data-tech-name maxlength="100" minlength="2" autocomplete="off" placeholder="Nome do técnico"></label>',
    '<label>Nome do computador<input data-device-name maxlength="60" autocomplete="off" placeholder="Ex.: Notebook do suporte"></label>',
    '<label class="technician-card-upload">Foto/avatar do técnico<input type="file" accept="image/jpeg,image/png,image/webp"><small>JPG, PNG ou WebP até 2 MB · exibida nas solicitações de acesso</small></label>',
    '</div>',
    '<p class="technician-card-description"></p>',
    '<div class="technician-card-actions">',
    '<button type="button" class="technician-card-primary" data-card-save></button>',
    '<button type="button" data-card-tech-code hidden></button>',
    '<button type="button" data-card-activation></button>',
    '<button type="button" data-card-revoke hidden></button>',
    '</div><div class="technician-card-credential" role="status" hidden></div>'
  ].join('');
  const find = selector => card.querySelector(selector);
  const nameInput = find('[data-tech-name]');
  const deviceInput = find('[data-device-name]');
  const photoInput = find('input[type=file]');
  const photo = find('.technician-card-photo');
  const initials = find('.technician-card-initials');
  const title = find('.technician-card-identity h3');
  const subtitle = find('.technician-card-identity p');
  const badge = find('.technician-card-badge');
  const savedName = typeof device?.technician_name === 'string' ? device.technician_name : '';
  nameInput.value = savedName;
  deviceInput.value = device?.label || (slot === 1 ? 'Meu computador' : 'Computador ' + slot);
  find('.technician-card-kicker').textContent = 'VAGA ' + String(slot).padStart(2,'0');
  badge.dataset.status = device?.activated ? 'activated' : savedName ? 'registered' : 'available';
  badge.textContent = device?.activated ? 'Código emitido' : savedName ? 'Cadastrado' : 'Vaga livre';
  find('.technician-card-description').textContent = device?.has_technician_code
    ? 'Código do técnico configurado. Para visualizá-lo novamente, gere outro código.'
    : 'O código tec_ identifica o técnico; o código sd2_ ativa o computador.';
  let localPhotoUrl = '';
  const remotePhotoUrl = trustedTechnicianImage(device?.technician_image,slot);
  function setPhoto(url) {
    if (localPhotoUrl) URL.revokeObjectURL(localPhotoUrl);
    localPhotoUrl = url.startsWith('blob:') ? url : '';
    photo.hidden = !url;
    initials.hidden = !!url;
    photo.onerror = () => { photo.hidden = true; initials.hidden = false; };
    photo.onload = () => { if (localPhotoUrl) URL.revokeObjectURL(localPhotoUrl); localPhotoUrl=''; };
    if (url) photo.src = url;
    else photo.removeAttribute('src');
  }
  function syncIdentity() {
    const name = nameInput.value.trim();
    title.textContent = name || 'Adicionar técnico';
    subtitle.textContent = deviceInput.value.trim() || 'Computador ' + slot;
    const words = name.split(/\s+/).filter(Boolean);
    initials.textContent = (words.length > 1 ? words[0][0] + words.at(-1)[0] :
      words[0]?.slice(0,2) || 'T').toLocaleUpperCase('pt-BR');
  }
  syncIdentity();
  setPhoto(remotePhotoUrl);
  nameInput.addEventListener('input',syncIdentity);
  deviceInput.addEventListener('input',syncIdentity);
  photoInput.addEventListener('change', () => {
    const file = photoInput.files?.[0];
    if (!file) { setPhoto(remotePhotoUrl); return; }
    if (file.size < 1 || file.size > 2 * 1024 * 1024 ||
        !['image/jpeg','image/png','image/webp'].includes(file.type)) {
      photoInput.value = '';
      el('account-app-notice').textContent = 'Selecione uma foto JPG, PNG ou WebP de até 2 MB.';
      setPhoto(remotePhotoUrl);
      return;
    }
    setPhoto(URL.createObjectURL(file));
  });
  const save = find('[data-card-save]');
  save.textContent = savedName ? 'Salvar alterações' : 'Cadastrar técnico';
  save.addEventListener('click', () => updateTechnicianProfile(slot,nameInput.value,photoInput.files?.[0],save));
  const techCode = find('[data-card-tech-code]');
  techCode.hidden = !savedName;
  techCode.textContent = device?.has_technician_code ? 'Trocar código tec_' : 'Gerar código tec_';
  techCode.addEventListener('click', () => rotateTechnicianCode(slot,techCode));
  const activation = find('[data-card-activation]');
  activation.textContent = device?.activated ? 'Trocar ativação sd2_' : 'Gerar ativação sd2_';
  activation.addEventListener('click', () => updateAppDevice(slot,deviceInput.value,false));
  const revoke = find('[data-card-revoke]');
  revoke.hidden = !device?.activated;
  revoke.textContent = 'Revogar ativação';
  revoke.addEventListener('click', () => updateAppDevice(slot,'',true));
  return card;
}

function showCardCode(slot, kind, code) {
  const card = [...el('account-device-list').querySelectorAll('[data-technician-slot]')]
    .find(item => item.dataset.technicianSlot === String(slot));
  if (!card) return;
  const target = card.querySelector('.technician-card-credential');
  const label = document.createElement('label');
  label.textContent = kind === 'technician' ? 'Código do técnico (tec_)' : 'Ativação do computador (sd2_)';
  const input = document.createElement('input');
  input.type = 'text';
  input.readOnly = true;
  input.value = code;
  input.setAttribute('aria-label',label.textContent);
  input.autocomplete = 'off';
  label.append(input);
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.textContent = 'Copiar código';
  copy.addEventListener('click', async () => {
    input.select();
    try {
      await navigator.clipboard.writeText(input.value);
      el('account-app-notice').textContent = 'Código copiado.';
    } catch { el('account-app-notice').textContent = 'Selecione o código para copiar manualmente.'; }
  });
  const hint = document.createElement('small');
  hint.textContent = 'Guarde agora. Por segurança, este código não será exibido novamente.';
  target.replaceChildren(label, copy, hint);
  target.hidden = false;
}

async function loadAppAccess() {
  const availabilityNotice = el('account-device-unavailable');
  availabilityNotice.hidden = false;
  availabilityNotice.textContent = 'Verificando disponibilidade dos dispositivos...';
  try {
    const response = await fetch('/api/app-token', {
      headers: {Authorization: await appAuthorization()}, cache:'no-store',
    });
    if (!response.ok) throw new Error('Device management unavailable');
    const {devices,maxSlots} = await response.json();
    if (!Array.isArray(devices)) throw new Error('Invalid devices payload');
    availabilityNotice.hidden = true;
    el('account-app-access').hidden = false;
    el('account-app-notice').textContent =
      'Cadastre o técnico e gere o código tec_ exclusivo. Depois gere o código sd2_ de ativação do computador. Um código não substitui o outro.';
    const list = el('account-device-list');
    list.replaceChildren();
    const availableSlots = Number.isInteger(maxSlots) ? Math.max(1,Math.min(maxSlots,500)) : 5;
    const bySlot = new Map(devices.filter(item => {
      const slot = Number(item?.slot);
      return Number.isInteger(slot) && slot >= 1 && slot <= availableSlots;
    }).map(item => [Number(item.slot),item]));
    const registered = [...bySlot.values()];
    const activated = registered.filter(item => item.activated === true).length;
    el('account-summary-slots').textContent = String(Math.max(0,availableSlots-activated));
    el('account-summary-devices').textContent = String(activated);
    el('account-summary-technicians').textContent = String(registered.filter(item =>
      typeof item.technician_name === 'string' && item.technician_name.trim().length > 0
    ).length);
    for (let slot = 1; slot <= availableSlots; slot++) {
      const device = bySlot.get(slot);
      const row = document.createElement('section');
      row.className = 'account-device-row';
      row.setAttribute('aria-label', `Técnico e computador ${slot}`);
      const label = document.createElement('label');
      label.textContent = `Computador ${slot}`;
      const input = document.createElement('input');
      input.maxLength = 60;
      input.value = device?.label || (slot === 1 ? 'Meu computador' : `Computador ${slot}`);
      label.append(input);
      row.append(label);
      {
        const techLabel = document.createElement('label');
        techLabel.textContent = 'Nome do técnico';
        const techInput = document.createElement('input');
        techInput.maxLength = 100;
        techInput.minLength = 2;
        techInput.autocomplete = 'off';
        techInput.placeholder = 'Nome exibido no Seven Desk';
        techInput.value = device?.technician_name || '';
        techLabel.append(techInput);
        row.append(techLabel);

        const imageUrl = device?.technician_image;
        if (typeof imageUrl === 'string' &&
            imageUrl.startsWith('https://www.sevendesk.tech/avatars/')) {
          const photo = document.createElement('img');
          photo.src = imageUrl;
          photo.alt = `Foto do técnico ${slot}`;
          photo.width = 64;
          photo.height = 64;
          photo.className = 'technician-preview';
          row.append(photo);
        }
        const photoLabel = document.createElement('label');
        photoLabel.textContent = 'Foto deste técnico (JPG, PNG ou WebP, até 2 MB)';
        const photoInput = document.createElement('input');
        photoInput.type = 'file';
        photoInput.accept = 'image/jpeg,image/png,image/webp';
        photoLabel.append(photoInput);
        row.append(photoLabel);
        const save = document.createElement('button');
        save.type = 'button';
        save.className = 'account-signout';
        save.textContent = device?.technician_name ? 'Atualizar técnico' : 'Cadastrar técnico e gerar código';
        save.addEventListener('click', () =>
          updateTechnicianProfile(slot,techInput.value,photoInput.files?.[0],save));
        row.append(save);
        if (device?.technician_name) {
          const notice=document.createElement('small');
          notice.className='technician-code-status';
          notice.textContent=device.has_technician_code
            ? 'Código exclusivo do técnico criado.'
            : 'Gere o código exclusivo do técnico.';
          row.append(notice);
          const rotate=document.createElement('button');
          rotate.type='button';
          rotate.className='account-signout';
          rotate.textContent=device.has_technician_code
            ? 'Trocar código do técnico' : 'Gerar código do técnico';
          rotate.addEventListener('click',()=>rotateTechnicianCode(slot,rotate));
          row.append(rotate);
        }
      }
      const generate = document.createElement('button');
      generate.type = 'button';
      generate.className = 'account-signout';
      generate.textContent = device?.activated ? 'Trocar código de ativação' : 'Gerar código de ativação';
      generate.addEventListener('click', () => updateAppDevice(slot,input.value,false));
      row.append(generate);
      if (device?.activated) {
        const revoke = document.createElement('button');
        revoke.type = 'button';
        revoke.className = 'account-signout';
        revoke.textContent = 'Revogar dispositivo';
        revoke.addEventListener('click', () => updateAppDevice(slot,'',true));
        row.append(revoke);
      }
      list.append(row);
    }
  } catch {
    availabilityNotice.hidden = false;
    availabilityNotice.textContent = 'Não foi possível carregar os dispositivos. Tente novamente mais tarde.';
  }
}

function showTechnicianCode(code,slot){
  if(typeof code!=='string'||!/^tec_[A-Za-z0-9_-]{32}$/.test(code))
    throw new Error('Código do técnico inválido');
  el('account-tech-code').value=code;
  el('account-tech-code-label').hidden=false;
  el('account-tech-code-copy').hidden=false;
  el('account-app-notice').textContent=
    `Código exclusivo do técnico ${slot}: copie e guarde agora. `
    +'Não será exibido novamente e não permite acesso remoto sozinho.';
}
async function rotateTechnicianCode(slot,button){
  button.disabled=true;
  try{
    const response=await fetch('/api/technician-code',{
      method:'POST',cache:'no-store',
      headers:{'Content-Type':'application/json',Authorization:await appAuthorization()},
      body:JSON.stringify({slot}),
    });
    if(!response.ok)throw new Error('Código indisponível');
    const result=await response.json();
    await loadAppAccess();
    showTechnicianCode(result.technicianCode,slot);
  }catch{
    el('account-app-notice').textContent='Não foi possível atualizar o código do técnico.';
  }finally{button.disabled=false;}
}

async function updateTechnicianProfile(slot, value, file, button) {
  const notice = el('account-app-notice');
  const name = value.trim();
  if (name.length < 2 || name.length > 100 ||
      (file && (file.size > 2*1024*1024 ||
        !['image/jpeg','image/png','image/webp'].includes(file.type)))) {
    notice.textContent = 'Informe o nome do técnico e uma foto válida de até 2 MB.';
    return;
  }
  button.disabled = true;
  notice.textContent = `Salvando perfil do técnico ${slot}...`;
  try {
    const headers = {Authorization: await appAuthorization()};
    const saved = await fetch('/api/technician-profile', {
      method:'POST',cache:'no-store',
      headers:{...headers,'Content-Type':'application/json'},
      body:JSON.stringify({slot,name}),
    });
    if (!saved.ok) throw new Error('Unable to save technician');
    const profile = await saved.json();
    if(profile.technicianCode)showTechnicianCode(profile.technicianCode,slot);
    if (file) {
      const uploaded = await fetch(`/api/technician-photo?slot=${slot}`, {
        method:'POST',cache:'no-store',
        headers:{...headers,'Content-Type':file.type},
        body:file,
      });
      if (!uploaded.ok) throw new Error('Unable to save technician photo');
    }
    await loadAppAccess();
    if(profile.technicianCode)showTechnicianCode(profile.technicianCode,slot);
    else notice.textContent = `Nome e foto do técnico ${slot} sincronizados com o aplicativo.`;
  } catch {
    notice.textContent = 'Não foi possível concluir o perfil. Confira os dados e tente novamente.';
  } finally {
    button.disabled = false;
  }
}

async function updateAppDevice(slot, label, revoke) {
  const notice = el('account-app-notice');
  const name = label.trim();
  if (!revoke && (name.length < 1 || name.length > 60)) {
    notice.textContent = 'Informe um nome de até 60 caracteres.';
    return;
  }
  try {
    const response = await fetch('/api/app-token', {
      method: revoke ? 'DELETE' : 'POST', cache: 'no-store',
      headers: {'Content-Type':'application/json', Authorization: await appAuthorization()},
      body: JSON.stringify({slot, label:name}),
    });
    if (!response.ok) throw new Error('Activation unavailable');
    const result = await response.json();
    if (!revoke) {
      if (typeof result.token !== 'string' || !/^sd(?:2)?_[A-Za-z0-9_-]{43}$/.test(result.token)) throw new Error('Invalid activation');
      el('account-app-token').value = result.token;
      el('account-app-token-label').hidden = false;
      el('account-app-copy').hidden = false;
    } else {
      el('account-app-token').value = '';
      el('account-app-token-label').hidden = true;
      el('account-app-copy').hidden = true;
    }
    await loadAppAccess();
    notice.textContent = revoke
      ? `Acesso do computador ${slot} revogado.`
      : `Código do computador ${slot}: copie agora e cole no aplicativo. Ele não será exibido novamente.`;
  } catch { notice.textContent = 'Não foi possível atualizar o computador agora.'; }
}
async function loadSubscription() {
  const target = el('account-subscription');
  const summary = el('account-summary-subscription');
  target.textContent = 'Consultando período de acesso...';
  summary.textContent = target.textContent;
  try {
    const response = await fetch('/api/subscription', {headers: {Authorization: await appAuthorization()}, cache:'no-store'});
    if (!response.ok) throw new Error('Unavailable');
    const subscription = await response.json();
    const date = new Date(subscription.status === 'trial' ? subscription.trialEndsAt : subscription.accessEndsAt);
    if (Number.isNaN(date.getTime())) throw new Error('Invalid date');
    const formatted = new Intl.DateTimeFormat('pt-BR', {dateStyle:'long', timeStyle:'short'}).format(date);
    target.textContent = subscription.status === 'trial' ? `Período gratuito até ${formatted}.` :
      subscription.status === 'paid' ? `Assinatura ativa até ${formatted}.` : 'Seu período de acesso terminou.';
    summary.textContent = target.textContent;
    el('account-summary-status').textContent = subscription.status === 'trial'
      ? 'Período grátis' : subscription.status === 'paid' ? 'Ativa' : 'Encerrada';
  } catch {
    target.textContent = 'O status da assinatura está temporariamente indisponível.';
    summary.textContent = target.textContent;
    el('account-summary-status').textContent = 'Indisponível';
  }
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
    const response = await fetch('/api/checkout', {
      method:'POST', cache:'no-store',
      headers:{'Content-Type':'application/json', Authorization:await appAuthorization()},
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
el('account-profile-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = el('account-profile-save');
  const message = el('account-profile-message');
  const name = el('account-profile-name').value.trim();
  const file = el('account-profile-file').files?.[0];
  if (name.length < 2 || name.length > 100 ||
      (file && (file.size > 2 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)))) {
    message.textContent = 'Informe um nome válido e uma foto JPG, PNG ou WebP de até 2 MB.';
    return;
  }
  button.disabled = true;
  message.textContent = 'Salvando seu perfil...';
  try {
    let image;
    if (file) {
      const response = await fetch('/api/avatar-upload', {
        method:'POST', cache:'no-store',
        headers:{'Content-Type':file.type, Authorization:await appAuthorization()},
        body:file,
      });
      if (!response.ok) throw new Error('Upload unavailable');
      image = (await response.json()).url;
      if (typeof image !== 'string' || !image.startsWith('https://www.sevendesk.tech/avatars/')) throw new Error('Invalid image URL');
    }
    const result = await auth.updateUser(image ? {name, image} : {name});
    if (result.error) throw result.error;
    el('account-profile-file').value = '';
    await refresh();
    message.textContent = 'Perfil salvo. Nome e foto serão sincronizados no aplicativo.';
  } catch { message.textContent = 'Não foi possível salvar seu perfil agora.'; }
  finally { button.disabled = false; }
});
el('account-tech-code-copy').addEventListener('click',async()=>{
  const input=el('account-tech-code');
  input.select();
  try{
    await navigator.clipboard.writeText(input.value);
    el('account-app-notice').textContent='Código do técnico copiado com segurança.';
  }catch{
    el('account-app-notice').textContent='Selecione e copie o código do técnico.';
  }
});
el('account-app-copy').addEventListener('click', async()=>{
  const field=el('account-app-token');
  field.select();
  try {
    await navigator.clipboard.writeText(field.value);
    el('account-app-notice').textContent='Código copiado. Cole no aplicativo Seven Desk.';
  } catch {el('account-app-notice').textContent='Selecione e copie o código mostrado acima.';}
});
el('account-type-pf').addEventListener('change',updateDocumentFields);
el('account-type-pj').addEventListener('change',updateDocumentFields);
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
    if (!email || password.length < (signup ? 12 : 8) || password.length > 128 ||
        (signup && (name.length < 2 || name.length > 100))) throw new Error('Invalid input');
    const response = signup
      ? await (async()=>{
          const accountType=el('account-type-pj').checked ? 'PJ' : 'PF';
          const document=el('account-document').value.trim();
          if (!document || document.length > 24) throw new Error('Invalid document');
          const created=await fetch('/api/registration',{
            method:'POST',cache:'no-store',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({name,email,password,accountType,document}),
          });
          const body=await created.json();
          if(!created.ok)return {error:{code:body.code||'REGISTRATION_ERROR'}};
          return {data:body};
        })()
      : await auth.signIn.email({email,password});
    if (response.error) {
      const code = String(response.error.code || '').toUpperCase();
      if (!signup && (code === 'EMAIL_NOT_VERIFIED' || code === 'EMAIL_VERIFICATION_REQUIRED')) {
        el('account-password').value = '';
        setVerificationMode(email);
        status('Confirme o e-mail da sua conta. Digite o código recebido ou solicite um novo.');
        return;
      }
      throw response.error;
    }
    el('account-password').value = '';
    if (signup) {
      el('account-document').value = '';
      if (response.data?.user?.emailVerified !== true) {
        setVerificationMode(email);
        status('Cadastro recebido. Informe o código enviado ao seu e-mail.');
      } else {
        setMode(false);
        status('Cadastro recebido. Entre com suas credenciais.');
      }
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
el('account-verification-form').addEventListener('submit', async event=>{
  event.preventDefault();
  const code = el('verification-code').value.trim();
  if (!/^[0-9]{6}$/.test(code) || !verificationEmail || !availability.registrationEnabled) {
    status('Informe um código válido de seis dígitos.', true);
    return;
  }
  const button = el('verify-email-submit');
  button.disabled = true;
  try {
    const {error} = await auth.emailOtp.verifyEmail({email:verificationEmail, otp:code});
    if (error) throw error;
    el('verification-code').value = '';
    const session = await auth.getSession();
    if (session.data?.user?.emailVerified === true) {
      await refresh();
      status('E-mail confirmado com sucesso.');
    } else {
      setMode(false);
      status('E-mail confirmado. Entre em sua conta.');
    }
  } catch {
    status('Código incorreto ou expirado. Solicite outro e tente novamente.', true);
  } finally {button.disabled=false;}
});
el('verification-resend').addEventListener('click', async ()=>{
  if (!verificationEmail || !availability.registrationEnabled) return;
  const button=el('verification-resend');button.disabled=true;
  try {
    const {error} = await auth.emailOtp.sendVerificationOtp({email:verificationEmail, type:'email-verification'});
    if (error) throw error;
    status('Novo código solicitado. Confira seu e-mail.');
  } catch {
    status('Não foi possível reenviar o código. Tente novamente mais tarde.',true);
  } finally {button.disabled=false;}
});

el('account-recovery-form').addEventListener('submit', async event=>{
  event.preventDefault();
  if (!availability.recoveryEnabled) return;
  const button = el('recovery-submit'); button.disabled = true;
  const email = el('recovery-email').value.trim();
  if (!email || email.length > 254 || !el('recovery-email').checkValidity()) {
    status('Informe um e-mail válido.', true);
    button.disabled = false;
    return;
  }
  try {
    const {error} = await auth.emailOtp.requestPasswordReset({email});
    if (error) throw error;
    el('reset-email').value = email;
    setRecoveryMode(true);
    status('Se houver uma conta, o código de recuperação será enviado para o e-mail informado.');
  } catch {
    status('Não foi possível solicitar o código agora. Tente novamente mais tarde.', true);
  } finally { button.disabled = !availability.recoveryEnabled; }
});
el('account-reset-form').addEventListener('submit', async event=>{
  event.preventDefault();
  if (!availability.recoveryEnabled) return;
  const button = el('reset-submit'); button.disabled = true;
  try {
    const email = el('reset-email').value.trim();
    const otp = el('reset-code').value.trim();
    const password = el('reset-password').value;
    const confirm = el('reset-confirm').value;
    if (!el('reset-email').checkValidity() || !/^[0-9]{6}$/.test(otp) ||
        password.length < 8 || password.length > 128 || password !== confirm) {
      throw new Error('Invalid recovery inputs');
    }
    const {error} = await auth.emailOtp.resetPassword({email,otp,password});
    if (error) throw error;
    el('reset-code').value = '';
    el('reset-password').value = '';
    el('reset-confirm').value = '';
    setMode(false);
    status('Senha redefinida. Entre com sua nova senha.');
  } catch {
    status('Não foi possível redefinir a senha. Confira o código e a nova senha ou solicite outro.', true);
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
    if(new URL(authUrl).origin!==window.location.origin)throw new Error('Invalid auth origin');
    auth=createAuthClient({baseURL:window.location.origin,basePath:'/api/auth',plugins:[emailOTPClient(),jwtClient()]});
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
