'use strict';

// Prices are selected on the server, never accepted from the browser.
const PLANS = Object.freeze({
  monthly: Object.freeze({ amount: 3990, description: 'Seven Desk - 1 usuario - 1 mes' }),
  yearly: Object.freeze({ amount: 40000, description: 'Seven Desk - 1 usuario - 1 ano' }),
});
const API = 'https://api.checkout.infinitepay.io';

function requiredText(value, name) {
  if (typeof value !== 'string' || !value.trim() || value.length > 255) {
    throw new Error(`Invalid ${name}`);
  }
  return value.trim();
}

function planFor(code) {
  if (!Object.hasOwn(PLANS, code)) throw new Error('Invalid plan');
  return PLANS[code];
}

function checkoutPayload({ handle, orderId, plan, siteUrl }) {
  const selected = planFor(plan);
  const origin = new URL(requiredText(siteUrl, 'site URL'));
  if (origin.protocol !== 'https:' || origin.username || origin.password ||
      origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Invalid site URL');
  return {
    handle: requiredText(requiredText(handle, 'handle').replace(/^\$/, ''), 'handle'),
    order_nsu: requiredText(orderId, 'order'),
    items: [{ quantity: 1, price: selected.amount, description: selected.description }],
    options: { single_payment: true },
    redirect_url: `${origin.origin}/pagamento-retorno`,
    webhook_url: `${origin.origin}/api/infinitepay-webhook`,
  };
}

async function postJson(path, body, { fetchImpl = fetch, apiKey } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['X-Api-Key'] = apiKey;
  const response = await fetchImpl(`${API}${path}`, {
    method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Payment provider unavailable');
  return response.json();
}

async function createCheckout(input, options) {
  if (!options || typeof options.apiKey !== 'string' || !options.apiKey.trim()) {
    throw new Error('Payment API key is required');
  }
  const result = await postJson('/links', checkoutPayload(input), options);
  let url;
  try { url = new URL(result.url); } catch { throw new Error('Invalid checkout URL'); }
  if (url.protocol !== 'https:' || url.hostname !== 'checkout.infinitepay.com.br' ||
      url.port || url.username || url.password) throw new Error('Invalid checkout URL');
  return url.href;
}

async function verifyPayment({ handle, orderId, transactionId, slug, plan }, options) {
  const selected = planFor(plan);
  const result = await postJson('/payment_check', {
    handle: requiredText(requiredText(handle, 'handle').replace(/^\$/, ''), 'handle'),
    order_nsu: requiredText(orderId, 'order'),
    transaction_nsu: requiredText(transactionId, 'transaction'),
    slug: requiredText(slug, 'invoice'),
  }, options);
  return result.success === true && result.paid === true && result.amount === selected.amount;
}

module.exports = { PLANS, planFor, checkoutPayload, createCheckout, verifyPayment };
