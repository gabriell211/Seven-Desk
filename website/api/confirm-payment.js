'use strict';
const { Pool } = require('pg');
const { authenticatedUser } = require('../lib/server-auth');
const { reconcilePayment } = require('../lib/billing');
const { createConfirmPaymentHandler } = require('../lib/confirm-payment');
let db;

module.exports = createConfirmPaymentHandler({
  enabled: () => process.env.SEVEN_WEBHOOK_ENABLED === '1' &&
    process.env.SEVEN_ACCOUNT_STATUS_ENABLED === '1',
  authenticate: authenticatedUser,
  pool: () => {
    if (!process.env.DATABASE_URL) throw new Error('Missing database configuration');
    if (!db) db = new Pool({ connectionString: process.env.DATABASE_URL, max: 3, idleTimeoutMillis: 5000 });
    return db;
  },
  reconcilePayment,
  config: () => ({
    handle: process.env.INFINITEPAY_HANDLE,
    apiKey: process.env.INFINITEPAY_API_KEY,
  }),
});
