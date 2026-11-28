'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const payment = require('../lib/infinitepay');

test('checkout prices are fixed by the selected plan on the server', () => {
  const common = { handle: '$merchant', orderId: 'order-1', siteUrl: 'https://example.com' };
  assert.equal(payment.checkoutPayload({ ...common, plan: 'monthly', amount: 1 }).items[0].price, 1990);
  assert.equal(payment.checkoutPayload({ ...common, plan: 'yearly', amount: 1 }).items[0].price, 19990);
  assert.equal(payment.checkoutPayload({ ...common, plan: 'business', amount: 1 }).items[0].price, 4990);
  assert.equal(payment.checkoutPayload({ ...common, plan: 'enterprise', amount: 1 }).items[0].price, 14990);
  const checkout = payment.checkoutPayload({ ...common, plan: 'monthly' });
  assert.equal(checkout.options.single_payment, true);
  const lifetime = Date.parse(checkout.options.valid_until) - Date.now();
  assert.ok(lifetime > 29 * 60_000 && lifetime <= 30 * 60_000);
  assert.throws(() => payment.checkoutPayload({ ...common, plan: 'unknown' }));
  assert.throws(() => payment.checkoutPayload({ ...common, plan: 'monthly', siteUrl: 'http://example.com' }));
});

test('rejects checkout links outside the payment provider', async () => {
  const input = { handle: 'merchant', orderId: 'order-1', plan: 'monthly', siteUrl: 'https://example.com' };
  const fake = url => async () => ({ ok: true, json: async () => ({ url }) });
  await assert.rejects(payment.createCheckout(input, { fetchImpl: fake('https://checkout.infinitepay.com.br/a') }));
  assert.equal(await payment.createCheckout(input, { apiKey: 'test-key', fetchImpl: fake('https://checkout.infinitepay.com.br/a') }), 'https://checkout.infinitepay.com.br/a');
  assert.equal(await payment.createCheckout(input, { apiKey: 'test-key', fetchImpl: fake('https://checkout.infinitepay.io/gabriel_1313/checkout-123') }), 'https://checkout.infinitepay.io/gabriel_1313/checkout-123');
  await assert.rejects(payment.createCheckout(input, { apiKey: 'test-key', fetchImpl: fake('https://checkout.infinitepay.com.br.evil.test/a') }));
  await assert.rejects(payment.createCheckout(input, { apiKey: 'test-key', fetchImpl: fake('https://checkout.infinitepay.io.evil.test/a') }));
  await assert.rejects(payment.createCheckout(input, { apiKey: 'test-key', fetchImpl: fake('http://checkout.infinitepay.io/a') }));
});

test('confirms a paid order using the provider and the stored plan amount', async () => {
  const input = { handle: 'merchant', orderId: 'order-1', transactionId: 'tx-1', slug: 'invoice', plan: 'monthly' };
  const fake = result => async () => ({ ok: true, json: async () => result });
  assert.equal(await payment.verifyPayment(input, { fetchImpl: fake({ success: true, paid: true, amount: 1990 }) }), true);
  assert.equal(await payment.verifyPayment(input, { fetchImpl: fake({ success: true, paid: true, amount: 1 }) }), false);
  assert.equal(await payment.verifyPayment(input, { fetchImpl: fake({ success: true, paid: false, amount: 1990 }) }), false);
});


test('recognizes merchant-disabled checkout without leaking provider data', async () => {
  const input = {
    handle:'merchant', orderId:'test-order', plan:'monthly', siteUrl:'https://www.sevendesk.tech',
  };
  const provider = async () => ({
    ok:false,
    status:404,
    json:async () => ({
      error:'external_checkout_not_enabled',
      message:'Private provider details must not reach the customer',
    }),
  });
  await assert.rejects(
    payment.createCheckout(input,{apiKey:'test-key',fetchImpl:provider}),
    error => error.code === 'CHECKOUT_INTEGRATION_DISABLED' &&
      !error.message.includes('Private provider details'),
  );
  // Unknown failures remain generic, with no provider body forwarded to callers.
  const unknown = async () => ({
    ok:false,status:403,
    json:async () => ({error:'other_private_error',message:'Sensitive provider response'}),
  });
  await assert.rejects(
    payment.createCheckout(input,{apiKey:'test-key',fetchImpl:unknown}),
    error => error.message === 'Payment provider unavailable' &&
      !error.message.includes('Sensitive provider response'),
  );
});

test('checkout route reports disabled provider safely and keeps authorization required', async () => {
  const {createBillingHandlers}=require('../lib/billing-routes');
  const makeResponse=()=>{
    const res={statusCode:200,body:null,headers:{}};
    res.status=code=>{res.statusCode=code;return res;};
    res.json=body=>{res.body=body;return res;};
    res.setHeader=(name,value)=>{res.headers[name]=value;};
    return res;
  };
  let created=0;
  const handlers=createBillingHandlers({
    checkoutEnabled:()=>true,
    webhookEnabled:()=>false,
    authenticate:async header=>header==='Bearer verified'?'verified-user':null,
    pool:()=>({query:async()=>({rows:[]})}),
    createOrder:async()=>{created++;return 'order-123';},
    createCheckout:async()=> {
      const error=new Error('Internal provider response must be hidden');
      error.code='CHECKOUT_INTEGRATION_DISABLED';
      throw error;
    },
    reconcilePayment:async()=>false,
    config:()=>({handle:'merchant',apiKey:'test-key',siteUrl:'https://www.sevendesk.tech'}),
  });
  const unauthorized=makeResponse();
  await handlers.checkout({method:'POST',headers:{authorization:''},body:{plan:'monthly'}},unauthorized);
  assert.equal(unauthorized.statusCode,401);
  assert.equal(created,0);
  const res=makeResponse();
  await handlers.checkout({method:'POST',headers:{authorization:'Bearer verified'},body:{plan:'monthly'}},res);
  assert.equal(res.statusCode,503);
  assert.equal(res.body.code,'CHECKOUT_INTEGRATION_DISABLED');
  assert.match(res.body.error,/Checkout Integrado/);
  assert.doesNotMatch(JSON.stringify(res.body),/Internal provider response/);
  assert.equal(created,1);
});

test('the website explains provider-disabled billing without exposing provider secrets', () => {
  const {readFileSync}=require('node:fs');
  const {join}=require('node:path');
  const source=readFileSync(join(__dirname,'../conta.js'),'utf8');
  assert.match(source,/let checkoutProviderDisabled = false/);
  assert.match(source,/details\?\.code === 'CHECKOUT_INTEGRATION_DISABLED'/);
  assert.match(source,/if \(checkoutProviderDisabled\) return/);
  assert.match(source,/checkoutDisabledMessage/);
  assert.doesNotMatch(source,/https:\/\/checkout\.infinitepay\.io\/gabriel_/);
});

test('legacy orders reconcile only their original amount; new orders cannot use legacy prices', async () => {
  const input={handle:'merchant',orderId:'order-1',transactionId:'tx-1',slug:'invoice',plan:'monthly'};
  const fake=amount=>async()=>({ok:true,json:async()=>({success:true,paid:true,amount})});
  assert.equal(await payment.verifyPayment({...input,orderAmount:3990},{fetchImpl:fake(3990)}),true);
  assert.equal(await payment.verifyPayment({...input,orderAmount:3990},{fetchImpl:fake(1990)}),false);
  assert.equal(await payment.verifyPayment(input,{fetchImpl:fake(3990)}),false);
  assert.equal(await payment.verifyPayment({...input,orderAmount:1},{fetchImpl:fake(1)}),false);
  assert.throws(()=>payment.planFor('personal'));
  assert.equal(payment.planFor('business').amount,4990);
  assert.equal(payment.planFor('enterprise').amount,14990);
});
