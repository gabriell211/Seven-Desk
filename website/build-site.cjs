'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Publish only public assets. Never copy API modules, database files or secrets.
const publicDir = path.join(__dirname, 'public');
fs.mkdirSync(publicDir, { recursive: true });
for (const name of ['index.html', 'conta.html', 'conta.css', 'conta.bundle.js', 'pagamento-retorno.html', 'styles.css', 'script.js', 'favicon.svg', 'privacidade.html', 'licencas.html', 'robots.txt', 'sitemap.xml', 'assets']) {
  fs.cpSync(path.join(__dirname, name), path.join(publicDir, name), { recursive: true });
}
