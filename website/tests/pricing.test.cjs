const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('shows per-user prices with five technician computers and unlimited receivers', () => {
  const section = html.match(/<section class="pricing-section[\s\S]*?<\/section>/)?.[0];
  assert.ok(section);
  assert.match(section, /um mês gratuito antes de escolher um plano/i);
  assert.match(section, /39,90\s*<small>\/ usuário \/ mês/);
  assert.match(section, /400\s*<small>\/ usuário \/ ano/);
  assert.equal((section.match(/Até 5 computadores de técnicos/g) || []).length, 2);
  assert.equal((section.match(/Clientes atendidos sem cadastro/g) || []).length, 2);
  assert.equal((section.match(/href="\/cadastro"/g) || []).length, 2);
});
