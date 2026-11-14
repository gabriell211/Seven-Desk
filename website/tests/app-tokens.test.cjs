'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { appTokenUser, createAppTokenHandler } = require('../lib/app-tokens');
const { createLicenseHandler } = require('../lib/license-routes');

const userId = 'bbde939e-b2c5-45f5-9dc0-6645f59d78cf';
function response() {
  return { headers: {}, setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; } };
}
function fixture({ enabled = true, verified = true } = {}) {
  let storedHash;
  let count = 0;
  const db = {
    async query(sql, params) {
      if (sql.includes('INSERT INTO seven_desk_app_tokens')) {
        if (!verified) return { rows: [] };
        storedHash = params[1];
        return { rows: [{ user_id: userId }] };
      }
      if (sql.includes('JOIN neon_auth."user"')) {
        return { rows: verified && params[0] === storedHash ? [{ user_id: userId }] : [] };
      }
      if (sql.startsWith('DELETE')) {
        storedHash = undefined;
        return { rows: [] };
      }
      if (sql.startsWith('SELECT 1')) return { rows: storedHash ? [{}] : [] };
      throw new Error('Unexpected query');
    },
  };
  const handler = createAppTokenHandler({
    enabled: () => enabled,
    authenticate: async header => header === 'Bearer session' ? userId : null,
    pool: () => db,
    random: () => Buffer.alloc(32, ++count),
  });
  return { db, handler };
}
function request(method, authorization = 'Bearer session') {
  return { method, headers: { authorization } };
}

test('app activation is gated and requires a verified account', async () => {
  const off = response();
  await fixture({ enabled: false }).handler(request('POST'), off);
  assert.equal(off.code, 503);
  assert.equal(off.headers['Cache-Control'], 'no-store');
  const anonymous = response();
  await fixture().handler(request('POST', ''), anonymous);
  assert.equal(anonymous.code, 401);
  const unverified = response();
  await fixture({ verified: false }).handler(request('POST'), unverified);
  assert.equal(unverified.code, 403);
});

test('rotating and revoking an app token changes the server access decision', async () => {
  const { db, handler } = fixture();
  const first = response();
  await handler(request('POST'), first);
  assert.equal(first.code, 200);
  assert.match(first.body.token, /^sd_[A-Za-z0-9_-]{43}$/);
  assert.equal(await appTokenUser(db, 'Bearer ' + first.body.token), userId);
  assert.equal(await appTokenUser(db, 'Bearer sd_invalid'), null);
  const second = response();
  await handler(request('POST'), second);
  assert.equal(second.code, 200);
  assert.equal(await appTokenUser(db, 'Bearer ' + first.body.token), null);
  assert.equal(await appTokenUser(db, 'Bearer ' + second.body.token), userId);
  const revoke = response();
  await handler(request('DELETE'), revoke);
  assert.equal(revoke.body.active, false);
  assert.equal(await appTokenUser(db, 'Bearer ' + second.body.token), null);
});

test('a valid app token receives paid access only while its account has time remaining', async () => {
  const { db, handler } = fixture();
  const issue = response();
  await handler(request('POST'), issue);
  const license = createLicenseHandler({
    enabled: () => true,
    authenticate: header => appTokenUser(db, header),
    pool: () => db,
    getEntitlement: async () => ({ status: 'paid', access_ends_at: '2026-12-01T00:00:00Z' }),
    now: () => Date.parse('2026-11-14T00:00:00Z'),
  });
  const allowed = response();
  await license(request('GET', 'Bearer ' + issue.body.token), allowed);
  assert.equal(allowed.code, 200);
  assert.equal(allowed.body.allowed, true);
  await handler(request('DELETE'), response());
  const denied = response();
  await license(request('GET', 'Bearer ' + issue.body.token), denied);
  assert.equal(denied.code, 401);
});
