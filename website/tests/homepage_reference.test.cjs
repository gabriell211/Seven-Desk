'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const webRoot = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(webRoot, name), 'utf8');

test('homepage mirrors the approved centered layout without an obsolete side panel', () => {
  const html = read('index.html');
  assert.match(html, /<h1 id="hero-title">Controle remoto do seu computador de/);
  assert.match(html, /class="pricing-banner"/);
  assert.match(html, /class="platform-quickbar"/);
  assert.doesNotMatch(html, /class="release-panel"/);
  assert.match(html, /href="\/homepage\.css\?v=20261118c"/);
});

test('download remains a single OS-aware action with honest availability', () => {
  const html = read('index.html');
  const script = read('script.js');
  assert.equal((html.match(/\bdata-auto-download\b/g) || []).length, 1);
  assert.match(html, /data-live-release/);
  assert.match(html, /data-release-source/);
  assert.match(html, /data-os-name/);
  assert.match(script, /\/api\/download\?format=manifest/);
  for (const system of ['windows', 'macos', 'linux', 'android']) {
    assert.match(html, new RegExp('data-platform="' + system + '"'));
  }
});

test('accessible navigation, account and legal links are retained', () => {
  const html = read('index.html');
  assert.match(html, /id="menu-toggle"[^>]*aria-expanded="false"/);
  assert.match(html, /id="mobile-navigation"[^>]*hidden/);
  for (const route of ['/entrar', '/cadastro', '/licencas', '/privacidade']) {
    assert.ok(html.includes('href="' + route + '"'), route);
  }
});

test('production bundler copies the new stylesheet alongside the homepage', () => {
  const build = read('build-site.cjs');
  const css = read('homepage.css');
  assert.match(build, /'styles\.css', 'homepage\.css', 'script\.js'/);
  assert.match(css, /\.hero \.hero-grid/);
  assert.match(css, /\.platform-quickbar button img/);
  assert.match(css, /filter:brightness\(0\);opacity:\.7/);
});
