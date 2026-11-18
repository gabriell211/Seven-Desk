'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { configuredGeneration, tokenGeneration, allowedActivation, newTokenPrefix } =
  require('../lib/activation-policy');

const legacy = 'sd_' + 'a'.repeat(43);
const newCode = 'sd2_' + 'b'.repeat(43);

test('legacy credentials remain valid before coordinated release cutover', () => {
  assert.equal(configuredGeneration({}), 1);
  assert.equal(tokenGeneration(legacy), 1);
  assert.equal(tokenGeneration(newCode), 2);
  assert.equal(newTokenPrefix({}), 'sd_');
  assert.equal(allowedActivation(legacy, {}), true);
  assert.equal(allowedActivation(newCode, {}), true);
});

test('generation 2 invalidates every generation-1 credential server-side', () => {
  const env = { SEVEN_ACTIVATION_GENERATION:'2' };
  assert.equal(newTokenPrefix(env), 'sd2_');
  assert.equal(allowedActivation(legacy, env), false);
  assert.equal(allowedActivation(newCode, env), true);
});

test('wrong or malformed generation does not become a fallback bypass', () => {
  assert.equal(tokenGeneration('sd_'), 0);
  assert.equal(tokenGeneration('sd3_' + 'a'.repeat(43)), 0);
  assert.equal(tokenGeneration('sd2_' + 'a'.repeat(44)), 0);
  assert.equal(tokenGeneration('sd2_' + '_'.repeat(43)), 2);
  assert.equal(tokenGeneration('sd2_' + 'a'.repeat(42) + ':'), 0);
  assert.equal(tokenGeneration('sd2_' + 'à'.repeat(43)), 0);
  assert.equal(tokenGeneration(null), 0);
  assert.equal(allowedActivation('sd2_invalid', {}), false);
  for(const invalid of ['0','3','invalid',' 2','2 ']) {
    const env = { SEVEN_ACTIVATION_GENERATION:invalid };
    assert.throws(() => configuredGeneration(env), /Invalid activation generation/);
    assert.throws(() => allowedActivation(newCode, env), /Invalid activation generation/);
    assert.throws(() => newTokenPrefix(env), /Invalid activation generation/);
  }
});
