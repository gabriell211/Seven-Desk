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
  assert.match(html, /href="\/homepage\.css\?v=20261118e"/);
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
  for (const route of ['/entrar', '/cadastro', '/licencas.html', '/privacidade.html']) {
    assert.ok(html.includes('href="' + route + '"'), route);
  }
});

test('production bundler copies the new stylesheet alongside the homepage', () => {
  const build = read('build-site.cjs');
  const css = read('homepage.css');
  assert.match(build, /'styles\.css', 'homepage\.css', 'theme\.css', 'theme\.js', 'script\.js'/);
  assert.match(css, /\.hero \.hero-grid/);
  assert.match(css, /\.platform-quickbar button img/);
  assert.match(css, /filter:brightness\(0\);opacity:\.7/);
});


test('the entire landing page uses one reference-led visual system', () => {
  const html = read('index.html');
  const css = read('homepage.css');
  const sections = ['solucoes', 'recursos', 'como-funciona', 'planos', 'plataformas', 'perguntas'];
  for (const id of sections) assert.equal((html.match(new RegExp('id="' + id + '"', 'g')) || []).length, 1, id);
  assert.match(html, /class="reassurance-strip"/);
  for (const selector of ['intro', 'feature-section', 'steps-section', 'pricing-section', 'download-section', 'faq-section', 'final-cta', 'footer']) {
    assert.ok(css.includes('body .' + selector), 'missing section style ' + selector);
  }
  assert.match(css, /body \.footer \.footer-links/);
  assert.match(css, /body \.download-section \.platform-card/);
  assert.match(css, /body \.faq-section \.faq-list/);
});

test('pricing terms and protected download behavior remain truthful', () => {
  const html = read('index.html');
  assert.match(html, /R\$<\/span> 39,90/);
  assert.match(html, /R\$<\/span> 400/);
  assert.match(html, /ECONOMIZE R\$ 78,80/);
  assert.match(html, /não há cobrança automática/);
  assert.equal((html.match(/\bdata-auto-download\b/g) || []).length, 1);
  assert.match(html, /href="\/licencas\.html"/);
  assert.match(html, /href="\/privacidade\.html"/);
});


test('legacy orange accents are removed and feature SVGs inherit branded purple', () => {
  const css = read('homepage.css');
  const theme = read('theme.css');
  assert.doesNotMatch(css, /#(?:ff6909|f26522|ec4b46|e94b46|eb4743|ee4a46)\b/i);
  assert.match(theme, /feature-card \.feature-icon svg/);
  assert.match(theme, /stroke:var\(--sd-link\)/);
});

test('platform images are transparent, not darkened background squares', () => {
  const css = read('theme.css');
  const html = read('index.html');
  assert.match(css, /platform-card img\.platform-symbol/);
  assert.match(css, /background:transparent!important/);
  assert.match(css, /filter:brightness\(0\) saturate\(100%\)/);
  assert.equal((html.match(/class="platform-symbol official-platform-logo"/g) || []).length, 4);
});
