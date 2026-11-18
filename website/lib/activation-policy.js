'use strict';

// Generation 1: installed legacy clients; generation 2: replacement installers.
// Generation 2 is activated ONLY during the coordinated server/release cutover.
// Fail closed on malformed environment configuration, never silently downgrade.
const TOKEN_V1 = /^sd_[A-Za-z0-9_-]{43}$/;
const TOKEN_V2 = /^sd2_[A-Za-z0-9_-]{43}$/;
const GENERATION_ENV = 'SEVEN_ACTIVATION_GENERATION';

function configuredGeneration(env = process.env) {
  const value = env[GENERATION_ENV];
  if (value == null || value === '' || value === '1') return 1;
  if (value === '2') return 2;
  throw new Error('Invalid activation generation configuration');
}

function tokenGeneration(token) {
  if (typeof token !== 'string') return 0;
  if (TOKEN_V2.test(token)) return 2;
  if (TOKEN_V1.test(token)) return 1;
  return 0;
}

function allowedActivation(token, env = process.env) {
  const generation = tokenGeneration(token);
  return generation !== 0 && generation >= configuredGeneration(env);
}

function newTokenPrefix(env = process.env) {
  return configuredGeneration(env) === 2 ? 'sd2_' : 'sd_';
}

module.exports = { TOKEN_V1, TOKEN_V2, configuredGeneration, tokenGeneration, allowedActivation, newTokenPrefix };
