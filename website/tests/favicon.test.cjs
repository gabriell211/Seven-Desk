'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('legacy favicon.ico requests redirect to the official purple SVG favicon', () => {
  const routes = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const redirect = (routes.redirects || []).find(item => item.source === '/favicon.ico');
  assert.deepEqual(redirect, {
    source: '/favicon.ico',
    destination: '/favicon.svg',
    permanent: true,
  });

  const favicon = fs.readFileSync(path.join(root, 'favicon.svg'), 'utf8');
  assert.match(favicon, /<svg\b/);
  assert.match(favicon, /#C575FF/);
  assert.match(favicon, /#6D2BEC/);
  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(home, /rel="icon" type="image\/svg\+xml" href="\/favicon\.svg"/);
});
