'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/auth-config');

async function invoke(method, authUrl) {
  const previous = process.env.NEON_AUTH_BASE_URL;
  if (authUrl === undefined) delete process.env.NEON_AUTH_BASE_URL;
  else process.env.NEON_AUTH_BASE_URL = authUrl;
  const response = {
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
  try { await handler({ method }, response); } finally {
    if (previous === undefined) delete process.env.NEON_AUTH_BASE_URL;
    else process.env.NEON_AUTH_BASE_URL = previous;
  }
  return response;
}

test('auth configuration exposes only a valid HTTPS auth URL', async () => {
  const ok = await invoke('GET', 'https://auth.example.test/neondb/auth/');
  assert.equal(ok.code, 200);
  assert.deepEqual(ok.body, { authUrl: 'https://auth.example.test/neondb/auth' });
  assert.equal(ok.headers['Cache-Control'], 'no-store');
  for (const value of [undefined, 'http://auth.example.test/', 'https://user:pass@auth.example.test/', 'https://auth.example.test/?secret=x']) {
    assert.equal((await invoke('GET', value)).code, 503);
  }
  assert.equal((await invoke('PUT', 'https://auth.example.test/')).code, 405);
});

test('webhook POST is disabled by default without exposing auth data', async () => {
  const previous = process.env.SEVEN_AUTH_MAIL_WEBHOOK_ENABLED;
  delete process.env.SEVEN_AUTH_MAIL_WEBHOOK_ENABLED;
  try {
    const response = await invoke('POST', 'https://auth.example.test/');
    assert.equal(response.code, 503);
    assert.deepEqual(response.body,{error:'Envio personalizado indisponível'});
    assert.equal(response.headers['Cache-Control'],'no-store');
  } finally {
    if (previous !== undefined) process.env.SEVEN_AUTH_MAIL_WEBHOOK_ENABLED = previous;
  }
});
