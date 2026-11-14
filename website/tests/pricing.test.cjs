const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('shows per-user monthly and yearly prices and unlimited computers', () => {
  const section = html.match(/<section class="pricing-section[\s\S]*?<\/section>/)?.[0];
  assert.ok(section);
  assert.match(section, /um mês gratuito antes de escolher um plano/i);
  assert.match(section, /39,90\s*<small>\/ usuário \/ mês/);
  assert.match(section, /400\s*<small>\/ usuário \/ ano/);
  assert.equal((section.match(/Computadores ilimitados/g) || []).length, 2);
  assert.equal((section.match(/href="\/cadastro"/g) || []).length, 2);
});
