'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { isCheckoutReady } = require('../lib/billing-readiness');

const ready = {
  SEVEN_BILLING_ENABLED: '1',
  SEVEN_WEBHOOK_ENABLED: '1',
  SEVEN_ACCOUNT_STATUS_ENABLED: '1',
  SEVEN_LICENSE_API_ENABLED: '1',
  SEVEN_SALES_LAUNCH_APPROVED: '1',
  SEVEN_DB_HOST:'db', SEVEN_DB_NAME:'sevendesk', SEVEN_DB_USER:'sevendesk_app', SEVEN_DB_PASSWORD_FILE:'/run/secrets/app_db_password',
  SEVEN_AUTH_SECRET_FILE:'/run/secrets/auth_secret', SEVEN_SMTP_PASSWORD_FILE:'/run/secrets/smtp_password',
  INFINITEPAY_HANDLE: 'gabriel_1313',
  INFINITEPAY_API_KEY_FILE: '/run/secrets/infinitepay_api_key',
  SEVEN_SITE_URL: 'https://www.sevendesk.tech',
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
