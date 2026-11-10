'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePlatform, normalizeArch, assetScore, findPackage } = require('../api/download.js')._internal;

const url = name => 'https://github.com/gabriell211/Seven-Desk/releases/download/v1.5.3-4/' + name;
const asset = (name, options = {}) => ({
  name,
  size: options.size ?? 1000000,
  browser_download_url: options.url ?? url(name),
});
const releases = [
  { tag_name: 'v1.5.3-5', draft: false, assets: [] },
  { tag_name: 'v1.5.3-4', draft: false, assets: [
    asset('rustdesk-1.5.3-x86_64.exe'),
    asset('rustdesk-1.5.3-aarch64.exe'),
    asset('rustdesk-1.5.3-x86-sciter.exe'),
    asset('rustdesk-1.5.3-x86_64.dmg'),
    asset('rustdesk-1.5.3-aarch64.dmg'),
    asset('rustdesk-1.5.3-x86_64.deb'),
    asset('rustdesk-1.5.3-aarch64.deb'),
    asset('rustdesk-1.5.3-universal.apk'),
  ] },
];

test('recognizes only supported systems and CPU architectures', () => {
  assert.equal(normalizePlatform('windows'), 'windows');
  assert.equal(normalizePlatform('iOS'), null);
  assert.equal(normalizeArch('AMD64', 'windows'), 'x64');
  assert.equal(normalizeArch('aarch64', 'macos'), 'arm64');
  assert.equal(normalizeArch('i686', 'windows'), 'x86');
  assert.equal(normalizeArch('universal', 'android'), 'universal');
  assert.equal(normalizeArch('invalid', 'windows'), null);
});

test('falls back to the most recent release that actually includes the required binary', () => {
  const win = findPackage(releases, 'windows', 'x64');
  assert.equal(win.version, 'v1.5.3-4');
  assert.equal(win.filename, 'rustdesk-1.5.3-x86_64.exe');
  assert.equal(findPackage(releases, 'windows', 'arm64').filename, 'rustdesk-1.5.3-aarch64.exe');
  assert.equal(findPackage(releases, 'windows', 'x86').filename, 'rustdesk-1.5.3-x86-sciter.exe');
  assert.equal(findPackage(releases, 'macos', 'arm64').filename, 'rustdesk-1.5.3-aarch64.dmg');
  assert.equal(findPackage(releases, 'linux', 'x64').filename, 'rustdesk-1.5.3-x86_64.deb');
  assert.equal(findPackage(releases, 'android', 'universal').filename, 'rustdesk-1.5.3-universal.apk');
});

test('prefers the new Seven Desk branding within the same release', () => {
  const data = [{ tag_name: 'v1.5.3-5', draft: false, assets: [
    asset('rustdesk-1.5.3-x86_64.exe'),
    asset('sevendesk-1.5.3-x86_64.exe'),
  ] }];
  assert.equal(findPackage(data, 'windows', 'x64').filename, 'sevendesk-1.5.3-x86_64.exe');
});

test('does not redirect to unrelated files, wrong architecture or untrusted URLs', () => {
  assert.equal(assetScore('rustdesk-1.5.3-aarch64.exe', 'windows', 'x64'), -1);
  assert.equal(assetScore('rustdesk-unattended-wayland-1.5.3-x86_64.deb', 'linux', 'x64'), -1);
  assert.equal(findPackage([{
    tag_name: 'v1.5.3-5', draft: false, assets: [
      asset('sevendesk-1.5.3-x86_64.exe', { url: 'https://untrusted.example/file.exe' }),
      asset('sevendesk-1.5.3-x86_64.exe', { size: 0 }),
    ],
  }], 'windows', 'x64'), null);
});
