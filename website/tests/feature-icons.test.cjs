'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const cards = [...html.matchAll(/<article class="feature-card"><div class="feature-icon">([\s\S]*?)<\/div><h3>(.*?)<\/h3>/g)];

test('all six feature cards use accessible, vector SVG icons', () => {
  assert.equal(cards.length, 6);
  for (const [, icon, title] of cards) {
    assert.match(icon, /<svg\b/);
    assert.match(icon, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(icon, /aria-hidden="true"/);
    assert.match(icon, /stroke="currentColor"/);
    assert.match(icon, /<\/svg>/);
    assert.match(icon, /<(path|rect|circle)\b/, title + ' must have actual geometry');
  }
  assert.match(css, /\.feature-icon svg\s*\{/);
});

test('feature descriptions keep their intended, distinct illustrations', () => {
  const titles = cards.map(x => x[2]);
  assert.deepEqual(titles, [
    'Acesso e controle',
    'Transferência de arquivos',
    'Privacidade e permissões',
    'Mais de uma plataforma',
    'Conexão flexível',
    'Configuração avançada',
  ]);
  assert.equal(new Set(cards.map(x => x[1])).size, 6);
});
