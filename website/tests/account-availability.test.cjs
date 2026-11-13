'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const route = require('../api/account-availability');

function run(env, method = 'GET') {
  const keys = ['SEVEN_ACCOUNT_STATUS_ENABLED', 'SEVEN_REGISTRATION_ENABLED',
    'SEVEN_PASSWORD_RECOVERY_ENABLED', 'NEON_AUTH_BASE_URL'];
  const previous = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  for (const key of keys) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  const result = { headers: {}, setHeader(k,v) { this.headers[k] = v; },
    status(code) { this.code=code; return this; },
    json(body) { this.data=body; return this; } };
  try { route({method}, result); }
  finally { for (const key of keys) {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }}
  return result;
}
test('client account capabilities are disabled by default and require individual approval', () => {
  assert.deepEqual(run({}).data, {loginEnabled:false, registrationEnabled:false, recoveryEnabled:false});
  const env={NEON_AUTH_BASE_URL:'https://auth.example.test',SEVEN_ACCOUNT_STATUS_ENABLED:'1'};
  assert.deepEqual(run(env).data, {loginEnabled:true, registrationEnabled:false, recoveryEnabled:false});
  assert.deepEqual(run({...env, SEVEN_REGISTRATION_ENABLED:'1',SEVEN_PASSWORD_RECOVERY_ENABLED:'1'}).data,
    {loginEnabled:true,registrationEnabled:true,recoveryEnabled:true});
  assert.equal(run({...env,SEVEN_ACCOUNT_STATUS_ENABLED:'0',SEVEN_REGISTRATION_ENABLED:'1'}).data.registrationEnabled,false);
  assert.equal(run(env,'POST').code,405);
  assert.equal(run(env).headers['Cache-Control'],'no-store');
});
