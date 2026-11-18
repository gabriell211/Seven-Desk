'use strict';

const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const file = name => fs.readFileSync(path.join(root, name), 'utf8');

function boot({stored = null, systemDark = false, blockedStorage = false} = {}) {
  const local = new Map();
  if (stored !== null) local.set('sevendesk.theme', stored);
  const rootNode = {dataset: {}, style: {}};
  const meta = {content: '', setAttribute(key, value) {if (key === 'content') this.content = value;}};
  const controls = Array.from({length: 2}, () => ({
    value: 'system',
    handlers: new Map(),
    addEventListener(name, handler) {this.handlers.set(name, handler);},
    change(value) {this.value = value;this.handlers.get('change')?.();}
  }));
  const documentListeners = new Map();
  const windowListeners = new Map();
  const mediaListeners = new Map();
  const media = {matches: systemDark, addEventListener(name, handler) {mediaListeners.set(name, handler);}};
  const browser = {
    matchMedia: () => media,
    localStorage: {
      getItem(key) {if (blockedStorage) throw new Error('Blocked');return local.get(key) ?? null;},
      setItem(key, value) {if (blockedStorage) throw new Error('Blocked');local.set(key, value);}
    },
    addEventListener(name, handler) {windowListeners.set(name, handler);}
  };
  const document = {
    documentElement: rootNode,
    querySelector(selector) {return selector === 'meta[name="theme-color"]' ? meta : null;},
    querySelectorAll(selector) {return selector === '[data-theme-select]' ? controls : [];},
    addEventListener(name, handler) {documentListeners.set(name, handler);}
  };
  vm.runInNewContext(file('theme.js'), {window: browser, document}, {timeout: 1200});
  documentListeners.get('DOMContentLoaded')();
  return {rootNode, meta, controls, local, media, mediaListeners, windowListeners};
}

test('brand colors are sourced from the Seven Desk purple logo in both modes', () => {
  const css = file('theme.css').toLowerCase();
  assert.match(css, /#c575ff/);
  assert.match(css, /#6d2bec/);
  assert.match(css, /html\[data-theme="light"\]/);
  assert.match(css, /html\[data-theme="dark"\]/);
  for (const selector of ['hero', 'intro', 'feature-section', 'steps-section', 'pricing-section', 'download-section', 'faq-section', 'footer']) {
    assert.ok(css.includes('body .' + selector), selector);
  }
});

test('defaults to OS appearance and updates when OS changes', () => {
  const app = boot({systemDark:true});
  assert.equal(app.rootNode.dataset.theme, 'dark');
  assert.equal(app.rootNode.dataset.themePreference, 'system');
  assert.equal(app.meta.content, '#130d22');
  app.media.matches = false;
  app.mediaListeners.get('change')();
  assert.equal(app.rootNode.dataset.theme, 'light');
  assert.equal(app.meta.content, '#faf7ff');
});

test('manual selection persists and synchronizes controls', () => {
  const app = boot({systemDark:false});
  app.controls[0].change('dark');
  assert.equal(app.local.get('sevendesk.theme'), 'dark');
  assert.equal(app.rootNode.dataset.theme, 'dark');
  assert.deepEqual(app.controls.map(c => c.value), ['dark','dark']);
  app.media.matches = true;
  app.mediaListeners.get('change')();
  assert.equal(app.rootNode.dataset.theme, 'dark');
  app.controls[1].change('light');
  assert.equal(app.rootNode.dataset.theme, 'light');
  assert.deepEqual(app.controls.map(c => c.value), ['light','light']);
});

test('restores saved preferences and reacts to another tab', () => {
  const app = boot({stored:'light', systemDark:true});
  assert.equal(app.rootNode.dataset.theme, 'light');
  app.local.set('sevendesk.theme','dark');
  app.windowListeners.get('storage')({key:'sevendesk.theme'});
  assert.equal(app.rootNode.dataset.theme, 'dark');
  assert.deepEqual(app.controls.map(c => c.value), ['dark','dark']);
});

test('works with blocked localStorage and does not persist invalid modes', () => {
  const app = boot({blockedStorage:true, systemDark:false});
  assert.equal(app.rootNode.dataset.theme,'light');
  app.controls[0].change('dark');
  assert.equal(app.rootNode.dataset.theme,'dark');
  app.controls[0].change('not-a-theme');
  assert.equal(app.rootNode.dataset.theme,'dark');
});

test('public build contains assets; all core pages load the shared selector', () => {
  const build = file('build-site.cjs');
  assert.match(build, /'theme\.css', 'theme\.js'/);
  for (const name of ['index.html','conta.html','privacidade.html','licencas.html','pagamento-retorno.html']) {
    const html = file(name);
    assert.match(html, /data-theme="light"/, name);
    assert.match(html, /theme\.js\?v=20261118a/, name);
    assert.match(html, /theme\.css\?v=20261118a/, name);
    assert.match(html, /data-theme-select/, name);
    const jsAt = html.indexOf('/theme.js?v=20261118a');
    const stylesAt = html.indexOf('/styles.css');
    assert.ok(jsAt>=0 && stylesAt>jsAt, name+' theme boot before CSS');
  }
});

test('authentication and download handlers stay wired', () => {
  assert.match(file('index.html'), /\bdata-auto-download\b/);
  assert.match(file('index.html'), /data-platform="windows"/);
  assert.match(file('conta.html'), /id="account-form"/);
  assert.match(file('conta.html'), /id="account-signed-out"/);
  assert.match(file('conta.html'), /id="account-signed-in"/);
  assert.match(file('pagamento-retorno.html'), /pagamento-retorno\.bundle\.js/);
});
