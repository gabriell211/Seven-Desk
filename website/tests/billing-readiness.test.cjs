'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { isCheckoutReady } = require('../lib/billing-readiness');

const ready = {
  SEVEN_BILLING_ENABLED: '1',
  SEVEN_WEBHOOK_ENABLED: '1',
  SEVEN_ACCOUNT_STATUS_ENABLED: '1',
  SEVEN_SALES_LAUNCH_APPROVED: '1',
  DATABASE_URL: 'postgres://example.invalid/db',
  NEON_AUTH_BASE_URL: 'https://auth.example.test',
  INFINITEPAY_HANDLE: 'gabriel_1313',
  INFINITEPAY_API_KEY: 'secret',
  SEVEN_SITE_URL: 'https://seven-desk-site.vercel.app',
};

test('sales stay disabled unless every production prerequisite is explicitly set', () => {
  assert.equal(isCheckoutReady(ready), true);
  assert.equal(isCheckoutReady({}), false);
  for (const key of Object.keys(ready)) {
    assert.equal(isCheckoutReady({ ...ready, [key]: '' }), false, key);
  }
  assert.equal(isCheckoutReady({ ...ready, SEVEN_SITE_URL: 'http://unsafe.test' }), false);
  assert.equal(isCheckoutReady({ ...ready, SEVEN_SITE_URL: 'https://example.com/other' }), false);
  assert.equal(isCheckoutReady({ ...ready, SEVEN_SITE_URL: 'https://example.com/?redirect=https://evil.test' }), false);
});
