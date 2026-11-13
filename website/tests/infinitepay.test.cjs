'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const payment = require('../lib/infinitepay');

test('checkout prices are fixed by the selected plan on the server', () => {
  const common = { handle: '$merchant', orderId: 'order-1', siteUrl: 'https://example.com' };
  assert.equal(payment.checkoutPayload({ ...common, plan: 'monthly', amount: 1 }).items[0].price, 3990);
  assert.equal(payment.checkoutPayload({ ...common, plan: 'yearly', amount: 1 }).items[0].price, 40000);
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
  assert.equal(await payment.verifyPayment(input, { fetchImpl: fake({ success: true, paid: true, amount: 3990 }) }), true);
  assert.equal(await payment.verifyPayment(input, { fetchImpl: fake({ success: true, paid: true, amount: 1 }) }), false);
  assert.equal(await payment.verifyPayment(input, { fetchImpl: fake({ success: true, paid: false, amount: 3990 }) }), false);
});
