import {createAuthClient} from 'better-auth/client';
import {emailOTPClient,jwtClient} from 'better-auth/client/plugins';
import {presentSubscription} from './subscription-presentation.mjs';

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
  devices:['Computadores e técnicos','Cadastre os técnicos e edite os dados exibidos nos atendimentos.'],
  profile:['Meu perfil','Mantenha seus dados e sua foto atualizados.'],
  billing:['Assinatura e planos','Acompanhe a validade do seu acesso e as opções de assinatura.'],
  settings:['Configurações','Controle suas preferências e informações de segurança.'],
});
// Codes are kept in memory only for the currently authenticated account.
const revealedCodePairs = new Map();
let revealedOwner = null;
let appAccessRequest = 0;
let accountSession = 0;
let teamRequest = 0;
const activationUpdatesInFlight = new Set();

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
  const owner = user ? (typeof user.id === 'string' ? user.id : user.email) : null;
  if (revealedOwner !== owner) {
    revealedOwner = owner;
    accountSession++;
    appAccessRequest++;
    revealedCodePairs.clear();
    teamRequest++;
    el('account-team-workspace').hidden=true;
    el('account-team-list').replaceChildren();
    el('account-team-notice').textContent='';
    el('account-team-accept').reset();
    el('account-app-notice').textContent = '';
    activationUpdatesInFlight.clear();
    el('account-activation-notice').textContent = '';
  }
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
  resetSubscriptionDetails();
  if (!user) { el('account-subscription').textContent = ''; el('account-subscription-title').textContent = ''; }
  el('account-app-access').hidden = true;
  el('account-activation-list').replaceChildren();
  el('account-activation-unavailable').hidden = !user;
  el('account-activation-unavailable').textContent = 'Verificando disponibilidade dos computadores...';
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
  if (data?.user?.emailVerified === true) await Promise.all([loadSubscription(), loadCheckoutAvailability(), loadAppAccess(), loadTeamWorkspaces()]);
}
async function appAuthorization() {
  const {data,error}=await auth.token();
  const token=data?.token;
  if(error||typeof token!=='string'||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))
    throw new Error('Authentication required');
  return 'Bearer '+token;
}

async function teamApi(method='GET',body,session=accountSession){
  const authorization=await appAuthorization();
  if(session!==accountSession)throw new Error('Session changed');
  const response=await fetch('/api/team-workspaces',{
    method,cache:'no-store',headers:{Authorization:authorization,'Content-Type':'application/json'},
    ...(body?{body:JSON.stringify(body)}:{}),
  });
  if(!response.ok)throw new Error('Team request unavailable');
  return response.json();
}
function teamElement(tag,text){
  const node=document.createElement(tag);
  node.textContent=text;
  return node;
}
async function loadTeamWorkspaces(){
  const session=accountSession,request=++teamRequest;
  const target=el('account-team-workspace'),list=el('account-team-list');
  try{
    const data=await teamApi('GET',undefined,session);
    if(session!==accountSession||request!==teamRequest)return;
    if(!Array.isArray(data.teams))throw new Error('Invalid teams');
    list.replaceChildren();
    target.hidden=false;
    if(!data.teams.length)list.append(teamElement('p','Nenhuma equipe vinculada.'));
    for(const team of data.teams){
      const card=document.createElement('article');
      card.className='client-surface';
      card.append(teamElement('h3',team.plan==='business'?'Business':'Enterprise'),
        teamElement('p','ID: '+team.id),
        teamElement('p',team.isOwner?'Administrador · '+team.seatLimit+' vagas':'Técnico integrante'));
      if(data.activationAvailable===true&&Number.isInteger(team.ownSeat)){
        const activate=teamElement('button','Gerar chave de ativação');
        activate.type='button';activate.className='account-submit';
        activate.addEventListener('click',async()=>{
          if(!window.confirm('Gerar uma nova chave revoga a ativação anterior desta vaga. Continuar?'))return;
          activate.disabled=true;
          try{
            const pair=await teamApi('POST',{action:'activate',teamId:team.id},session);
            if(session===accountSession)el('account-team-notice').textContent='Chave de ativação: '+pair.token+' · Guarde-a em privado. Não será exibida novamente.';
          }catch{if(session===accountSession)el('account-team-notice').textContent='Não foi possível gerar a chave da equipe.';}
          finally{activate.disabled=false;}
        });
        card.append(activate);
      }
      if(team.isOwner){
        for(const technician of team.technicians){
          const row=document.createElement('p');
          row.append(teamElement('span',technician.email+' — '+(technician.accepted?'Ativo':'Convite pendente')+' '));
          const revoke=teamElement('button','Revogar');
          revoke.type='button';revoke.className='client-text-action';
          revoke.addEventListener('click',async()=>{
            if(!window.confirm('Revogar esta vaga?'))return;
            revoke.disabled=true;
            try{
              await teamApi('DELETE',{teamId:team.id,seat:technician.seat},session);
              if(session===accountSession){await loadTeamWorkspaces();el('account-team-notice').textContent='Vaga revogada.';}
            }catch{if(session===accountSession)el('account-team-notice').textContent='Não foi possível revogar a vaga.';}
            finally{revoke.disabled=false;}
          });
          row.append(revoke);card.append(row);
        }
        const form=document.createElement('form');
        const label=teamElement('label','E-mail do técnico ');
        const email=document.createElement('input');
        email.type='email';email.required=true;email.maxLength=254;
        label.append(email);
        const button=teamElement('button','Gerar convite');
        button.type='submit';button.className='account-submit';
        form.append(label,button);
        form.addEventListener('submit',async event=>{
          event.preventDefault();button.disabled=true;
          try{
            const invitation=await teamApi('POST',{action:'invite',teamId:team.id,email:email.value},session);
            if(session!==accountSession)return;
            await loadTeamWorkspaces();
            if(session===accountSession)el('account-team-notice').textContent='Compartilhe em privado com o técnico: equipe '+team.id+' · código '+invitation.token+'. O código é exibido apenas agora.';
          }catch{if(session===accountSession)el('account-team-notice').textContent='Não foi possível gerar o convite. Confira as vagas e a validade da equipe.';}
          finally{button.disabled=false;}
        });
        card.append(form);
      }
      list.append(card);
    }
  }catch{
    if(session===accountSession&&request===teamRequest){target.hidden=true;list.replaceChildren();}
  }
}
el('account-team-accept').addEventListener('submit',async event=>{
  event.preventDefault();
  const session=accountSession,button=event.currentTarget.querySelector('button');
  button.disabled=true;
  try{
    await teamApi('POST',{action:'accept',teamId:el('account-team-id').value.trim(),token:el('account-team-code').value.trim()},session);
    if(session!==accountSession)return;
    el('account-team-accept').reset();
    await loadTeamWorkspaces();
    if(session===accountSession)el('account-team-notice').textContent='Convite aceito.';
  }catch{if(session===accountSession)el('account-team-notice').textContent='Convite inválido, expirado ou não destinado à sua conta.';}
  finally{button.disabled=false;}
});

function trustedTechnicianImage(value, slot) {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === 'https:' &&
      (url.origin === window.location.origin || url.hostname === 'www.sevendesk.tech') &&
      new RegExp('^/avatars/[0-9a-f-]{36}/technician-' + slot + '\\.(?:jpg|png|webp)$').test(url.pathname)
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
    '<label class="technician-card-upload">Foto/avatar do técnico<input type="file" accept="image/jpeg,image/png,image/webp"><small>JPG, PNG ou WebP até 2 MB · exibida nas solicitações de acesso</small></label>',
    '</div>',
    '<p class="technician-card-description"></p>',
    '<div class="technician-card-actions">',
    '<button type="button" class="technician-card-primary" data-card-save></button>',
    '</div>'
  ].join('');
  const find = selector => card.querySelector(selector);
  const nameInput = find('[data-tech-name]');
  const photoInput = find('input[type=file]');
  const photo = find('.technician-card-photo');
  const initials = find('.technician-card-initials');
  const title = find('.technician-card-identity h3');
  const subtitle = find('.technician-card-identity p');
  const badge = find('.technician-card-badge');
  const savedName = typeof device?.technician_name === 'string' ? device.technician_name : '';
  nameInput.value = savedName;
  find('.technician-card-kicker').textContent = 'VAGA ' + String(slot).padStart(2,'0');
  badge.dataset.status = savedName ? 'registered' : 'available';
  badge.textContent = savedName ? 'Cadastrado' : 'Vaga livre';
  find('.technician-card-description').textContent = savedName
    ? 'Gere a chave desta vaga em Ativação do sistema, na Visão geral.'
    : 'Cadastre o técnico para liberar a emissão da chave desta vaga.';
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
    subtitle.textContent = device?.label || (slot === 1 ? 'Meu computador' : 'Computador ' + slot);
    const words = name.split(/\s+/).filter(Boolean);
    initials.textContent = (words.length > 1 ? words[0][0] + words.at(-1)[0] :
      words[0]?.slice(0,2) || 'T').toLocaleUpperCase('pt-BR');
  }
  syncIdentity();
  setPhoto(remotePhotoUrl);
  nameInput.addEventListener('input',syncIdentity);
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
  return card;
}

function createActivationCodes(pair) {
  const codes = document.createElement('div');
  codes.className = 'activation-secret';
  for (const [labelText, value] of [
    ['Chave de ativação', pair.token],
  ]) {
    const row = document.createElement('div');
    row.className = 'activation-code-row';
    const label = document.createElement('label');
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'text';
    input.readOnly = true;
    input.spellcheck = false;
    input.autocomplete = 'off';
    input.value = value;
    label.append(input);

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.textContent = 'Copiar';
    copy.setAttribute('aria-label', 'Copiar ' + labelText.toLowerCase());
    copy.addEventListener('click', async () => {
      const notice = el('account-activation-notice');
      const session = accountSession;
      try {
        await navigator.clipboard.writeText(input.value);
        if (session === accountSession) notice.textContent = labelText + ' copiado.';
      } catch {
        input.focus();
        input.select();
        if (session === accountSession) notice.textContent = 'Use a seleção para copiar o código manualmente.';
      }
    });
    row.append(label, copy);
    codes.append(row);
  }
  const hint = document.createElement('small');
  hint.textContent = 'Copie a chave antes de recarregar ou fechar a página.';
  codes.append(hint);
  return codes;
}

function createActivationCard(slot, device) {
  const card = document.createElement('article');
  card.className = 'activation-card';
  card.dataset.activationSlot = String(slot);
  card.setAttribute('aria-label', 'Ativação da vaga ' + slot);

  const header = document.createElement('div');
  header.className = 'activation-card-header';
  const title = document.createElement('strong');
  title.textContent = 'Vaga ' + String(slot).padStart(2, '0');
  const state = document.createElement('span');
  const hasTechnician = Boolean(device?.technician_name?.trim());
  const linked = device?.technician_verified === true;
  state.textContent = linked ? 'Técnico vinculado' : device?.activated
    ? 'Aguardando vínculo' : hasTechnician ? 'Pronta para ativar' : 'Sem técnico';
  state.dataset.status = linked ? 'activated' : 'available';
  header.append(title, state);

  const technician = document.createElement('p');
  technician.className = 'activation-technician';
  technician.textContent = hasTechnician
    ? 'Técnico: ' + device.technician_name
    : 'Cadastre um técnico para gerar a chave.';

  const nameLabel = document.createElement('label');
  nameLabel.textContent = 'Nome do computador';
  const name = document.createElement('input');
  name.type = 'text';
  name.maxLength = 60;
  name.autocomplete = 'off';
  name.placeholder = 'Ex.: Meu computador';
  name.value = device?.label || (slot === 1 ? 'Meu computador' : 'Computador ' + slot);
  nameLabel.append(name);

  const actions = document.createElement('div');
  actions.className = 'activation-card-actions';
  const generate = document.createElement('button');
  generate.type = 'button';
  generate.textContent = hasTechnician
    ? (device?.activated ? 'Gerar nova chave' : 'Gerar chave')
    : 'Cadastrar técnico';
  if (hasTechnician) generate.dataset.activationChange = '';
  generate.disabled = hasTechnician && activationUpdatesInFlight.has(slot);
  generate.addEventListener('click', () => {
    if (!hasTechnician) {
      showClientView('devices');
      el('account-device-list').querySelector(`[data-technician-slot="${slot}"] [data-tech-name]`)?.focus();
      return;
    }
    if (device?.activated && !window.confirm(
      'Gerar nova chave invalida a anterior. Você precisará ativar o computador desta vaga novamente. Continuar?'
    )) return;
    updateAppDevice(slot, name.value, false, device);
  });
  actions.append(generate);
  if (device?.activated) {
    const revoke = document.createElement('button');
    revoke.type = 'button';
    revoke.textContent = 'Revogar ativação';
    revoke.className = 'activation-card-revoke';
    revoke.dataset.activationChange = '';
    revoke.disabled = activationUpdatesInFlight.has(slot);
    revoke.addEventListener('click', () => {
      if (window.confirm('Revogar a ativação deste computador?')) updateAppDevice(slot, name.value, true, device);
    });
    actions.append(revoke);
  }

  card.append(header, technician, nameLabel, actions);
  const pair = revealedCodePairs.get(slot);
  if (pair) card.append(createActivationCodes(pair));
  return card;
}

async function loadAppAccess() {
  const request = ++appAccessRequest;
  const session = accountSession;
  const availabilityNotice = el('account-device-unavailable');
  const activationAvailability = el('account-activation-unavailable');
  activationAvailability.hidden = false;
  activationAvailability.textContent = 'Verificando disponibilidade dos computadores...';
  availabilityNotice.hidden = false;
  availabilityNotice.textContent = 'Verificando disponibilidade dos dispositivos...';
  try {
    const response = await fetch('/api/app-token', {
      headers: {Authorization: await appAuthorization()}, cache:'no-store',
    });
    if (!response.ok) throw new Error('Device management unavailable');
    const {devices,maxSlots} = await response.json();
    if (request !== appAccessRequest || session !== accountSession) return;
    if (!Array.isArray(devices)) throw new Error('Invalid devices payload');
    availabilityNotice.hidden = true;
    activationAvailability.hidden = true;
    el('account-app-access').hidden = false;
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
    const activations = el('account-activation-list');
    activations.replaceChildren();
    for (let slot = 1; slot <= availableSlots; slot++) {
      list.append(createTechnicianCard(slot, bySlot.get(slot)));
      activations.append(createActivationCard(slot, bySlot.get(slot)));
    }
  } catch {
    if (request !== appAccessRequest || session !== accountSession) return;
    availabilityNotice.hidden = false;
    activationAvailability.hidden = false;
    activationAvailability.textContent = 'Não foi possível consultar a ativação do sistema. Tente novamente mais tarde.';
    availabilityNotice.textContent = 'Não foi possível carregar os dispositivos. Tente novamente mais tarde.';
  }
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
    if (file) {
      const uploaded = await fetch(`/api/technician-photo?slot=${slot}`, {
        method:'POST',cache:'no-store',
        headers:{...headers,'Content-Type':file.type},
        body:file,
      });
      if (!uploaded.ok) throw new Error('Unable to save technician photo');
    }
    await loadAppAccess();
    notice.textContent = `Perfil da vaga ${slot} salvo. Gere a chave em Ativação do sistema, na Visão geral.`;
  } catch {
    notice.textContent = 'Não foi possível concluir o perfil. Confira os dados e tente novamente.';
  } finally {
    button.disabled = false;
  }
}

async function updateAppDevice(slot, label, revoke, device) {
  const notice = el('account-activation-notice');
  const name = label.trim();
  if (activationUpdatesInFlight.has(slot)) return;
  if (!Number.isInteger(slot) || slot < 1 || slot > 500 ||
      (!revoke && (name.length < 1 || name.length > 60))) {
    notice.textContent = 'Informe um nome de computador válido, de até 60 caracteres.';
    return;
  }
  const session = accountSession;
  const findCard = () => el('account-activation-list').querySelector(`[data-activation-slot="${slot}"]`);
  const setDisabled = disabled => findCard()?.querySelectorAll('[data-activation-change]')
    .forEach(button => { button.disabled = disabled; });
  activationUpdatesInFlight.add(slot);
  setDisabled(true);

  try {
    const authorization = await appAuthorization();
    if (session !== accountSession) return;
    const response = await fetch('/api/app-token', {
      method: revoke ? 'DELETE' : 'POST', cache:'no-store',
      headers: {'Content-Type':'application/json', Authorization:authorization},
      body: JSON.stringify(revoke ? {slot} : {slot, label:name}),
    });
    if (session !== accountSession) return;
    if (response.status === 409) {
      notice.textContent = 'Cadastre um técnico nesta vaga e confirme o e-mail da conta.';
      return;
    }
    if (!response.ok) throw new Error('Activation unavailable');
    const result = await response.json();
    if (session !== accountSession) return;
    if (revoke) {
      revealedCodePairs.delete(slot);
    } else {
      if (typeof result.token !== 'string' || !/^sd(?:2)?_[A-Za-z0-9_-]{43}$/.test(result.token)) {
        throw new Error('Invalid activation key');
      }
      revealedCodePairs.set(slot, {token:result.token});
    }
    findCard()?.replaceWith(createActivationCard(slot, {
      ...device, label:revoke ? undefined : name, activated:!revoke, technician_verified:!revoke,
    }));
    notice.textContent = revoke
      ? `Ativação da vaga ${slot} revogada.`
      : `Chave da vaga ${slot} gerada. Cole-a no aplicativo; o técnico será reconhecido automaticamente.`;
    await loadAppAccess();
  } catch {
    if (session === accountSession) {
      notice.textContent = 'Não foi possível atualizar a ativação do sistema. Tente novamente.';
    }
  } finally {
    if (session === accountSession) {
      activationUpdatesInFlight.delete(slot);
      setDisabled(false);
    }
  }
}
function resetSubscriptionDetails() {
  el('account-subscription-details').hidden = true;
  el('account-subscription-payment').hidden = true;
  el('account-subscription-progress').hidden = true;
  el('account-subscription-badge').dataset.state = 'loading';
  el('account-subscription-badge').textContent = 'Consultando';
  el('account-subscription-title').textContent = 'Consultando assinatura...';
}

async function loadSubscription() {
  const target = el('account-subscription');
  const summary = el('account-summary-subscription');
  resetSubscriptionDetails();
  target.textContent = 'Consultando seu período de acesso e pagamentos confirmados...';
  summary.textContent = 'Consultando período de acesso...';
  try {
    const response = await fetch('/api/subscription', {
      headers:{Authorization:await appAuthorization()}, cache:'no-store'
    });
    if (!response.ok) throw new Error('Unavailable');
    const view = presentSubscription(await response.json());
    el('account-subscription-badge').dataset.state = view.state;
    el('account-subscription-badge').textContent = view.badge;
    el('account-subscription-title').textContent = view.headline;
    target.textContent = view.explanation;
    summary.textContent = view.summary;
    el('account-summary-status').textContent = view.overviewStatus;
    for (const [id,value] of [
      ['account-subscription-trial',view.trialDate],
      ['account-subscription-trial-hint',view.trialHint],
      ['account-subscription-start-label',view.startLabel],
      ['account-subscription-start',view.startValue],
      ['account-subscription-start-hint',view.startHint],
      ['account-subscription-end-label',view.endLabel],
      ['account-subscription-end',view.endValue],
      ['account-subscription-end-hint',view.endHint],
      ['account-subscription-days',view.trialDays],
      ['account-payment-plan',view.paymentName],
      ['account-payment-amount',view.paymentAmount],
      ['account-payment-date',view.paymentDate],
      ['account-payment-description',view.paymentMessage],
      ['account-subscription-slots',view.slots],
    ]) el(id).textContent = value;
    el('account-subscription-progress').hidden = !view.showTrialProgress;
    el('account-subscription-meter').setAttribute('aria-valuenow', String(view.trialProgress));
    el('account-subscription-meter-fill').style.width = view.trialProgress + '%';
    el('account-subscription-payment').hidden = !view.showPayment;
    el('account-subscription-details').hidden = false;
  } catch {
    resetSubscriptionDetails();
    target.textContent = 'Não foi possível consultar sua assinatura agora. Tente novamente mais tarde.';
    summary.textContent = 'O status da assinatura está temporariamente indisponível.';
    el('account-subscription-title').textContent = 'Informações indisponíveis';
    el('account-subscription-badge').textContent = 'Indisponível';
    el('account-subscription-badge').dataset.state = 'unavailable';
    el('account-summary-status').textContent = 'Indisponível';
  }
}
let checkoutProviderDisabled = false;
const checkoutDisabledMessage =
  'Pagamentos indisponíveis: é necessário habilitar o Checkout Integrado na conta InfinitePay. Contate o suporte Seven Desk.';
async function loadCheckoutAvailability() {
  const notice = el('account-checkout-notice');
  for (const button of paymentButtons) {
    button.disabled = true;
    if (['business','enterprise'].includes(button.dataset.plan)) button.hidden=true;
  }
  el('account-team-billing-note').hidden=true;
  notice.textContent = checkoutProviderDisabled ? checkoutDisabledMessage : 'Pagamentos temporariamente indisponíveis.';
  if (checkoutProviderDisabled) return;
  try {
    const response = await fetch('/api/billing-status', {cache:'no-store'});
    if (!response.ok) return;
    const availability=await response.json();
    if (availability.checkoutAvailable !== true) return;
    for (const button of paymentButtons) {
      const team=['business','enterprise'].includes(button.dataset.plan);
      const available=!team||availability.teamCheckoutAvailable===true;
      button.disabled=!available;
      if(team)button.hidden=!available;
    }
    el('account-team-billing-note').hidden=availability.teamCheckoutAvailable!==true;
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
    if (!response.ok) {
      const details = await response.json().catch(() => null);
      if (response.status === 503 && details?.code === 'CHECKOUT_INTEGRATION_DISABLED') {
        checkoutProviderDisabled = true;
        throw new Error('CHECKOUT_INTEGRATION_DISABLED');
      }
      throw new Error('Checkout unavailable');
    }
    const {url:link} = await response.json();
    const url = new URL(link);
    if (url.protocol !== 'https:' ||
      !['checkout.infinitepay.io', 'checkout.infinitepay.com.br'].includes(url.hostname) ||
      url.username || url.password || url.port) throw new Error('Untrusted checkout URL');
    window.location.assign(url.href);
  } catch {
    await loadCheckoutAvailability();
    notice.textContent = checkoutProviderDisabled
      ? checkoutDisabledMessage
      : 'Não foi possível iniciar o pagamento. Tente novamente mais tarde.';
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
      status(''); // Connected badge confirms the session without another banner.
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
