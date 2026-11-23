'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'analytics.js'), 'utf8');

function setup(initial = null) {
  const stored = new Map(initial ? [['seven-desk-marketing-consent-v1', initial]] : []);
  const session = new Map();
  const scripts = [];
  let reloads = 0;
  const nodes = new Map();
  function element(tag) {
    return {
      tag, children: [], handlers: {}, attributes: {},
      set id(value) {this._id = value; nodes.set(value, this);},
      get id() {return this._id;},
      appendChild(child) { this.children.push(child); return child; },
      append(...children) {this.children.push(...children);},
      setAttribute(key, value) {this.attributes[key]=value;},
      addEventListener(event, cb) {this.handlers[event]=cb;},
      remove() {nodes.delete(this.id);},
    };
  }
  const document = {
    readyState: 'complete',
    createElement: element,
    getElementById: id => nodes.get(id),
    head: { appendChild(node) {scripts.push(node);}},
    body: {appendChild(node) { if (node.id) nodes.set(node.id,node);}},
  };
  const window = {dataLayer: [], location: {reload() {reloads++;}}};
  const localStorage = {getItem:k=>stored.get(k)??null, setItem:(k,v)=>stored.set(k,v)};
  const sessionStorage = {getItem:k=>session.get(k)??null, setItem:(k,v)=>session.set(k,v)};
  vm.runInNewContext(source, {document, window, localStorage, sessionStorage, Date});
  return {window,document,scripts,stored,session, getReloads:()=>reloads};
}
function buttons(panel) {return panel.children[2].children;}

test('GTM does not load or record conversions without consent', () => {
  const app = setup();
  assert.equal(app.scripts.length, 0);
  assert.equal(app.window.sevenDeskAnalytics.subscriptionConfirmed('order-1'),false);
  assert.equal(app.window.dataLayer.some(e=>e.event==='seven_desk_subscription_paid'),false);
  buttons(app.document.getElementById('sd-consent-panel'))[0].handlers.click();
  assert.equal(app.stored.get('seven-desk-marketing-consent-v1'), 'denied');
  assert.equal(app.scripts.length,0);
});
test('after consent, single GTM script loads and confirmed orders deduplicate', () => {
  const app=setup();
  buttons(app.document.getElementById('sd-consent-panel'))[1].handlers.click();
  assert.equal(app.scripts.length,2);
  assert.match(app.scripts[0].src,/^https:\/\/www\.googletagmanager\.com\/gtm\.js\?id=GTM-KD893LRD$/);
  assert.match(app.scripts[1].src,/^https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-BYGEEMMYZ8$/);
  assert.equal(app.window.dataLayer.some(x=>x[0]==='config' && x[1]==='G-BYGEEMMYZ8'),true);
  assert.equal(app.window.sevenDeskAnalytics.subscriptionConfirmed('order-2'),true);
  assert.equal(app.window.sevenDeskAnalytics.subscriptionConfirmed('order-2'),false);
  assert.equal(app.window.dataLayer.filter(e=>e.event==='seven_desk_subscription_paid').length,1);
  assert.equal(app.window.dataLayer.find(e=>e.transaction_id==='order-2').currency,'BRL');
});
test('denied consent persists and accepted consent can be revoked',()=>{
  const denied=setup('denied');
  assert.equal(denied.scripts.length,0);
  const accepted=setup('granted');
  assert.equal(accepted.scripts.length,2);
  accepted.window.sevenDeskAnalytics.openPreferences();
  buttons(accepted.document.getElementById('sd-consent-panel'))[0].handlers.click();
  assert.equal(accepted.getReloads(),1);
  assert.equal(accepted.stored.get('seven-desk-marketing-consent-v1'),'denied');
});
test('all public pages include analytics with independent consent controls',()=>{
  for(const file of ['index.html','conta.html','pagamento-retorno.html','privacidade.html','licencas.html']){
    const html=fs.readFileSync(path.join(root,file),'utf8');
    assert.match(html,/\/analytics\.js\?v=/);
    assert.match(html,/\/analytics\.css\?v=/);
  }
  const build=fs.readFileSync(path.join(root,'build-site.cjs'),'utf8');
  assert.match(build,/'analytics\.js', 'analytics\.css'/);
  const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
  assert.match(server,/script-src 'self' https:\/\/www\.googletagmanager\.com/);
  assert.doesNotMatch(server,/script-src 'self' 'unsafe-inline'/);
  const payment=fs.readFileSync(path.join(root,'pagamento-retorno.js'),'utf8');
  assert.match(payment,/if \(confirmation\.confirmed === true\) \{[^}]*subscriptionConfirmed\(order_nsu\)/s);
  assert.doesNotMatch(payment,/subscriptionConfirmed\(.*?trial/s);
});
