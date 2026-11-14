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

  const labels = Object.freeze({ windows: 'Windows', macos: 'macOS', linux: 'Linux', android: 'Android' });
  const icons = Object.freeze({
    windows: '/assets/windows.svg?v=2',
    macos: '/assets/macos.svg?v=2',
    linux: '/assets/linux.svg',
    android: '/assets/android.svg?v=2',
  });
  const downloadButton = document.querySelector('[data-auto-download]');
  const downloadLabel = downloadButton?.querySelector('.download-button-label');
  const osIcon = document.querySelector('[data-os-icon]');
  const nameSlots = document.querySelectorAll('[data-os-name]');
  const platformCards = Array.from(document.querySelectorAll('[data-platform]'));
  const downloadNotice = document.querySelector('.download-notice');
  let selectedPlatform = null;
  let detectedPlatform = null;
  let detectedArch = 'x64';
  let availableDevices = null;

  function identifyOS() {
    const ua = (navigator.userAgent || '').toLowerCase();
    const platform = (navigator.userAgentData?.platform || navigator.platform || '').toLowerCase();
    if (/android/.test(ua) || /android/.test(platform)) return 'android';
    // iOS has no native Seven Desk build at present.
    if (/iphone|ipad|ipod/.test(ua) || /iphone|ipad|ipod/.test(platform)) return null;
    if (/win/.test(platform) || /windows/.test(ua)) return 'windows';
    if (/mac/.test(platform) || /macintosh/.test(ua)) return 'macos';
    if (/linux/.test(platform) || /linux/.test(ua) || /x11/.test(platform)) return 'linux';
    return null;
  }

  function fastArchGuess() {
    const ua = navigator.userAgent || '';
    if (/arm64|aarch64/i.test(ua)) return 'arm64';
    // "Win32" is often reported even by 64-bit Windows browsers.
    if (/\bi686\b|\bi386\b/i.test(ua) && !/x64|win64|wow64/i.test(ua)) return 'x86';
    return 'x64';
  }

  async function detectArchHints() {
    if (!navigator.userAgentData?.getHighEntropyValues) return detectedArch;
    try {
      const hints = await Promise.race([
        navigator.userAgentData.getHighEntropyValues(['architecture', 'bitness']),
        new Promise(resolve => setTimeout(() => resolve(null), 700)),
      ]);
      if (!hints) return detectedArch;
      const arch = String(hints.architecture || '').toLowerCase();
      if (/arm/.test(arch)) return 'arm64';
      if (/x86|amd64/.test(arch)) return hints.bitness === '32' ? 'x86' : 'x64';
    } catch (_) {
      // Privacy-restricted browsers still have the normal platform selector.
    }
    return detectedArch;
  }

  function packageArchitecture(platform) {
    if (platform === 'android') return 'universal';
    if (platform === detectedPlatform) return detectedArch;
    // Users on other operating systems can select an architecture on the downloads page.
    return 'x64';
  }

  function selectPlatform(platform, revealButton = false) {
    selectedPlatform = Object.hasOwn(labels, platform) ? platform : null;
    const available = selectedPlatform && availableDevices?.[selectedPlatform]?.[packageArchitecture(selectedPlatform)];
    if (downloadButton) {
      const label = selectedPlatform ? labels[selectedPlatform] : 'seu sistema';
      downloadButton.href = available
        ? '/api/download?platform=' + encodeURIComponent(selectedPlatform) + '&arch='
          + encodeURIComponent(packageArchitecture(selectedPlatform))
        : '#plataformas';
      downloadButton.setAttribute('aria-label', selectedPlatform
        ? (available ? 'Baixar Seven Desk para ' : 'Instalador indisponível para ') + label
        : 'Escolher plataforma para baixar Seven Desk');
      downloadButton.setAttribute('aria-disabled', String(!available));
    }
    if (downloadLabel) downloadLabel.firstChild.textContent = available ? 'Baixar para ' : 'Indisponível para ';
    if (downloadNotice) downloadNotice.textContent = !availableDevices
      ? 'Verificando instaladores disponíveis...'
      : available
        ? 'Instalador ' + available.version + ' disponível: ' + available.filename + '.'
        : selectedPlatform
          ? 'Ainda não há instalador publicado para ' + labels[selectedPlatform] + ' nesta arquitetura.'
          : 'Escolha um sistema para ver os instaladores disponíveis.';
    nameSlots.forEach(el => {
      el.textContent = selectedPlatform ? labels[selectedPlatform] : 'seu sistema';
    });
    if (osIcon) {
      osIcon.hidden = !selectedPlatform;
      if (selectedPlatform) osIcon.src = icons[selectedPlatform];
    }
    platformCards.forEach(card => {
      const active = card.dataset.platform === selectedPlatform;
      card.classList.toggle('platform-selected', active);
      card.setAttribute('aria-pressed', String(active));
    });
    if (revealButton && downloadButton) {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      downloadButton.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
      downloadButton.focus({ preventScroll: true });
    }
  }

  function initializeDownloads() {
    detectedPlatform = identifyOS();
    detectedArch = fastArchGuess();
    selectPlatform(detectedPlatform);

    // Platform tiles only change the one download action; they do not start downloads.
    platformCards.forEach(card => {
      card.addEventListener('click', () => {
        selectPlatform(card.dataset.platform, true);
      });
    });

    void detectArchHints().then(arch => {
      detectedArch = arch;
      // Recalculate only if the visitor has not switched to a different platform.
      if (selectedPlatform === detectedPlatform) selectPlatform(selectedPlatform);
    });

    void fetch('/api/download?format=manifest')
      .then(response => {
        if (!response.ok) throw new Error('Downloads unavailable');
        return response.json();
      })
      .then(manifest => {
        availableDevices = manifest.devices;
        selectPlatform(selectedPlatform);
      })
      .catch(() => {
        availableDevices = {};
        selectPlatform(selectedPlatform);
        if (downloadNotice) downloadNotice.textContent = 'Downloads temporariamente indisponíveis. Tente novamente mais tarde.';
      });
  }

  initializeDownloads();
})();
