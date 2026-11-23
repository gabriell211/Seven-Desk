'use strict';

const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'portal.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'conta.html'), 'utf8');

function rule(selector) {
  // Match the first standalone declaration, not a grouped rule or media override.
  const lines = css.split('\n');
  const index = lines.findIndex(line => {
    const normalized = line.trim();
    return normalized.startsWith(selector + ' {') || normalized.startsWith(selector + '{');
  });
  assert.notEqual(index, -1, 'Missing scoped CSS selector: ' + selector);
  const start = lines.slice(0, index).reduce((size, line) => size + line.length + 1, 0)
    + lines[index].indexOf(selector);
  return css.slice(start, css.indexOf('}', start) + 1);
}

test('authenticated desktop workspace starts at viewport top without empty header strip', () => {
  const header = rule('html[data-theme] body.account-page.account-authenticated .account-header');
  assert.match(header, /position:absolute/);
  assert.match(header, /min-height:0/);
  assert.match(header, /background:transparent/);
  const workspace = rule('html[data-theme] body.account-page.account-authenticated #account-signed-in');
  assert.match(workspace, /min-height:100dvh/);
  const sidebar = rule('.account-authenticated .client-sidebar');
  assert.match(sidebar, /height:100dvh/);
});

test('successful authentication does not create a banner, errors remain visible', () => {
  assert.match(rule('html[data-theme] body.account-page.account-authenticated .account-card>#account-message:empty'), /display:none/);
  assert.match(rule('html[data-theme] body.account-page.account-authenticated .account-card>#account-message:not(:empty)'), /position:fixed/);
  assert.match(css, /\.account-card>#account-message\.error\s*\{/);
  const js = fs.readFileSync(path.join(root, 'conta.js'), 'utf8');
  assert.match(js, /await refresh\(\);\s*status\(''\);/);
  assert.doesNotMatch(js, /status\('Entrada realizada\.'\)/);
  assert.match(html, /id="account-message" class="account-message" role="status" aria-live="polite"/);
  assert.match(html, /class="account-connected"/);
});

test('devices view avoids duplicate heading and keeps technician controls and helpful notices', () => {
  const view = html.split('<section id="account-panel-devices"')[1].split('<section id="account-panel-profile"')[0];
  assert.ok(view, 'devices section exists');
  assert.doesNotMatch(view, /<h2>Computadores e técnicos<\/h2>/);
  assert.match(view, /class="technician-board-heading"/);
  assert.match(view, /id="account-device-list" class="technician-card-grid"/);
  assert.match(view, /id="account-app-notice"/);
  assert.match(rule('.account-authenticated .technician-board-heading'), /padding:2px 0 12px/);
  assert.match(rule('.account-authenticated .technician-card-grid'), /margin:14px 0 16px/);
});

test('light/dark, narrow viewports and visible theme selector remain available', () => {
  assert.match(html, /id="theme-select-account"[^>]*aria-label="Aparência do site"/);
  assert.match(html, /href="\/portal\.css\?v=\d+"/);
  assert.match(css, /html\[data-theme="light"\] body\.account-page\.account-authenticated/);
  assert.match(css, /html\[data-theme="dark"\] body\.account-page\.account-authenticated/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /\.client-nav-heading\{display:none\}/);
  assert.match(css, /\.client-sidebar\{position:relative;min-height:0;height:auto;padding:14px 16px 10px/);
  assert.match(css, /@media\(max-width:420px\)/);
});

test('MVP dashboard uses consistent card density and readable numeric KPIs', () => {
  assert.match(rule('.account-authenticated .client-metric'), /gap:9px;padding:19px/);
  assert.match(rule('.account-authenticated .client-metric>strong'), /font-variant-numeric:tabular-nums/);
  assert.match(rule('.account-authenticated .client-surface'), /padding:22px/);
  assert.match(rule('.account-authenticated .technician-card-header'), /padding:18px/);
});
