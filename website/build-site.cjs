'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Publish only public assets. Never copy API modules, database files or secrets.
const publicDir = path.join(__dirname, 'public');
fs.mkdirSync(publicDir, { recursive: true });
for (const name of ['index.html', 'analytics.js', 'analytics.css', 'conta.html', 'conta.css', 'portal.css', 'conta.bundle.js', 'pagamento-retorno.html', 'pagamento-retorno.bundle.js', 'styles.css', 'homepage.css', 'theme.css', 'theme.js', 'script.js', 'favicon.svg', 'privacidade.html', 'licencas.html', 'robots.txt', 'sitemap.xml', 'assets']) {
  fs.cpSync(path.join(__dirname, name), path.join(publicDir, name), { recursive: true });
}
