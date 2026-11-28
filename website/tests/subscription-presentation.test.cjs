'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const fs=require('node:fs');
const {getEntitlement}=require('../lib/billing');

const modulePath=pathToFileURL(path.join(__dirname,'../subscription-presentation.mjs')).href;
const render=async (data,now)=> (await import(modulePath)).presentSubscription(data,now);
const trial={
  status:'trial',
  trialStartedAt:'2026-11-01T12:00:00Z',
  trialEndsAt:'2026-12-01T12:00:00Z',
  accessEndsAt:'2026-12-01T12:00:00Z',
  paidThrough:null,
  paidPlan:null,
  lastPaymentAt:null,
  lastPaymentAmountCents:null,
  extraSlots:0,
};
const paid={
  ...trial,
  paidThrough:'2027-01-01T12:00:00Z',
  accessEndsAt:'2027-01-01T12:00:00Z',
  paidPlan:'monthly',
  lastPaymentAt:'2026-11-19T11:00:00Z',
  lastPaymentAmountCents:3990,
};

test('unpaid trial displays a free month and no false payment confirmation',async()=>{
  const data=await render(trial,Date.parse('2026-11-15T12:00:00Z'));
  assert.equal(data.badge,'Teste gratuito');
  assert.equal(data.showPayment,false);
  assert.equal(data.showTrialProgress,true);
  assert.equal(data.startValue,'Ainda não contratado');
  assert.match(data.summary,/Período gratuito/);
  assert.equal(data.endLabel,'Validade do acesso');
  assert.match(data.slots,/5 incluídos/);
  assert.ok(data.trialProgress>0 && data.trialProgress<100);
});

test('payment confirmed during trial starts only after free month ends',async()=>{
  const data=await render(paid,Date.parse('2026-11-19T12:00:00Z'));
  assert.equal(data.state,'trial');
  assert.equal(data.showPayment,true);
  assert.match(data.badge,/plano confirmado/);
  assert.match(data.explanation,/começará quando o mês de teste terminar/);
  assert.equal(data.startValue,data.trialDate);
  assert.equal(data.endLabel,'Validade contratada');
  assert.notEqual(data.endValue,data.trialDate);
  assert.equal(data.paymentAmount,'R$ 39,90');
  assert.equal(data.paymentName,'Mensal — 1 mês');
  assert.equal(data.overviewStatus,'Período grátis');
  assert.match(data.paymentMessage,/reservado/);
});

test('paid subscription has valid access after the trial without promising auto-renewal',async()=>{
  const data=await render({...paid,status:'paid'},Date.parse('2026-12-19T12:00:00Z'));
  assert.equal(data.badge,'Assinatura ativa');
  assert.equal(data.showTrialProgress,false);
  assert.equal(data.showPayment,true);
  assert.equal(data.startValue,'Em andamento');
  assert.match(data.summary,/Assinatura ativa até/);
  assert.equal(data.overviewStatus,'Ativa');
});

test('expired subscription never claims ongoing access',async()=>{
  const data=await render({...paid,status:'expired'},Date.parse('2027-01-05T12:00:00Z'));
  assert.equal(data.state,'expired');
  assert.equal(data.overviewStatus,'Encerrada');
  assert.match(data.headline,/terminou/);
  assert.equal(data.showTrialProgress,false);
  assert.equal(data.showPayment,true);
  assert.match(data.paymentMessage,/Último pagamento/);
});

test('annual payment is labeled and formatted correctly, extra slots are separate',async()=>{
  const yearly={...paid,paidPlan:'yearly',lastPaymentAmountCents:40000,
    paidThrough:'2027-12-01T12:00:00Z',
    accessEndsAt:'2027-12-01T12:00:00Z',extraSlots:2};
  const data=await render(yearly,Date.parse('2026-11-19T12:00:00Z'));
  assert.equal(data.paymentAmount,'R$ 400,00');
  assert.equal(data.paymentName,'Anual — 1 ano');
  assert.equal(data.slots,'5 incluídos + 2 adicionais');
});

test('malformed API responses fail closed rather than guessing payment dates',async()=>{
  const cases=[
    null,{...paid,status:'unknown'},{...paid,paidPlan:'extra_slot'},
    {...paid,lastPaymentAmountCents:7},{...paid,trialStartedAt:'not a date'},
    {...paid,trialEndsAt:'2030-99-99T00:00:00Z'},
    {...paid,paidThrough:null},{...paid,extraSlots:-1},
    {...paid,extraSlots:'1'}, {...paid,accessEndsAt:'2026-10-01T00:00:00Z'},
  ];
  for(const input of cases)await assert.rejects(render(input,Date.now()),/Invalid/);
});

test('server subscription query only exposes verified user and confirmed plan purchases',async()=>{
  let sql='',args;
  const db={query:async(q,a)=>{
    sql=q;args=a;
    return {rows:[{status:'trial',trial_started_at:trial.trialStartedAt,
      trial_ends_at:trial.trialEndsAt,access_ends_at:paid.accessEndsAt,
      paid_plan:'monthly',last_paid_at:paid.lastPaymentAt,
      last_paid_amount_cents:3990}]};
  }};
  const userId='938add03-d4a9-4553-a2ca-0fb41a3403d8';
  const output=await getEntitlement(db,userId);
  assert.equal(output.paid_plan,'monthly');
  assert.deepEqual(args,[userId]);
  assert.match(sql,/u\."emailVerified" IS TRUE/);
  assert.match(sql,/LEFT JOIN LATERAL/);
  assert.match(sql,/o\.state = 'paid'/);
  assert.match(sql,/o\.plan IN \('monthly', 'yearly'\)/);
  assert.match(sql,/ORDER BY o\.paid_at DESC, o\.order_id DESC/);
  assert.match(sql,/GREATEST\(u\."createdAt" \+ interval '1 month'/);
  assert.doesNotMatch(sql,/o\.transaction_nsu/);
});

test('the account renders billing information with text-only assignments and no secret identifiers',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../conta.html'),'utf8');
  const js=fs.readFileSync(path.join(__dirname,'../conta.js'),'utf8');
  for(const id of ['account-subscription-title','account-subscription-badge','account-subscription-trial',
    'account-subscription-start','account-subscription-end','account-subscription-payment',
    'account-payment-plan','account-payment-amount','account-payment-date','account-subscription-meter']){
    assert.ok(html.includes('id="'+id+'"'),id);
  }
  assert.match(html,/Minha assinatura/);
  assert.match(html,/sem cobrança ou renovação automática/);
  assert.match(js,/presentSubscription\(subscription\)/);
  assert.match(js,/\['account-payment-plan',view\.paymentName\]/);
  assert.match(js,/el\(id\)\.textContent = value/);
  assert.match(js,/resetSubscriptionDetails\(\)/);
  assert.match(html,/href="\/portal\.css\?v=\d+"/);
  const css=fs.readFileSync(path.join(__dirname,'../portal.css'),'utf8');
  assert.match(css,/\.client-subscription-payment\[hidden\]/);
});

test('displays new professional payment amounts without altering legacy receipts', async () => {
  const now=Date.parse('2026-11-19T12:00:00Z');
  const monthly=await render({...paid,lastPaymentAmountCents:1990},now);
  assert.equal(monthly.paymentAmount,'R$\u00a019,90');
  const annual=await render({...paid,paidPlan:'yearly',lastPaymentAmountCents:19990},now);
  assert.equal(annual.paymentAmount,'R$\u00a0199,90');
});

test('Personal is visibly free, has one slot and no fixed expiry',async()=>{
  const data=await render({...trial,status:'personal',personalEnrolled:true,accessEndsAt:null},Date.parse('2027-01-05T12:00:00Z'));
  assert.equal(data.badge,'Personal gratuito');assert.equal(data.slots,'1 vaga Personal');assert.equal(data.endValue,'Sem prazo fixo');assert.equal(data.showPayment,false);
  await assert.rejects(render({...trial,status:'personal',personalEnrolled:false,accessEndsAt:null}),/Invalid/);
});
