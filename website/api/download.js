'use strict';

const DOWNLOADS_ROOT = 'https://downloads.sevendesk.tech/';
const MANIFEST_URL = DOWNLOADS_ROOT + 'manifest.json';
const PLATFORMS = Object.freeze({
  windows: ['x64', 'arm64', 'x86'],
  macos: ['x64', 'arm64'],
  linux: ['x64', 'arm64'],
  android: ['universal', 'arm64'],
});
let memoryCache = { expires: 0, manifest: null };

function normalizePlatform(value) {
  const name = String(value ?? '').toLowerCase();
  return Object.hasOwn(PLATFORMS, name) ? name : null;
}

function normalizeArch(value, platform) {
  const arch = String(value ?? '').toLowerCase();
  const aliases = {
    amd64: 'x64', x86_64: 'x64', aarch64: 'arm64', arm: 'arm64',
    i386: 'x86', i686: 'x86', '32': 'x86', '64': 'x64',
  };
  const normalized = aliases[arch] || arch;
  const preferred = platform === 'android' ? 'universal' : 'x64';
  return PLATFORMS[platform].includes(normalized) ? normalized : (arch === '' || arch === 'auto' ? preferred : null);
}

function assetScore(file, platform, arch) {
  if (file.includes('unattended') || file.includes('wayland')) return -1;
  let match = false;
  switch (platform) {
    case 'windows':
      if (arch === 'x86') match = /[-_]x86(?:[-_]sciter)?\.exe$/i.test(file);
      else if (arch === 'arm64') match = /[-_](?:aarch64|arm64)\.exe$/i.test(file);
      else match = /[-_](?:x86_64|amd64|x64)(?:[-_]sciter)?\.exe$/i.test(file);
      break;
    case 'macos':
      if (arch === 'arm64') match = /[-_](?:aarch64|arm64|universal)\.dmg$/i.test(file);
      else match = /[-_](?:x86_64|amd64|x64|universal)\.dmg$/i.test(file);
      break;
    case 'linux':
      if (arch === 'arm64') match = /[-_](?:aarch64|arm64)(?:[-_]sciter)?\.deb$/i.test(file);
      else match = /[-_](?:x86_64|amd64|x64)(?:[-_]sciter)?\.deb$/i.test(file);
      break;
    case 'android':
      if (arch === 'arm64') match = /[-_](?:aarch64|universal)-signed\.apk$/i.test(file);
      else match = /[-_](?:universal|aarch64)-signed\.apk$/i.test(file);
      break;
    default: break;
  }
  if (!match || !/^(?:rustdesk|sevendesk|seven[-_]desk)[-_]/i.test(file)) return -1;
  let score = 0;
  if (/^(?:sevendesk|seven[-_]desk)[-_]/i.test(file)) score += 10;
  if (/-universal\.(?:apk|dmg)$/i.test(file)) score += 3;
  if (!/sciter/i.test(file)) score += 2;
  return score;
}

function findPackage(manifest, platform, arch) {
  if (!manifest || !/^v?[0-9][A-Za-z0-9._-]{0,63}$/.test(manifest.version) || !Array.isArray(manifest.files)) return null;
  const compatible = manifest.files
    .filter(file => (
      file &&
      typeof file.name === 'string' &&
      /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(file.name) &&
      Number.isSafeInteger(file.size) && file.size > 0 &&
      assetScore(file.name, platform, arch) >= 0
    ))
    .sort((a, b) => assetScore(b.name, platform, arch) - assetScore(a.name, platform, arch));
  if (!compatible.length) return null;
  const file = compatible[0];
  return {
    version: manifest.version,
    filename: file.name,
    url: DOWNLOADS_ROOT + encodeURIComponent(manifest.version) + '/' + encodeURIComponent(file.name),
    size: file.size,
  };
}

async function fetchManifest() {
  if (Date.now() < memoryCache.expires) return memoryCache.manifest;
  const controller = new AbortController();
  const stop = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(MANIFEST_URL, { signal: controller.signal });
    if (!response.ok) throw new Error('VPS manifest unavailable (' + response.status + ')');
    const manifest = await response.json();
    if (!manifest || !/^v?[0-9][A-Za-z0-9._-]{0,63}$/.test(manifest.version) || !Array.isArray(manifest.files)) {
      throw new Error('Invalid VPS manifest');
    }
    memoryCache = { expires: Date.now() + 120_000, manifest };
    return manifest;
  } finally {
    clearTimeout(stop);
  }
}

function errorPage(status, title, description) {
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'
    + title + ' | Seven Desk</title></head><body style="font-family:system-ui,sans-serif;max-width:640px;margin:12vh auto;padding:24px;color:#17345a"><h1>'
    + title + '</h1><p>' + description + '</p><p><a href="' + DOWNLOADS_ROOT
    + '">Conferir versões</a> · <a href="/">Voltar ao site</a></p><small>HTTP ' + status + '</small></body></html>';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=240');

  const mode = req.query?.format === 'manifest' ? 'manifest' : 'download';
  const platform = normalizePlatform(req.query?.platform);
  if (mode !== 'manifest' && !platform) {
    return res.status(400).send(errorPage(400, 'Sistema não reconhecido', 'Escolha um sistema compatível na página inicial.'));
  }
  const arch = platform ? normalizeArch(req.query?.arch, platform) : null;
  if (mode !== 'manifest' && !arch) {
    return res.status(400).send(errorPage(400, 'Arquitetura não suportada', 'Selecione uma arquitetura disponível para seu sistema.'));
  }

  let manifest;
  try {
    manifest = await fetchManifest();
  } catch (error) {
    console.error('Seven Desk release lookup failed:', error.message);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).send(errorPage(503, 'Downloads temporariamente indisponíveis', 'Não conseguimos consultar os arquivos de versão agora. Tente novamente mais tarde.'));
  }

  if (mode === 'manifest') {
    const devices = {};
    for (const [name, architectures] of Object.entries(PLATFORMS)) {
      devices[name] = {};
      for (const targetArch of architectures) {
        const asset = findPackage(manifest, name, targetArch);
        devices[name][targetArch] = asset ? { version: asset.version, filename: asset.filename, size: asset.size } : null;
      }
    }
    return res.status(200).json({
      latestRelease: manifest.version,
      devices,
      source: DOWNLOADS_ROOT,
    });
  }

  const asset = findPackage(manifest, platform, arch);
  if (!asset) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(404).send(errorPage(404, 'Instalador ainda não disponível', 'Não existe um instalador publicado para esta plataforma e arquitetura. Confira as versões disponíveis.'));
  }
  res.setHeader('Location', asset.url);
  res.setHeader('X-SevenDesk-Release', asset.version);
  res.setHeader('X-SevenDesk-Filename', asset.filename);
  return res.status(302).end();
};

// Pure helper exports make the download contract straightforward to regression test.
module.exports._internal = { normalizePlatform, normalizeArch, assetScore, findPackage };
