'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const server = require('../server');

test('VPS server preserves account API and rejects unsafe paths', async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const availability = await fetch(base + '/api/account-availability');
    assert.equal(availability.status, 200);
    assert.equal((await availability.json()).loginEnabled, false);
    const missing = await fetch(base + '/api/not-a-route');
    assert.equal(missing.status, 404);
    const avatar = await fetch(base + '/api/avatar-upload', {method:'POST', body:'not-an-image'});
    assert.equal(avatar.status, 503);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
