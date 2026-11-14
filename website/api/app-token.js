'use strict';

const { Pool } = require('pg');
const { authenticatedUser } = require('../lib/server-auth');
const { createAppTokenHandler } = require('../lib/app-tokens');

let db;
function pool() {
  if (!process.env.DATABASE_URL) throw new Error('Database unavailable');
  if (!db) db = new Pool({ connectionString: process.env.DATABASE_URL, max: 3, idleTimeoutMillis: 5000 });
  return db;
}

module.exports = createAppTokenHandler({
  enabled: () => process.env.SEVEN_ACCOUNT_STATUS_ENABLED === '1' &&
    process.env.SEVEN_LICENSE_API_ENABLED === '1',
  authenticate: authenticatedUser,
  pool,
});
