'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'script.js'), 'utf8');

test('homepage never fabricates a remote session or a published release', () => {
  assert.doesNotMatch(html, /Visualização ilustrativa|Sessão em andamento|class="product-window"/i);
  assert.doesNotMatch(html, /class="release-panel"/);
  assert.match(html, /class="hero-release"/);
  assert.match(html, /data-live-release aria-live="polite"/);
  assert.doesNotMatch(html, /data-live-release[^>]*>\s*v\d/);
});

test('one OS-aware download CTA and four selectors depend on the real manifest', () => {
  for (const platform of ['windows', 'macos', 'linux', 'android']) {
    assert.match(html, new RegExp('data-platform="' + platform + '"'));
  }
  assert.equal((html.match(/\bdata-auto-download\b/g) || []).length, 1);
  assert.match(html, /class="download-notice" aria-live="polite"/);
  assert.match(js, /fetch\('\/api\/download\?format=manifest'\)/);
  assert.match(js, /availableDevices = manifest\.devices/);
  assert.match(js, /renderReleasePanel\(manifest\)/);
  assert.match(js, /renderReleasePanel\(null\)/);
  assert.match(js, /downloadButton\.setAttribute\('aria-disabled', String\(!available\)\)/);
});
