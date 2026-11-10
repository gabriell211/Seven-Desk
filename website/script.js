(() => {
  'use strict';

  const toggle = document.getElementById('menu-toggle');
  const nav = document.getElementById('mobile-navigation');
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  function setMenu(open) {
    if (!toggle || !nav) return;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    nav.hidden = !open;
  }

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });
    nav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => setMenu(false));
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') setMenu(false);
    });
    document.addEventListener('click', event => {
      if (!nav.hidden && !nav.contains(event.target) && !toggle.contains(event.target)) {
        setMenu(false);
      }
    });
    window.matchMedia('(min-width: 981px)').addEventListener('change', event => {
      if (event.matches) setMenu(false);
    });
  }

  const questions = Array.from(document.querySelectorAll('.faq-list details'));
  questions.forEach(question => {
    question.addEventListener('toggle', () => {
      if (!question.open) return;
      questions.forEach(other => {
        if (other !== question) other.open = false;
      });
    });
  });

  const labels = { windows: 'Windows', macos: 'macOS', linux: 'Linux', android: 'Android' };
  const status = document.getElementById('download-status');
  const autoButtons = Array.from(document.querySelectorAll('[data-auto-download]'));
  const nameSlots = document.querySelectorAll('[data-os-name]');
  const platformCards = Array.from(document.querySelectorAll('[data-platform]'));

  function identifyOS() {
    const platform = (navigator.userAgentData?.platform || navigator.platform || '').toLowerCase();
    const agent = (navigator.userAgent || '').toLowerCase();
    if (/android/.test(agent) || /android/.test(platform)) return 'android';
    if (/iphone|ipad|ipod/.test(agent) || /iphone|ipad|ipod/.test(platform)) return null;
    if (/win/.test(platform) || /windows/.test(agent)) return 'windows';
    if (/mac/.test(platform) || /macintosh/.test(agent)) return 'macos';
    if (/linux/.test(platform) || /linux/.test(agent) || /x11/.test(platform)) return 'linux';
    return null;
  }

  async function identifyArchitecture() {
    try {
      if (navigator.userAgentData?.getHighEntropyValues) {
        const hints = await navigator.userAgentData.getHighEntropyValues(['architecture', 'bitness', 'platform']);
        const architecture = String(hints.architecture || '').toLowerCase();
        if (/arm/.test(architecture)) return 'arm64';
        if (/x86|amd64/.test(architecture)) return hints.bitness === '32' ? 'x86' : 'x64';
      }
    } catch (_) {
      // Restricted browser hints should never disable the download action.
    }
    const ua = navigator.userAgent || '';
    if (/arm64|aarch64/i.test(ua)) return 'arm64';
    if (/win32|i686/i.test(ua) && !/win64|x64|wow64/i.test(ua)) return 'x86';
    return 'x64';
  }

  function defaultArchitecture(platform, detectedArch) {
    if (platform === 'android') return 'universal';
    if (platform === 'windows' && detectedArch === 'x86') return 'x86';
    if (detectedArch === 'arm64') return 'arm64';
    return 'x64';
  }

  function buildHref(platform, architecture) {
    return '/api/download?platform=' + encodeURIComponent(platform)
      + '&arch=' + encodeURIComponent(architecture);
  }

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  async function initDownloads() {
    const detectedOS = identifyOS();
    const detectedArch = await identifyArchitecture();

    if (!detectedOS) {
      for (const link of autoButtons) {
        link.href = '#plataformas';
        link.setAttribute('aria-label', 'Escolher a plataforma para baixar Seven Desk');
      }
      nameSlots.forEach(slot => { slot.textContent = 'seu sistema'; });
      setStatus('Escolha abaixo o sistema operacional para baixar uma versão disponível.');
    } else {
      const label = labels[detectedOS];
      const arch = defaultArchitecture(detectedOS, detectedArch);
      const href = buildHref(detectedOS, arch);
      autoButtons.forEach(link => {
        link.href = href;
        link.setAttribute('aria-label', 'Baixar Seven Desk para ' + label);
      });
      nameSlots.forEach(slot => { slot.textContent = label; });
      setStatus('Sistema detectado: ' + label + '. Consultando a versão disponível…');
      const card = platformCards.find(item => item.dataset.platform === detectedOS);
      if (card) card.classList.add('platform-selected');
    }

    for (const card of platformCards) {
      const platform = card.dataset.platform;
      const arch = platform === 'android' ? 'universal'
        : platform === detectedOS ? defaultArchitecture(platform, detectedArch) : 'x64';
      card.href = buildHref(platform, arch);
    }

    try {
      const response = await fetch('/api/download?format=manifest', {
        headers: { 'Accept': 'application/json' },
      });
      if (!response.ok) throw new Error('Download catalog unavailable');
      const manifest = await response.json();
      if (!manifest || !manifest.devices || typeof manifest.devices !== 'object') throw new Error('Invalid catalog');

      for (const card of platformCards) {
        const platform = card.dataset.platform;
        const architecture = platform === 'android' ? 'universal'
          : platform === detectedOS ? defaultArchitecture(platform, detectedArch) : 'x64';
        const release = manifest.devices[platform]?.[architecture];
        if (release?.version) {
          card.title = 'Baixar ' + release.filename + ' (' + release.version + ')';
        } else {
          card.href = 'https://github.com/gabriell211/Seven-Desk/releases';
          card.title = 'Ver outras compilações no GitHub';
        }
      }

      if (detectedOS) {
        const architecture = defaultArchitecture(detectedOS, detectedArch);
        const release = manifest.devices[detectedOS]?.[architecture];
        if (release?.version) {
          const older = manifest.latestRelease && manifest.latestRelease !== release.version;
          setStatus('Sistema detectado: ' + labels[detectedOS] + ' · ' + release.version
            + (older ? ' (versão anterior disponível enquanto a nova compila)' : ' (última versão disponível)')
            + ' · ' + release.filename);
        } else {
          setStatus('Ainda não existe um instalador disponível para ' + labels[detectedOS]
            + '. Consulte as outras versões abaixo.');
          autoButtons.forEach(link => {
            link.href = '#plataformas';
            link.setAttribute('aria-label', 'Ver outras versões Seven Desk');
          });
        }
      }
    } catch (_) {
      if (detectedOS) {
        setStatus('Sistema detectado: ' + labels[detectedOS]
          + '. O download consultará o arquivo mais recente disponível no GitHub.');
      }
    }
  }

  void initDownloads();
})();
