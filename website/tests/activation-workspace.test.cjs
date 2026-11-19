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
function functionSource(name, next) {
  return between(source, 'function ' + name + '(', 'function ' + next + '(').replace(/\s+$/, '');
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
test('activation system is exclusive to overview; technician profile stays in devices', () => {
  const overview = between(html, '<section id="account-panel-overview"', '<section id="account-panel-devices"');
  const technicians = between(html, '<section id="account-panel-devices"', '<section id="account-panel-profile"');
  for (const id of ['account-activation-list','account-activation-notice','account-app-token-label','account-app-copy']) {
    assert.match(overview, new RegExp('id="' + id + '"'));
    assert.ok(!technicians.includes('id="' + id + '"'));
  }
  assert.match(technicians, /id="account-device-list"/);
  assert.match(technicians, /id="account-tech-code"/);
  assert.match(overview, /Ativação do sistema/);
  assert.match(overview, /Código de ativação do sistema/);
  assert.doesNotMatch(overview + technicians, /sd2_|Ativação do computador \(sd2_\)/);
});

test('technician card never renders activation buttons or shares code section', () => {
  const technician = between(source, 'function createTechnicianCard(', 'function showCardCode(');
  assert.doesNotMatch(technician, /data-card-activation|data-card-revoke|data-device-name|updateAppDevice/);
  assert.match(technician, /data-card-tech-code/);
  assert.match(technician, /rotateTechnicianCode/);
  assert.match(technician, /trustedTechnicianImage/);
});

test('activation controls are independent for each computer, with safe text assignment', () => {
  const code = functionSource('createActivationCard', 'showActivationCode');
  const events = [];
  const sandbox = {
    document: fakeDocument(),
    updateAppDevice: (...args) => events.push(args),
  };
  vm.runInNewContext(code, sandbox);
  const create = sandbox.createActivationCard;
  const active = create(2, {label:'Cliente <script>alert(1)</script>', activated:true});
  assert.equal(active.dataset.activationSlot,'2');
  const name = active.children[1].children[0];
  assert.equal(name.value,'Cliente <script>alert(1)</script>');
  assert.equal(active.children[0].children[1].textContent,'Ativado');
  const actions = active.children[2].children;
  assert.equal(actions.length,2);
  assert.match(actions[0].textContent,/Trocar código de ativação do sistema/);
  assert.equal(actions[1].textContent,'Revogar ativação');
  actions[0].events.get('click')();
  actions[1].events.get('click')();
  const free = create(3, null);
  assert.equal(free.children[2].children.length,1);
  assert.match(free.children[2].children[0].textContent,/Gerar código de ativação do sistema/);
  assert.deepEqual(events, [[2,'Cliente <script>alert(1)</script>',false],[2,'',true]]);
});

test('one-time activation credential belongs only to overview and is cleared on revocation', () => {
  const input = new FakeElement('input');
  const label = new FakeElement('section');
  const copy = new FakeElement('button');
  const elements = {
    'account-app-token-label':label,
    'account-app-token':input,
    'account-app-copy':copy,
  };
  const sourceFns = between(source, 'function showActivationCode(', 'async function loadAppAccess()');
  const sandbox = {el: id => elements[id]};
  vm.runInNewContext(sourceFns,sandbox);
  sandbox.showActivationCode(3,'test-activation-secret');
  assert.equal(input.value,'test-activation-secret');
  assert.equal(label.dataset.slot,'3');
  assert.equal(label.hidden,false);
  assert.equal(copy.hidden,false);
  sandbox.clearActivationCode();
  assert.equal(input.value,'');
  assert.equal(label.hidden,true);
  assert.equal(copy.hidden,true);
  assert.equal(label.dataset.slot,undefined);
});

test('activation generation and revocation do not touch technician credentials', () => {
  const code=between(source,'async function updateAppDevice(', 'async function loadSubscription(');
  assert.match(code,/fetch\('\/api\/app-token'/);
  assert.match(code,/showActivationCode\(slot, result\.token\)/);
  assert.match(code,/clearActivationCode\(\)/);
  assert.doesNotMatch(code,/technician-code|technician-profile|showCardCode|revealedTechnicianCodes/);
  assert.match(source,/revealedTechnicianCodes\.clear\(\)/);
  assert.match(source,/revealedOwner !== owner/);
  assert.match(source,/revealedTechnicianCodes\.set\(slot,code\)/);
  assert.match(source,/if \(activationUpdatesInFlight\.has\(slot\)\) return/);
});

test('activation layout is responsive, keyboard accessible, theme aware', () => {
  assert.match(css,/\.activation-card-grid\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/\.activation-card-grid\{grid-template-columns:1fr\}/);
  assert.match(css,/\.activation-secret\[hidden\]\{display:none!important\}/);
  assert.match(css,/\.activation-card button:focus-visible/);
  assert.match(html,/role="status" aria-live="polite"/);
  assert.match(html,/href="\/portal\.css\?v=5"/);
});
