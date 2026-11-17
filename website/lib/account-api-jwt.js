'use strict';

// Managed Neon Auth returns an opaque session identifier from getSession().
// The API must receive a separately issued short-lived JWT from token().
async function jwtAuthorization(auth) {
  if (!auth || typeof auth.token !== 'function') throw new Error('JWT provider unavailable');
  const { data, error } = await auth.token();
  const jwt = data?.token;
  if (error || typeof jwt !== 'string' ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt)) {
    throw new Error('Valid JWT required');
  }
  return `Bearer ${jwt}`;
}

module.exports = { jwtAuthorization };
