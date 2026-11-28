const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('shows per-user prices with five technician computers and unlimited receivers', () => {
  const section = html.match(/<section class="pricing-section[\s\S]*?<\/section>/)?.[0];
  assert.ok(section);
  assert.match(section, /um mês gratuito antes de escolher um plano/i);
  assert.match(section, /19,90\s*<small>\/ usuário \/ mês/);
  assert.match(section, /199,90\s*<small>\/ usuário \/ ano/);
  assert.equal((section.match(/Até 5 computadores de técnicos/g) || []).length, 2);
  assert.equal((section.match(/Clientes atendidos sem cadastro/g) || []).length, 2);
  assert.equal((section.match(/href="\/cadastro"/g) || []).length, 2);
});

test('approved future tiers have no checkout link and are labelled unavailable', () => {
  for (const [name, price] of [['Personal','Grátis'],['Business','49,90'],['Enterprise','149,90']]) {
    const card = [...html.matchAll(/<article class="pricing-card"[\s\S]*?<\/article>/g)].map(m=>m[0]).find(s=>s.includes('<h3>'+name+'</h3>'));
    assert.ok(card, name); assert.ok(card.includes(price)); assert.match(card,/EM PREPARAÇÃO/); assert.doesNotMatch(card,/href=|data-plan=/);
  }
});
