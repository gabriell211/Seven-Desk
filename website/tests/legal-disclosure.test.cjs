'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');

const root = join(__dirname,'..');
const legal = readFileSync(join(root,'licencas.html'),'utf8');
const privacy = readFileSync(join(root,'privacidade.html'),'utf8');

test('legal page identifies individual service operator and preserves the AGPL licensing boundary',()=>{
  assert.match(legal, /href="https:\/\/www\.sevendesk\.tech\/licencas\.html"/);
  assert.doesNotMatch(legal, /seven-desk-site\.vercel\.app/);
  assert.match(legal, /prestador individual independente/);
  assert.match(legal, /servidores pr[oó]prios|infraestrutura de conex[aã]o/);
  assert.match(legal, /GNU AGPL-3\.0/);
  assert.match(legal, /LICENCE/);
  assert.match(legal, /gabriell211/);
  assert.match(legal, /PROPRIEDADE-E-LICENCAS\.md/);
  assert.match(legal, /acesso remoto/);
  assert.match(legal, /confirma[cç][aã]o v[aá]lida do pagamento/);
  assert.match(legal, /legisla[cç][aã]o brasileira/);
  assert.match(legal, /2026/);
});

test('privacy explains responsible party, data rights, remote access and service providers',()=>{
  assert.match(privacy,/href="https:\/\/www\.sevendesk\.tech\/privacidade\.html"/);
  assert.match(privacy,/gabriell211/);
  assert.match(privacy,/CPF e CNPJ/);
  assert.match(privacy,/InfinitePay/);
  assert.match(privacy,/LGPD/);
  assert.match(privacy,/acesso remoto/);
  assert.match(privacy,/controle remoto|dados exibidos na tela remota|comandos de entrada/);
  assert.match(privacy,/Reten[cç][aã]o e exclus[aã]o/);
  assert.match(privacy,/sevendesk@sevendesk\.tech/);
  assert.match(privacy,/var\(--sd-page\)/);
  assert.match(privacy,/var\(--sd-title\)/);
});

test('legal statements never incorrectly claim exclusive ownership of upstream code',()=>{
  assert.doesNotMatch(legal,/c[oó]digo de terceiros [eé] exclusivamente nosso|AGPL.*revogada/i);
  assert.match(legal,/direitos dos autores do software de terceiros/);
  assert.match(privacy,/legisla[cç][aã]o brasileira|legisla[cç][aã]o/);
});
