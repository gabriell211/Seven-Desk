'use strict';

const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const site = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(site, 'conta.html'), 'utf8');
const js = fs.readFileSync(path.join(site, 'conta.js'), 'utf8');
const css = fs.readFileSync(path.join(site, 'portal.css'), 'utf8');

test('client workspace has left sidebar with avatar and real destinations', () => {
  assert.match(html, /id="account-signed-in" class="client-workspace" hidden/);
  assert.match(html, /class="client-sidebar"/);
  for (const id of ['account-sidebar-avatar','account-sidebar-name','account-sidebar-email','account-signout']) {
    assert.ok(html.includes('id="' + id + '"'), id);
  }
  assert.match(html, /href="\/\#plataformas"/);
  assert.match(html, /href="\/\#perguntas"/);
  assert.match(html, /href="\/privacidade\.html"/);
});

test('each client navigation target has a unique accessible section', () => {
  const nav = [...html.matchAll(/data-account-view="([^"]+)"/g)].map(x => x[1]);
  const panels = [...html.matchAll(/data-account-panel="([^"]+)"/g)].map(x => x[1]);
  assert.deepEqual([...new Set(panels)].sort(), ['billing','devices','overview','profile','settings']);
  assert.deepEqual([...new Set(nav)].sort(), [...new Set(panels)].sort());
  assert.equal(new Set(panels).size, panels.length);
  assert.match(html, /id="account-view-title" tabindex="-1"/);
  assert.match(js, /panel\.hidden = panel\.dataset\.accountPanel !== view/);
  assert.match(js, /setAttribute\('aria-current','page'\)/);
});

test('auth, device activation, technician codes and billing hooks remain present', () => {
  const ids = ['account-signed-out','account-form','account-verification-form','account-reset-form',
    'account-profile-form','account-profile-save','account-app-access','account-device-list',
    'account-app-notice','account-tech-code','account-tech-code-copy','account-app-token',
    'account-app-copy','account-subscription','account-plan-actions','account-signout'];
  for (const id of ids) assert.ok(html.includes('id="' + id + '"'), id);
  for (const plan of ['monthly','yearly','extra_slot']) assert.ok(html.includes('data-plan="' + plan + '"'));
  const found = [...html.matchAll(/\bid="([^"]+)"/g)].map(x => x[1]);
  assert.equal(new Set(found).size,found.length,'duplicate IDs would break handlers');
  const uses = [...js.matchAll(/\bel\('([^']+)'\)/g)].map(x => x[1]);
  assert.deepEqual([...new Set(uses.filter(x => !found.includes(x)))], []);
});

test('dashboard uses server responses and fails closed when APIs are unavailable', () => {
  assert.match(js, /await fetch\('\/api\/subscription'/);
  assert.match(js, /await fetch\('\/api\/app-token'/);
  assert.match(js, /account-summary-technicians/);
  assert.match(js, /account-summary-devices/);
  assert.match(js, /account-summary-status/);
  assert.match(js, /account-device-unavailable/);
  assert.match(js, /'Indisponível'/);
  assert.match(html, /id="account-summary-devices">—/);
});

test('portal styling is scoped to authenticated sessions, responsive, and theme aware', () => {
  assert.match(html, /href="\/portal\.css\?v=2"/);
  const build = fs.readFileSync(path.join(site, 'build-site.cjs'), 'utf8');
  assert.ok(build.includes("'portal.css'"), 'production build must publish the sidebar stylesheet');
  assert.match(html, /class="client-nav"[\s\S]*?<svg viewBox="0 0 24 24"/);
  assert.match(css, /html\[data-theme="light"\] body\.account-page\.account-authenticated/);
  assert.match(css, /html\[data-theme="dark"\] body\.account-page\.account-authenticated/);
  assert.match(css, /grid-template-columns:264px minmax\(0,1fr\)/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(js, /classList\.toggle\('account-authenticated',Boolean\(user\)\)/);
});


test('one responsive technician card per slot shows synced avatar and safe controls', () => {
  assert.match(html, /id="account-device-list" class="technician-card-grid"/);
  assert.match(html, /Foto e o nome|A foto e o nome/);
  assert.match(js, /function createTechnicianCard\(slot, device\)/);
  assert.match(js, /list\.append\(createTechnicianCard\(slot,bySlot\.get\(slot\)\)\)/);
  assert.match(js, /function trustedTechnicianImage\(value, slot\)/);
  assert.match(js, /trustedTechnicianImage\(device\?\.technician_image,slot\)/);
  assert.match(js, /fileInput\.addEventListener\('change'/);
  assert.match(js, /URL\.createObjectURL\(file\)/);
  assert.match(js, /file\.size > 2 \* 1024 \* 1024/);
  assert.match(js, /updateTechnicianProfile\(slot,nameInput\.value,photoInput\.files\?\.\[0\],save\)/);
  assert.match(js, /showCardCode\(slot,'technician',code\)/);
  assert.match(js, /showCardCode\(slot,'activation',result\.token\)/);
  assert.doesNotMatch(js, /row\.className = 'account-device-row'/);
  assert.match(css, /technician-card-avatar/);
  assert.match(css, /technician-card-photo\[hidden\]/);
  assert.match(css, /technician-card-grid\{grid-template-columns:1fr\}/);
  assert.match(css, /html\[data-theme="dark"\]/);
});
