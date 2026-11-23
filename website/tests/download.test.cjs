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
    file('sevendesk-1.5.3-x86_64.dmg'),
    file('sevendesk-1.5.3-aarch64.dmg'),
    file('sevendesk-1.5.3-x86_64.deb'),
    file('sevendesk-1.5.3-aarch64.deb'),
    file('sevendesk-1.5.3-x86_64.AppImage'),
    file('sevendesk-1.5.3-aarch64.AppImage'),
    file('sevendesk-1.5.3-universal-signed.apk'),
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
  assert.equal(findPackage(manifest, 'macos', 'arm64').filename, 'sevendesk-1.5.3-aarch64.dmg');
  assert.equal(findPackage(manifest, 'linux', 'x64').filename, 'sevendesk-1.5.3-x86_64.AppImage');
  assert.equal(findPackage(manifest, 'linux', 'arm64').filename, 'sevendesk-1.5.3-aarch64.AppImage');
  assert.equal(findPackage(manifest, 'android', 'universal').filename, 'sevendesk-1.5.3-universal-signed.apk');
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


test('Windows main download is a portable EXE, never a mandatory installer', () => {
  const mixed = {version: manifest.version, files: [
    file('sevendesk-1.5.3-x86_64.msi'),
    file('sevendesk-1.5.3-x86_64.exe'),
  ]};
  assert.equal(findPackage(mixed, 'windows', 'x64').filename,
    'sevendesk-1.5.3-x86_64.exe');
  assert.equal(findPackage({version: manifest.version,
    files: [file('sevendesk-1.5.3-x86_64.msi')]}, 'windows', 'x64'), null);
});

test('Linux download never presents an installing DEB/RPM as a portable executable', () => {
  const debOnly = {version: manifest.version, files: [
    file('sevendesk-1.5.3-x86_64.deb'),
    file('sevendesk-1.5.3-x86_64.rpm'),
  ]};
  assert.equal(findPackage(debOnly, 'linux', 'x64'), null);
  const mixed = {version: manifest.version, files: [
    file('sevendesk-1.5.3-x86_64.deb'),
    file('sevendesk-1.5.3-x86_64.AppImage'),
  ]};
  assert.equal(findPackage(mixed, 'linux', 'x64').filename,
    'sevendesk-1.5.3-x86_64.AppImage');
  assert.equal(assetScore('sevendesk-unattended-wayland-1.5.3-x86_64.AppImage',
    'linux', 'x64'), -1);
});

test('macOS download stays a DMG application and does not select PKG installers', () => {
  const onlyInstaller = {version: manifest.version,
    files: [file('sevendesk-1.5.3-x86_64.pkg')]};
  assert.equal(findPackage(onlyInstaller, 'macos', 'x64'), null);
  const mix = {version: manifest.version, files: [
    file('sevendesk-1.5.3-x86_64.pkg'),
    file('sevendesk-1.5.3-x86_64.dmg'),
  ]};
  assert.equal(findPackage(mix, 'macos', 'x64').filename,
    'sevendesk-1.5.3-x86_64.dmg');
});


function testResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; },
    end() { return this; },
  };
}

function freshHandler() {
  const key = require.resolve('../api/download.js');
  delete require.cache[key];
  return require(key);
}

const windowsRelease = {
  version: 'v1.5.4',
  scope: 'windows',
  status: 'windows_released',
  source_commit: '8cf8dafb97973f15a1401d375d640edaddef7f23',
  build_run_id: 44547031234,
  files: ['x86_64', 'aarch64'].flatMap(arch => ['exe', 'msi'].map(ext => ({
    name: 'sevendesk-1.5.4-' + arch + '.' + ext,
    size: 25000000,
    sha256: 'a'.repeat(64),
  }))),
};

test('homepage download API accepts independently published Windows manifest', async () => {
  const previousFetch = global.fetch;
  const requested = [];
  global.fetch = async url => {
    requested.push(url);
    if (url.endsWith('/manifest.json') && !url.endsWith('/windows/manifest.json')) {
      return {ok: false, status: 404};
    }
    return {ok: true, status: 200, json: async () => windowsRelease};
  };
  try {
    const handler = freshHandler();
    const json = testResponse();
    await handler({method: 'GET', query: {format: 'manifest'}}, json);
    assert.equal(json.statusCode, 200);
    assert.equal(json.body.latestRelease, 'v1.5.4');
    assert.equal(json.body.devices.windows.x64.filename, 'sevendesk-1.5.4-x86_64.exe');
    assert.equal(json.body.devices.windows.arm64.filename, 'sevendesk-1.5.4-aarch64.exe');
    assert.equal(json.body.devices.linux.x64, null);
    assert.equal(json.body.devices.macos.arm64, null);
    assert.equal(json.body.devices.android.universal, null);
    const windows = testResponse();
    await handler({method: 'GET', query: {platform: 'windows', arch: 'x64'}}, windows);
    assert.equal(windows.statusCode, 302);
    assert.equal(windows.headers.Location,
      'https://downloads.sevendesk.tech/windows/v1.5.4/sevendesk-1.5.4-x86_64.exe');
    const arm = testResponse();
    await handler({method: 'GET', query: {platform: 'windows', arch: 'arm64'}}, arm);
    assert.equal(arm.statusCode, 302);
    assert.match(arm.headers.Location, /aarch64\.exe$/);
    const linux = testResponse();
    await handler({method: 'GET', query: {platform: 'linux', arch: 'x64'}}, linux);
    assert.equal(linux.statusCode, 404);
    assert.deepEqual(requested, [
      'https://downloads.sevendesk.tech/manifest.json',
      'https://downloads.sevendesk.tech/windows/manifest.json',
    ]);
  } finally {
    global.fetch = previousFetch;
  }
});

test('invalid Windows-only manifest does not enable homepage buttons', async () => {
  const previousFetch = global.fetch;
  global.fetch = async url => url.endsWith('/windows/manifest.json')
    ? {ok: true, json: async () => ({...windowsRelease, status: 'QA_NOT_HOMOLOGATED'})}
    : {ok: false, status: 404};
  try {
    const handler = freshHandler();
    const response = testResponse();
    await handler({method: 'GET', query: {format: 'manifest'}}, response);
    assert.equal(response.statusCode, 503);
    assert.equal(response.headers['Cache-Control'], 'no-store');
  } finally {
    global.fetch = previousFetch;
  }
});

test('complete multi-platform release takes priority over Windows fallback', async () => {
  const previousFetch = global.fetch;
  const calls = [];
  global.fetch = async url => {
    calls.push(url);
    return {ok: true, json: async () => manifest};
  };
  try {
    const handler = freshHandler();
    const json = testResponse();
    await handler({method: 'GET', query: {format: 'manifest'}}, json);
    assert.equal(json.statusCode, 200);
    assert.equal(json.body.latestRelease, 'v1.5.3-5');
    assert.equal(json.body.devices.linux.x64.filename, 'sevendesk-1.5.3-x86_64.AppImage');
    assert.deepEqual(calls, ['https://downloads.sevendesk.tech/manifest.json']);
  } finally {
    global.fetch = previousFetch;
  }
});
