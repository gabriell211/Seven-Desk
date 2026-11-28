const formatDate = new Intl.DateTimeFormat('pt-BR', {dateStyle:'long', timeStyle:'short'});
const formatMoney = new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'});
const dayInMilliseconds = 24 * 60 * 60 * 1000;

function readDate(value, required = true) {
  if (value == null && !required) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d[T ]/.test(value)) throw new Error('Invalid subscription date');
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error('Invalid subscription date');
  return parsed;
}

function asDate(date) {
  return date ? formatDate.format(date) : '—';
}

function validatePayment(data) {
  const plan = data.paidPlan ?? null;
  if (plan === null) return null;
  if (!['monthly', 'yearly'].includes(plan)) throw new Error('Invalid subscription plan');
  const expectedAmount = data.lastPaymentAmountCents;
  const validAmounts = plan === 'monthly' ? [1990, 3990] : [19990, 40000];
  if (!validAmounts.includes(expectedAmount)) throw new Error('Invalid subscription amount');
  const paidAt = readDate(data.lastPaymentAt);
  const paidThrough = readDate(data.paidThrough);
  return {name: plan === 'monthly' ? 'Mensal — 1 mês' : 'Anual — 1 ano',
    date:asDate(paidAt), amount:formatMoney.format(expectedAmount / 100),
    paidAt, paidThrough};
}

export function presentSubscription(data, now = Date.now()) {
  if (!data || !['trial', 'paid', 'expired','personal'].includes(data.status)
      || typeof now !== 'number' || !Number.isFinite(now)) {
    throw new Error('Invalid subscription status');
  }
  const trialStart = readDate(data.trialStartedAt);
  const trialEnd = readDate(data.trialEndsAt);
  if(data.status==='personal'){
    if(data.personalEnrolled!==true || data.accessEndsAt!==null || trialEnd<=trialStart)
      throw new Error('Invalid Personal entitlement');
    const payment=validatePayment(data);
    return {state:'personal',badge:'Personal gratuito',headline:'Seu plano Personal está ativo.',
      explanation:'Uso pessoal, sem finalidade comercial. Uma vaga de ativação, sem mensalidade.',
      summary:'Personal · 1 vaga · gratuito',overviewStatus:'Personal',trialDate:asDate(trialEnd),
      trialHint:'Período inicial da conta',startLabel:'Situação do plano',startValue:'Ativo',
      startHint:'Uso pessoal não comercial',endLabel:'Validade do acesso',endValue:'Sem prazo fixo',
      endHint:'Sujeito às condições do plano',showTrialProgress:false,trialDays:'—',trialProgress:0,
      showPayment:Boolean(payment),paymentName:payment?.name??'—',paymentAmount:payment?.amount??'—',
      paymentDate:payment?.date??'—',paymentMessage:'Último pagamento confirmado.',slots:'1 vaga Personal'};
  }
  const accessEnd = readDate(data.accessEndsAt);
  if (trialEnd <= trialStart || accessEnd < trialEnd) throw new Error('Invalid subscription period');
  const payment = validatePayment(data);
  const extras = data.extraSlots;
  if (!Number.isSafeInteger(extras) || extras < 0 || extras > 500) throw new Error('Invalid slot count');

  const isTrial = data.status === 'trial';
  const isPaid = data.status === 'paid';
  const trialRemaining = Math.max(0,Math.ceil((trialEnd.getTime() - now) / dayInMilliseconds));
  const trialProgress = Math.min(100,Math.max(0,Math.round(
    (now - trialStart.getTime()) * 100 / (trialEnd.getTime() - trialStart.getTime())
  )));
  const paidDuringTrial = isTrial && Boolean(payment);
  const accessDate = asDate(accessEnd);
  const trialDate = asDate(trialEnd);

  const headline = paidDuringTrial ? 'Teste gratuito ativo. Seu plano já está garantido.'
    : isTrial ? 'Seu primeiro mês é gratuito.'
    : isPaid ? 'Sua assinatura está ativa.'
    : 'Seu período de acesso terminou.';
  const explanation = paidDuringTrial
    ? 'Pagamento confirmado. Sua assinatura começará quando o mês de teste terminar, sem perder nenhum dia gratuito.'
    : isTrial
      ? 'Você pode usar o Seven Desk durante o mês gratuito. Ao contratar um plano agora, o prazo comprado será acrescentado depois do teste.'
      : isPaid
        ? 'Seu acesso está liberado até a data indicada. Novas compras estendem a validade existente.'
        : 'Para continuar usando o serviço após o período expirado, escolha um dos planos disponíveis.';
  const summary = paidDuringTrial
    ? 'Teste gratuito até ' + trialDate + '. Plano pago começa após o teste.'
    : isTrial ? 'Período gratuito até ' + trialDate + '.'
    : isPaid ? 'Assinatura ativa até ' + accessDate + '.'
    : 'Seu período de acesso terminou.';

  return {
    state: data.status,
    badge: paidDuringTrial ? 'Teste grátis + plano confirmado' : isTrial ? 'Teste gratuito' : isPaid ? 'Assinatura ativa' : 'Acesso encerrado',
    headline, explanation, summary,
    overviewStatus: isTrial ? 'Período grátis' : isPaid ? 'Ativa' : 'Encerrada',
    trialDate,
    trialHint: 'Um mês após a criação da conta',
    startLabel: paidDuringTrial ? 'Início da assinatura' : 'Situação do plano',
    startValue: paidDuringTrial ? trialDate : isPaid ? 'Em andamento' : isTrial ? 'Ainda não contratado' : 'Sem acesso ativo',
    startHint: paidDuringTrial
      ? 'O plano começa após o último dia gratuito'
      : isPaid ? 'O acesso pago está em andamento'
        : 'Uma compra confirmada libera o próximo período',
    endLabel: payment ? 'Validade contratada' : 'Validade do acesso',
    endValue: payment ? asDate(payment.paidThrough) : accessDate,
    endHint: payment ? 'Compras adicionais prolongam esta validade' : 'Sem cobrança automática',
    showTrialProgress: isTrial,
    trialDays: trialRemaining === 0 ? 'Menos de 1 dia restante'
      : trialRemaining === 1 ? '1 dia restante' : trialRemaining + ' dias restantes',
    trialProgress,
    showPayment: Boolean(payment),
    paymentName:payment?.name ?? '—',
    paymentAmount:payment?.amount ?? '—',
    paymentDate:payment?.date ?? '—',
    paymentMessage: paidDuringTrial
      ? 'Recebido e reservado para começar após o teste gratuito.'
      : isPaid ? 'Pagamento confirmado e acesso liberado.' : 'Último pagamento confirmado.',
    slots: extras ? '5 incluídos + ' + extras + ' adicionais' : '5 incluídos',
  };
}
