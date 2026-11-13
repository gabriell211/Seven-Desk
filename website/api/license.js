'use strict';
const { Pool } = require('pg');
const { authenticatedUser } = require('../lib/server-auth');
const { getEntitlement } = require('../lib/billing');
const { createLicenseHandler } = require('../lib/license-routes');

let pool;
module.exports = createLicenseHandler({
  enabled: () => process.env.SEVEN_ACCOUNT_STATUS_ENABLED === '1' &&
    process.env.SEVEN_LICENSE_API_ENABLED === '1',
  authenticate: authenticatedUser,
  pool: () => {
    if (!process.env.DATABASE_URL) throw new Error('Database unavailable');
    if (!pool) pool = new Pool({connectionString: process.env.DATABASE_URL, max:3, idleTimeoutMillis:5000});
    return pool;
  },
  getEntitlement,
});
