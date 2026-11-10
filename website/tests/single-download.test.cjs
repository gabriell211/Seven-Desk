'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'script.js'), 'utf8');

test('there is exactly one primary download action', () => {
  assert.equal((html.match(/\bdata-auto-download\b/g) || []).length, 1);
  assert.match(html, /id="download-principal"[^>]*data-auto-download/);
  assert.equal((html.match(/class="[^"]*\bauto-download\b/g) || []).length, 1);
});

test('OS icon replaces arrow inside the one download CTA', () => {
  assert.match(html, /class="download-os-icon"[^>]*data-os-icon/);
  assert.match(js, /osIcon\.src = icons\[selectedPlatform\]/);
  assert.match(js, /downloadButton\.href = selectedPlatform/);
  const button = html.match(/<a id="download-principal"[\s\S]*?<\/a>/)?.[0];
  assert.ok(button, 'primary download button exists');
  assert.doesNotMatch(button, /download-fallback-icon|↗|↘|<svg/);
  assert.match(button, /class="download-button-label"/);
  assert.doesNotMatch(js, /download-fallback-icon/);
});

test('other platforms are selectors, not duplicate download links', () => {
  assert.equal((html.match(/<button type="button" class="platform-card"/g) || []).length, 4);
  assert.equal((html.match(/<a class="platform-card"/g) || []).length, 0);
  assert.match(js, /card\.addEventListener\('click'/);
  assert.match(js, /selectPlatform\(card\.dataset\.platform, true\)/);
});

test('all supported operating systems remain selectable', () => {
  for (const platform of ['windows', 'macos', 'linux', 'android']) {
    assert.match(html, new RegExp('data-platform="' + platform + '"'));
    assert.match(js, new RegExp(platform + ": '/assets/"));
  }
});
