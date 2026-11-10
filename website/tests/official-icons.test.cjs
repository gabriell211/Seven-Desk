'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const platforms = ['windows', 'macos', 'linux', 'android'];

for (const name of platforms) {
  test(name + ' icon is a valid standalone SVG resource', () => {
    const contents = fs.readFileSync(path.join(root, 'assets', name + '.svg'), 'utf8');
    assert.match(contents, /^\s*<svg\b[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, 'standalone SVGs require the correct namespace');
    assert.match(contents, /<path\b/, 'SVG must contain its original icon artwork');
    assert.match(contents, /<\/svg>\s*$/);
  });
}

test('download cards reference official icon assets', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const name of platforms) {
    assert.match(html, new RegExp('src="/assets/' + name + '\\.svg(?:\\?v=\\d+)?"'));
  }
});
