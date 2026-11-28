'use strict';

const {TEAM_PLANS}=require('./team-workspaces');

// Prices are selected on the server, never accepted from the browser.
const PLANS = Object.freeze({
  monthly: Object.freeze({ amount: 1990, description: 'Seven Desk - 1 usuario - 1 mes' }),
  yearly: Object.freeze({ amount: 19990, description: 'Seven Desk - 1 usuario - 1 ano' }),
  business: Object.freeze({ amount: TEAM_PLANS.business.amount, description: 'Seven Desk Business - 3 tecnicos - 1 mes' }),
  enterprise: Object.freeze({ amount: TEAM_PLANS.enterprise.amount, description: 'Seven Desk Enterprise - 10 tecnicos - 1 mes' }),
  extra_slot: Object.freeze({ amount: 700, description: 'Seven Desk - slot adicional - 1 computador' }),
});
const API = 'https://api.checkout.infinitepay.io';
const TRUSTED_CHECKOUT_HOSTS = new Set(['checkout.infinitepay.io', 'checkout.infinitepay.com.br']);

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

// Existing orders keep their original agreed price; never accept a browser-supplied amount.
function validOrderAmount(plan, amount) {
  if (!Object.hasOwn(PLANS, plan) || !Number.isSafeInteger(amount)) return false;
  return amount === PLANS[plan].amount ||
    (plan === 'monthly' && amount === 3990) ||
    (plan === 'yearly' && amount === 40000);
}

function checkoutPayload({ handle, orderId, plan, siteUrl }) {
  const selected = planFor(plan);
  const origin = new URL(requiredText(siteUrl, 'site URL'));
  if (origin.protocol !== 'https:' || origin.username || origin.password ||
      origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Invalid site URL');
  return {
    handle: requiredText(requiredText(handle, 'handle').replace(/^\\$/, ''), 'handle'),
    order_nsu: requiredText(orderId, 'order'),
    items: [{ quantity: 1, price: selected.amount, description: selected.description }],
    options: { single_payment: true, valid_until: new Date(Date.now() + 30 * 60_000).toISOString() },
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
  if (!response.ok) {
    // Classify only the known safe provider code; never return provider bodies
    // to users or log API keys, customer data, or full responses.
    if (path === '/links' && response.status >= 400 && response.status < 500) {
      const failure = await response.json().catch(() => null);
      if (failure?.error === 'external_checkout_not_enabled') {
        const error = new Error('Integrated checkout is disabled by payment provider');
        error.code = 'CHECKOUT_INTEGRATION_DISABLED';
        throw error;
      }
    }
    throw new Error('Payment provider unavailable');
  }
  return response.json();
}

async function createCheckout(input, options) {
  if (!options || typeof options.apiKey !== 'string' || !options.apiKey.trim()) {
    throw new Error('Payment API key is required');
  }
  const result = await postJson('/links', checkoutPayload(input), options);
  let url;
  try { url = new URL(result.url); } catch { throw new Error('Invalid checkout URL'); }
  if (url.protocol !== 'https:' || !TRUSTED_CHECKOUT_HOSTS.has(url.hostname) ||
      url.port || url.username || url.password) throw new Error('Invalid checkout URL');
  return url.href;
}

async function verifyPayment({ handle, orderId, transactionId, slug, plan, orderAmount }, options) {
  const expected = orderAmount === undefined ? planFor(plan).amount : orderAmount;
  if (!validOrderAmount(plan, expected)) return false;
  const result = await postJson('/payment_check', {
    handle: requiredText(requiredText(handle, 'handle').replace(/^\\$/, ''), 'handle'),
    order_nsu: requiredText(orderId, 'order'),
    transaction_nsu: requiredText(transactionId, 'transaction'),
    slug: requiredText(slug, 'invoice'),
  }, options);
  return result.success === true && result.paid === true && result.amount === expected;
}

module.exports = { PLANS, planFor, validOrderAmount, checkoutPayload, createCheckout, verifyPayment };
