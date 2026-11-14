'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePlatform, normalizeArch, assetScore, findPackage } = require('../api/download.js')._internal;

const file = (name, size = 1000000) => ({ name, size });
const manifest = {
  version: 'v1.5.3-5',
  files: [
    file('sevendesk-1.5.3-x86_64.exe'),
    file('sevendesk-1.5.3-aarch64.exe'),
    file('sevendesk-1.5.3-x86-sciter.exe'),
    file('rustdesk-1.5.3-x86_64.dmg'),
    file('rustdesk-1.5.3-aarch64.dmg'),
    file('rustdesk-1.5.3-x86_64.deb'),
    file('rustdesk-1.5.3-aarch64.deb'),
    file('rustdesk-1.5.3-universal-signed.apk'),
  ],
};

test('recognizes only supported systems and CPU architectures', () => {
  assert.equal(normalizePlatform('windows'), 'windows');
  assert.equal(normalizePlatform('iOS'), null);
  assert.equal(normalizeArch('AMD64', 'windows'), 'x64');
  assert.equal(normalizeArch('aarch64', 'macos'), 'arm64');
  assert.equal(normalizeArch('i686', 'windows'), 'x86');
  assert.equal(normalizeArch('universal', 'android'), 'universal');
  assert.equal(normalizeArch('invalid', 'windows'), null);
});

test('uses only files listed for the published VPS version', () => {
  const win = findPackage(manifest, 'windows', 'x64');
  assert.equal(win.version, 'v1.5.3-5');
  assert.equal(win.filename, 'sevendesk-1.5.3-x86_64.exe');
  assert.equal(win.url, 'https://downloads.sevendesk.tech/v1.5.3-5/sevendesk-1.5.3-x86_64.exe');
  assert.equal(findPackage(manifest, 'windows', 'arm64').filename, 'sevendesk-1.5.3-aarch64.exe');
  assert.equal(findPackage(manifest, 'windows', 'x86').filename, 'sevendesk-1.5.3-x86-sciter.exe');
  assert.equal(findPackage(manifest, 'macos', 'arm64').filename, 'rustdesk-1.5.3-aarch64.dmg');
  assert.equal(findPackage(manifest, 'linux', 'x64').filename, 'rustdesk-1.5.3-x86_64.deb');
  assert.equal(findPackage(manifest, 'android', 'universal').filename, 'rustdesk-1.5.3-universal-signed.apk');
});

test('prefers Seven Desk filenames when the VPS has both names', () => {
  const both = { version: manifest.version, files: [
    file('rustdesk-1.5.3-x86_64.exe'),
    file('sevendesk-1.5.3-x86_64.exe'),
  ] };
  assert.equal(findPackage(both, 'windows', 'x64').filename, 'sevendesk-1.5.3-x86_64.exe');
});

test('rejects missing, empty, unrelated and unsafe manifest entries', () => {
  assert.equal(assetScore('rustdesk-1.5.3-aarch64.exe', 'windows', 'x64'), -1);
  assert.equal(assetScore('rustdesk-unattended-wayland-1.5.3-x86_64.deb', 'linux', 'x64'), -1);
  assert.equal(assetScore('rustdesk-1.5.3-aarch64.apk', 'android', 'arm64'), -1);
  assert.equal(findPackage({ version: manifest.version, files: [
    file('rustdesk-1.5.3-aarch64-signed.apk'),
  ] }, 'android', 'universal'), null);
  assert.equal(findPackage({ version: '../bad', files: manifest.files }, 'windows', 'x64'), null);
  assert.equal(findPackage({ version: manifest.version, files: [
    file('../sevendesk-1.5.3-x86_64.exe'),
    file('sevendesk-1.5.3-x86_64.exe', 0),
  ] }, 'windows', 'x64'), null);
});
