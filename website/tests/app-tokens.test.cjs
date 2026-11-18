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
  const storedHashes = new Map();
  const boundDevices = new Map();
  let count = 0;
  const db = {
    async query(sql, params) {
      if (sql.startsWith('SELECT 5 +')) return {rows:[{max_slots:5}]};
      if (sql.includes('seven_desk_technicians')) return {rows:[]};
      if (sql.includes('INSERT INTO seven_desk_app_tokens')) {
        if (!verified) return { rows: [] };
        storedHashes.set(params[1], params[3]);
        boundDevices.delete(params[1]);
        return { rows: [{ user_id: userId }] };
      }
      if (sql.startsWith('UPDATE seven_desk_app_tokens')) {
        const slot = [...storedHashes].find(([, hash]) => hash === params[0])?.[0];
        if (!verified || !slot || (boundDevices.has(slot) && boundDevices.get(slot) !== params[1])) return {rows:[]};
        boundDevices.set(slot, params[1]);
        return {rows:[{user_id:userId}]};
      }
      if (sql.includes('JOIN seven_users')) {
        return { rows: verified && [...storedHashes.values()].includes(params[0]) ? [{ user_id: userId }] : [] };
      }
      if (sql.startsWith('DELETE')) {
        storedHashes.delete(params[1]);
        boundDevices.delete(params[1]);
        return { rows: [] };
      }
      if (sql.startsWith('SELECT slot')) return { rows: [...storedHashes.keys()].map(slot => ({slot, label:`Técnico ${slot}`})) };
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
function request(method, authorization = 'Bearer session', slot = 1) {
  return { method, headers: { authorization }, body: {slot, label:`Técnico ${slot}`} };
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
  const other = response();
  await handler(request('POST', 'Bearer session', 2), other);
  assert.equal(await appTokenUser(db, 'Bearer ' + other.body.token), userId);
  assert.equal(await appTokenUser(db, 'Bearer sd_invalid'), null);
  const second = response();
  await handler(request('POST'), second);
  assert.equal(second.code, 200);
  assert.equal(await appTokenUser(db, 'Bearer ' + first.body.token), null);
  assert.equal(await appTokenUser(db, 'Bearer ' + second.body.token), userId);
  assert.equal(await appTokenUser(db, 'Bearer ' + other.body.token), userId);
  const revoke = response();
  await handler(request('DELETE'), revoke);
  assert.equal(revoke.body.active, false);
  assert.equal(await appTokenUser(db, 'Bearer ' + second.body.token), null);
  assert.equal(await appTokenUser(db, 'Bearer ' + other.body.token), userId);
});

test('only the five technician slots can be issued', async () => {
  const { handler } = fixture();
  for (let slot = 1; slot <= 5; slot++) {
    const issued = response();
    await handler(request('POST', 'Bearer session', slot), issued);
    assert.equal(issued.code, 200);
  }
  const sixth = response();
  await handler(request('POST', 'Bearer session', 6), sixth);
  assert.equal(sixth.code, 400);
});

test('a valid app token receives paid access only while its account has time remaining', async () => {
  const { db, handler } = fixture();
  const issue = response();
  await handler(request('POST'), issue);
  const device = 'a'.repeat(64);
  const license = createLicenseHandler({
    enabled: () => true,
    authenticate: header => appTokenUser(db, header, true),
    pool: () => db,
    getEntitlement: async () => ({ status: 'paid', access_ends_at: '2026-12-01T00:00:00Z' }),
    now: () => Date.parse('2026-11-14T00:00:00Z'),
  });
  const allowed = response();
  await license(request('GET', 'Bearer ' + issue.body.token + ':' + device), allowed);
  assert.equal(allowed.code, 200);
  assert.equal(allowed.body.allowed, true);
  const copied = response();
  await license(request('GET', 'Bearer ' + issue.body.token + ':' + 'b'.repeat(64)), copied);
  assert.equal(copied.code, 401);
  const noDevice = response();
  await license(request('GET', 'Bearer ' + issue.body.token), noDevice);
  assert.equal(noDevice.code, 401);
  await handler(request('DELETE'), response());
  const denied = response();
  await license(request('GET', 'Bearer ' + issue.body.token + ':' + device), denied);
  assert.equal(denied.code, 401);
});


test('cutover makes old installers lose cloud activation while new tokens stay device-bound', async () => {
  const old = process.env.SEVEN_ACTIVATION_GENERATION;
  try {
    process.env.SEVEN_ACTIVATION_GENERATION = '1';
    const { db, handler } = fixture();
    const oldIssue = response();
    await handler(request('POST'), oldIssue);
    assert.match(oldIssue.body.token, /^sd_[A-Za-z0-9_-]{43}$/);
    assert.equal(await appTokenUser(db, 'Bearer ' + oldIssue.body.token), userId);
    process.env.SEVEN_ACTIVATION_GENERATION = '2';
    assert.equal(await appTokenUser(db, 'Bearer ' + oldIssue.body.token), null);
    assert.equal(await appTokenUser(db, 'Bearer ' + oldIssue.body.token + ':' + 'a'.repeat(64), true), null);
    const newIssue = response();
    await handler(request('POST'), newIssue);
    assert.equal(newIssue.code, 200);
    assert.match(newIssue.body.token, /^sd2_[A-Za-z0-9_-]{43}$/);
    assert.equal(await appTokenUser(db, 'Bearer ' + newIssue.body.token), userId);
    assert.equal(await appTokenUser(db, 'Bearer ' + newIssue.body.token + ':' + 'a'.repeat(64), true), userId);
    assert.equal(await appTokenUser(db, 'Bearer ' + newIssue.body.token + ':' + 'b'.repeat(64), true), null);
  } finally {
    if (old === undefined) delete process.env.SEVEN_ACTIVATION_GENERATION;
    else process.env.SEVEN_ACTIVATION_GENERATION = old;
  }
});
