'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, 'public');
const port = Number(process.env.PORT || 3100);
const types = {
  '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.webp':'image/webp', '.ico':'image/x-icon', '.xml':'application/xml',
  '.txt':'text/plain; charset=utf-8',
};
const accountPages = new Set(['/conta', '/entrar', '/cadastro', '/recuperar-senha', '/redefinir-senha', '/pagamento-retorno']);
const accountAliases = new Set(['/entrar', '/cadastro', '/recuperar-senha', '/redefinir-senha']);

function reply(res) {
  res.status = code => { res.statusCode = code; return res; };
  res.json = value => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(value));
    return res;
  };
  res.send = value => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(value);
    return res;
  };
  return res;
}

async function body(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('Body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function file(req, res, filename, cache = 'public, max-age=300') {
  try {
    const stat = await fs.promises.stat(filename);
    if (!stat.isFile()) throw new Error('Not a file');
    res.setHeader('Content-Type', types[path.extname(filename)] || 'application/octet-stream');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', cache);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filename).on('error', () => res.destroy()).pipe(res);
  } catch {
    res.status(404).send('Arquivo não encontrado');
  }
}

const server = http.createServer(async (req, raw) => {
  const res = reply(raw);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    if (pathname === '/favicon.ico') {
      res.setHeader('Location', '/favicon.svg');
      return res.status(308).end();
    }
    if (pathname.startsWith('/api/auth/')) {
      const {handler}=require('./lib/auth-handler');
      return await handler(req,res,pathname);
    }
    if (/^\/api\/[a-z-]+$/.test(pathname)) {
      const handler = require(path.join(__dirname, 'api', pathname.slice(5) + '.js'));
      req.query = Object.fromEntries(url.searchParams);
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        const bytes = await body(req, pathname === '/api/avatar-upload' ? 2 * 1024 * 1024 : 256 * 1024);
        req.body = pathname === '/api/avatar-upload' ? bytes : bytes.length ? JSON.parse(bytes.toString('utf8')) : {};
      }
      return await handler(req, res);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).json({error:'Método não permitido'});
    if (/^\/avatars\/[0-9a-f-]{36}\/profile\.(?:jpg|png|webp)$/.test(pathname) && process.env.SEVEN_AVATAR_DIR) {
      const [, , userId, filename] = pathname.split('/');
      return await file(req, res, path.join(process.env.SEVEN_AVATAR_DIR, userId, filename), 'no-store');
    }
    const page = pathname === '/' ? 'index.html'
      : accountAliases.has(pathname) || pathname === '/conta' ? 'conta.html'
      : pathname === '/pagamento-retorno' ? 'pagamento-retorno.html'
      : pathname.slice(1);
    if (!page.split('/').every(part => /^[A-Za-z0-9._-]+$/.test(part) && part !== '..')) {
      return res.status(404).send('Página não encontrada');
    }
    if (accountPages.has(pathname)) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      res.setHeader('Referrer-Policy', 'no-referrer');
    }
    return await file(req, res, path.join(root, page), accountPages.has(pathname) ? 'no-store' : undefined);
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') return res.status(404).json({error:'Rota não encontrada'});
    if (error instanceof SyntaxError || error.message === 'Body too large') return res.status(400).json({error:'Requisição inválida'});
    console.error('Site request failed:', error);
    if (!res.headersSent) return res.status(503).json({error:'Serviço indisponível'});
    res.destroy();
  }
});

// Local host binding by default; the Docker network uses HOST=0.0.0.0 without publishing the port.
if (require.main === module) server.listen(port, process.env.HOST || '127.0.0.1');
module.exports = server;
