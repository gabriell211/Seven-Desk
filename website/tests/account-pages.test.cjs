'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync, existsSync} = require('node:fs');
const {join} = require('node:path');

const root = join(__dirname, '..');
const read = name => readFileSync(join(root,name),'utf8');

test('login, signup and recovery use dedicated accessible URLs', () => {
  const server=read('server.js');
  assert.match(server,/accountAliases/);
  for (const source of ['/entrar','/cadastro','/recuperar-senha','/redefinir-senha']) {
    assert.ok(server.includes(source),source);
    assert.equal(existsSync(join(root, 'conta.html')), true, 'clean URL destination must exist');
  }
  const home=read('index.html');
  assert.match(home,/href="\/entrar"/);
  assert.match(home,/href="\/cadastro"/);
  const account=read('conta.html');
  for(const id of ['account-form','account-recovery-form','account-reset-form','account-verification-form','account-signed-in',
    'account-message','account-service-message','account-plan-actions']) {
    assert.ok(account.includes(`id="${id}"`),id);
  }
});
test('logo uses same purple vector path as desktop Flutter and has no opaque background', () => {
  const logo=read('assets/seven-desk-logo.svg');
  const icon=read('favicon.svg');
  assert.match(logo,/viewBox="0 0 64 64"/);
  assert.match(logo,/M61 11 C49 -3 23 5 9 26/);
  assert.match(logo,/#[Cc]575[Ff][Ff]/);
  assert.match(icon,/M61 11 C49 -3 23 5 9 26/);
  assert.doesNotMatch(logo,/<rect\b/i);
  assert.doesNotMatch(logo,/data:image\/png/);
});
