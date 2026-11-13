'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createBillingHandlers } = require('../lib/billing-routes');

function response() { return { headers: {}, setHeader(k,v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } }; }
function setup(overrides = {}) {
  const calls = [];
  const db = { query: async (...args) => calls.push(['query', ...args]) };
  const handlers = createBillingHandlers({
    checkoutEnabled: () => true, webhookEnabled: () => true,
    authenticate: async header => header === 'Bearer valid' ? 'verified-user' : null,
    pool: () => db,
    createOrder: async (_db, user, plan) => { calls.push(['order', user, plan]); return 'order-1'; },
    createCheckout: async (input, options) => { calls.push(['checkout', input, options]); return 'https://checkout.infinitepay.com.br/test'; },
    reconcilePayment: async (_db, event) => { calls.push(['verify', event]); return true; },
    config: () => ({ handle: 'merchant', apiKey: 'server-secret', siteUrl: 'https://example.test' }),
    ...overrides,
  });
  return { handlers, calls };
}

test('checkout is disabled by default gate and rejects unauthenticated requests', async () => {
  const disabled = setup({ checkoutEnabled: () => false });
  const first = response(); await disabled.handlers.checkout({ method: 'POST', headers: {} }, first);
  assert.equal(first.code, 503); assert.equal(disabled.calls.length, 0);
  const { handlers, calls } = setup();
  const denied = response(); await handlers.checkout({ method: 'POST', headers: {}, body: { plan: 'monthly' } }, denied);
  assert.equal(denied.code, 401); assert.equal(calls.length, 0);
});

test('checkout uses the verified user and server-selected plan only', async () => {
  const { handlers, calls } = setup();
  const req = { method: 'POST', headers: { authorization: 'Bearer valid' }, body: { plan: 'yearly', userId: 'attacker-choice', amount: 1 } };
  const res = response(); await handlers.checkout(req, res);
  assert.equal(res.code, 200);
  assert.deepEqual(calls[0], ['order', 'verified-user', 'yearly']);
  assert.equal(calls[1][1].plan, 'yearly');
  assert.equal(calls[1][1].amount, undefined);
  assert.equal(res.data.url, 'https://checkout.infinitepay.com.br/test');
  const bad = response(); await handlers.checkout({ ...req, body: { plan: 'custom' } }, bad);
  assert.equal(bad.code, 400);
});

test('webhook grants no success before provider verification', async () => {
  const { handlers, calls } = setup({ reconcilePayment: async (_db, event) => { calls.push(['verify', event]); return false; } });
  const req = { method: 'POST', body: { order_nsu: 'order-1', transaction_nsu: 'tx-1', invoice_slug: 'invoice-1', paid: true } };
  const res = response(); await handlers.webhook(req, res);
  assert.equal(res.code, 400);
  assert.deepEqual(calls[0], ['verify', { orderId: 'order-1', transactionId: 'tx-1', slug: 'invoice-1' }]);
  const missing = response(); await handlers.webhook({ method: 'POST', body: {} }, missing);
  assert.equal(missing.code, 400);
  const disabled = setup({ webhookEnabled: () => false });
  const off = response(); await disabled.handlers.webhook(req, off);
  assert.equal(off.code, 503); assert.equal(disabled.calls.length, 0);
});
