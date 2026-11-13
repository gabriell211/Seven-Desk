'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createConfirmPaymentHandler } = require('../lib/confirm-payment');
const orderId = '0b0d3ab1-d0cd-4e62-a0f6-c8fe7e325c8a';
const payload = { order_nsu: orderId, transaction_nsu: 'transaction-1', slug: 'invoice-1' };

function res() { return { setHeader() {}, status(code) { this.code=code; return this; }, json(v) { this.data=v; return this; } }; }
function setup({ user='user-a', owner='user-a', enabled=true, confirmed=true }={}) {
  const calls=[];
  const db={query: async (query,params)=>{calls.push(['query',params]);return {rows:params[1] === owner ? [{order_id:orderId}] : []};}};
  const handler=createConfirmPaymentHandler({
    enabled:()=>enabled,
    authenticate:async()=>user,
    pool:()=>db,
    reconcilePayment:async (_db,event,provider)=>{calls.push(['reconcile',event,provider]);return confirmed;},
    config:()=>({handle:'gabriel_1313',apiKey:'test-secret'}),
  });
  return {handler,calls};
}
function req(body=payload) { return {method:'POST',headers:{authorization:'Bearer test'},body}; }

test('rejects disabled, unauthenticated and malformed return notifications', async()=>{
  const closed=setup({enabled:false}); const a=res();await closed.handler(req(),a);assert.equal(a.code,503);
  const guest=setup({user:null});const b=res();await guest.handler(req(),b);assert.equal(b.code,401);
  const bad=setup();const c=res();await bad.handler(req({...payload, order_nsu:'other-user'}),c);assert.equal(c.code,400);
});
test('only owner can reconcile his checkout with provider verification',async()=>{
  const denied=setup({owner:'user-b'});const a=res();await denied.handler(req(),a);
  assert.equal(a.code,404);assert.equal(denied.calls.filter(x=>x[0]==='reconcile').length,0);
  const yes=setup();const b=res();await yes.handler(req(),b);
  assert.equal(b.code,200);assert.equal(b.data.confirmed,true);assert.equal(yes.calls[1][1].orderId,orderId);
  const pending=setup({confirmed:false});const c=res();await pending.handler(req(),c);assert.equal(c.code,409);
});
