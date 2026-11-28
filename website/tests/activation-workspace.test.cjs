'use strict';

const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'conta.html'), 'utf8');
const source = fs.readFileSync(path.join(root, 'conta.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'portal.css'), 'utf8');

function between(text, start, end) {
  const first = text.indexOf(start);
  const last = text.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, 'section boundaries must exist');
  return text.slice(first, last);
}
class FakeElement {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.events = new Map();
    this.dataset = {};
    this.hidden = false;
    this.value = '';
    this.textContent = '';
    this.maxLength = 0;
  }
  append(...children) { this.children.push(...children); }
  addEventListener(event, callback) { this.events.set(event, callback); }
  querySelectorAll(selector) {
    if (selector === 'button') return this.children.flatMap(el =>
      el.tag === 'div' ? el.children.filter(child => child.tag === 'button') : []);
    return [];
  }
  setAttribute(name, value) { this[name] = value; }
}
function fakeDocument() {
  return {createElement: tag => new FakeElement(tag)};
}
test('single activation key lives in overview with a link from the technician area', () => {
  const overview = between(html, '<section id="account-panel-overview"', '<section id="account-panel-devices"');
  const technicians = between(html, '<section id="account-panel-devices"', '<section id="account-panel-profile"');
  assert.match(overview, /id="account-activation-list"/);
  assert.match(overview, /uma única chave de ativação/);
  assert.match(technicians, /Ir para Visão geral/);
  assert.doesNotMatch(overview + technicians, /sd2_|tec_|account-app-token|account-tech-code/);
});

test('each card copies only its own activation key', async () => {
  const view = between(source, 'function createActivationCodes(', 'async function loadAppAccess()');
  const copied = [];
  const notice = new FakeElement('p');
  const pairs = new Map([
    [2, {token:'activation-slot-2'}],
    [3, {token:'activation-slot-3'}],
  ]);
  const updates = [];
  let confirmed = false;
  const sandbox = {
    document: fakeDocument(),
    el: () => notice,
    accountSession: 1,
    activationUpdatesInFlight: new Set(),
    revealedCodePairs: pairs,
    window: {confirm: () => confirmed},
    navigator: {clipboard: {writeText: async value => { copied.push(value); }}},
    updateAppDevice: (...args) => updates.push(args),
  };
  vm.runInNewContext(view, sandbox);
  const device = {label:'Suporte <script>', technician_name:'Maria', activated:true, technician_verified:true};
  const second = sandbox.createActivationCard(2, device);
  assert.equal(second.children[0].children[0].textContent, 'Vaga 02');
  assert.equal(second.children[0].children[1].textContent, 'Técnico vinculado');
  assert.equal(second.children[1].textContent, 'Técnico: Maria');
  assert.equal(second.children[2].children[0].value, 'Suporte <script>');
  const third = sandbox.createActivationCard(3, {technician_name:'João', activated:true});
  assert.equal(third.children[0].children[1].textContent, 'Aguardando vínculo');
  for (const card of [second, third]) {
    for (const row of card.children[4].children.slice(0, 1)) {
      await row.children[1].events.get('click')();
    }
  }
  assert.deepEqual(copied, [
    'activation-slot-2', 'activation-slot-3',
  ]);
  assert.equal(sandbox.createActivationCard(1, null).children.length, 4);
  const regenerate = second.children[3].children[0].events.get('click');
  regenerate();
  assert.equal(updates.length, 0);
  confirmed = true;
  regenerate();
  assert.deepEqual(updates[0], [2, 'Suporte <script>', false, device]);
});

test('activation supports mobile layouts and visible keyboard focus', () => {
  assert.match(css, /\.activation-card-grid\{grid-template-columns:1fr\}/);
  assert.match(css, /\.activation-code-row\{grid-template-columns:1fr\}/);
  assert.match(css, /\.activation-card button:focus-visible/);
  assert.match(html, /id="account-activation-notice"[^>]+role="status"/);
});
