'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/auth-config');

function invoke(method, authUrl) {
  const previous = process.env.NEON_AUTH_BASE_URL;
  if (authUrl === undefined) delete process.env.NEON_AUTH_BASE_URL;
  else process.env.NEON_AUTH_BASE_URL = authUrl;
  const response = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  try { handler({ method }, response); } finally {
    if (previous === undefined) delete process.env.NEON_AUTH_BASE_URL;
    else process.env.NEON_AUTH_BASE_URL = previous;
  }
  return response;
}

test('auth configuration exposes only a valid HTTPS auth URL', () => {
  const ok = invoke('GET', 'https://auth.example.test/neondb/auth/');
  assert.equal(ok.code, 200);
  assert.deepEqual(ok.body, { authUrl: 'https://auth.example.test/neondb/auth' });
  assert.equal(ok.headers['Cache-Control'], 'no-store');
  for (const value of [undefined, 'http://auth.example.test/', 'https://user:pass@auth.example.test/', 'https://auth.example.test/?secret=x']) {
    assert.equal(invoke('GET', value).code, 503);
  }
  assert.equal(invoke('POST', 'https://auth.example.test/').code, 405);
});
