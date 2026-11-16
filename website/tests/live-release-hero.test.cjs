'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'script.js'), 'utf8');

test('homepage does not present fabricated remote sessions or a mock application', () => {
  assert.doesNotMatch(html, /Visualização ilustrativa|Sessão em andamento|class="product-window"/i);
  assert.match(html, /class="release-panel"/);
  assert.match(html, /data-live-release aria-live="polite"/);
});

test('release availability is rendered from the same real download manifest as the CTA', () => {
  for (const platform of ['windows','macos','linux','android']) {
    assert.match(html, new RegExp('data-release-platform="' + platform + '"'));
  }
  assert.match(js, /fetch\('\/api\/download\?format=manifest'\)/);
  assert.match(js, /renderReleasePanel\(manifest\)/);
  assert.match(js, /renderReleasePanel\(null\)/);
  assert.match(js, /Object\.values\(architectures\)\.some/);
  assert.doesNotMatch(html, /data-live-release[^>]*>\s*v\d/);
});
