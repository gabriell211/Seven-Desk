'use strict';

let verifier;
async function authenticatedUser(header) {
  if (typeof header !== 'string' || !/^Bearer [^\s]+$/.test(header)) return null;
  const base = new URL(process.env.NEON_AUTH_BASE_URL);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw new Error('Invalid auth configuration');
  if (!verifier) {
    const { createRemoteJWKSet, jwtVerify } = await import('jose');
    const issuer = base.origin;
    const keys = createRemoteJWKSet(new URL(`${base.href.replace(/\/$/, '')}/.well-known/jwks.json`));
    verifier = token => jwtVerify(token, keys, { issuer, algorithms: ['EdDSA'], requiredClaims: ['sub', 'exp', 'iat'] });
  }
  try {
    const { payload } = await verifier(header.slice(7));
    return typeof payload.sub === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.sub) ? payload.sub : null;
  } catch { return null; }
}
module.exports = { authenticatedUser };
