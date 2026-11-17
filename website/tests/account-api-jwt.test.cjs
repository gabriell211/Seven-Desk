'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { jwtAuthorization } = require('../lib/account-api-jwt');

const JWT = 'eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJ0ZXN0In0.mock_signature';

test('requests a Neon Auth signed JWT rather than an opaque session token', async () => {
  let count = 0;
  const auth = {
    token: async () => { count++; return {data: {token: JWT}, error: null}; },
    getSession: async () => { throw new Error('Opaque session must not be used as API credential'); },
  };
  assert.equal(await jwtAuthorization(auth), 'Bearer ' + JWT);
  assert.equal(count, 1);
});

test('rejects invalid credentials, missing plugin and session-like tokens', async () => {
  for (const auth of [
    undefined, {}, {token: async () => ({error: new Error('expired')})},
    {token: async () => ({data: {token:'opaque-better-auth-session'}})},
    {token: async () => ({data: {token:'abc.def'}})},
    {token: async () => ({data: {token: 'Bearer '+JWT}})},
    {token: async () => ({data: {token: JWT+'\nX-Header: injected'}})},
  ]) {
    await assert.rejects(jwtAuthorization(auth));
  }
});

test('subscription, checkout, activation, avatar and payment return use JWT authorization', () => {
  const root = join(__dirname, '..');
  const source = readFileSync(join(root, 'conta.js'),'utf8');
  const returnPage = readFileSync(join(root, 'pagamento-retorno.js'),'utf8');
  assert.doesNotMatch(source,/data\?\.session\?\.token/);
  assert.doesNotMatch(returnPage,/data\?\.session\?\.token/);
  assert.match(source,/async function appAuthorization\(\)\s*\{\s*return jwtAuthorization\(auth\)/);
  assert.match(source,/fetch\('\/api\/subscription',[\s\S]*?Authorization:\s*await appAuthorization\(\)/);
  assert.match(source,/fetch\('\/api\/checkout',[\s\S]*?Authorization:await appAuthorization\(\)/);
  assert.match(source,/fetch\('\/api\/app-token',[\s\S]*?await appAuthorization\(\)/);
  assert.match(source,/fetch\('\/api\/avatar-upload',[\s\S]*?await appAuthorization\(\)/);
  assert.match(returnPage,/fetch\('\/api\/confirm-payment',[\s\S]*?Authorization:\s*await jwtAuthorization\(auth\)/);
  assert.match(returnPage,/data\?\.user\?\.emailVerified !== true/);
});
