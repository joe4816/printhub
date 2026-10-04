(() => {
  'use strict';

  const cfg = window.PRINTHUB_CONFIG || {};
  const $ = id => document.getElementById(id);
  const STORAGE_KEY = 'PRINTHUB_ENDPOINT_V1';

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    const endpoint = resolveEndpointIdentity();

    $('endpointId').textContent = endpoint.id;
    $('endpointLabel').textContent = endpoint.label;
    $('endpointType').textContent = endpoint.type;
    $('buildVersion').textContent = cfg.build || 'dev';
    $('footerBuild').textContent = cfg.build || 'dev';
    $('testMedia').value = endpoint.mediaProfile || cfg.defaultMediaProfile || '80MM_RECEIPT';

    tickClock();
    setInterval(tickClock, 1000);

    $('testPrint').addEventListener('click', printTest);
    $('testMedia').addEventListener('change', persistMediaChoice);
    $('clearLog').addEventListener('click', () => $('activityLog').innerHTML = '');

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    if (endpoint.id === (cfg.unassignedEndpointId || 'PH-UNASSIGNED')) {
      setOverall('SETUP', 'warn');
      log('Endpoint is not assigned yet. Add ?endpoint=PH-NAME to the kiosk URL once the device identity is chosen.');
    } else {
      setOverall('READY', 'ok');
      log('Endpoint ready: ' + endpoint.id + '.');
    }

    log('Browser-default printing mode active. No Chrome extension required.');
  }

  function resolveEndpointIdentity() {
    const params = new URLSearchParams(location.search);
    const saved = readSavedIdentity();
    const explicitId = cleanId(params.get('endpoint'));

    const identity = {
      id: explicitId || saved.id || cfg.unassignedEndpointId || 'PH-UNASSIGNED',
      label: cleanLabel(params.get('label')) || saved.label || cfg.defaultLabel || 'PrintHub',
      type: cfg.endpointType || 'CHROMEOS_BROWSER',
      mediaProfile: cleanId(params.get('media')) || saved.mediaProfile || cfg.defaultMediaProfile || '80MM_RECEIPT'
    };

    if (explicitId || params.has('label') || params.has('media')) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
    }

    return identity;
  }

  function readSavedIdentity() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
    } catch (_) {
      return {};
    }
  }

  function persistMediaChoice() {
    const saved = readSavedIdentity();
    saved.mediaProfile = $('testMedia').value;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }

  function tickClock() {
    $('clock').textContent = new Date().toLocaleString([], {
      weekday:'short',
      month:'short',
      day:'numeric',
      hour:'numeric',
      minute:'2-digit',
      second:'2-digit'
    });
  }

  function printTest() {
    const media = $('testMedia').value;
    const endpointId = $('endpointId').textContent;

    $('printEndpoint').textContent = endpointId;
    $('printMedia').textContent = media;
    $('printTime').textContent = new Date().toLocaleString();

    const surface = $('printSurface');
    surface.className = mediaClass(media);
    installPageRule(media);

    $('testResult').textContent =
      'Sending browser print test to this device\'s default printer…';

    if (media === '80MM_RECEIPT') {
      log('Browser print test requested using 80MM_RECEIPT with 18 mm tear buffer.');
    } else {
      log('Browser print test requested using ' + media + '.');
    }

    const afterPrint = () => {
      $('testResult').textContent =
        'Browser print call returned. Confirm the physical output reached this device\'s intended default printer.';
      log('Browser print call returned; physical confirmation is still required.');
      window.removeEventListener('afterprint', afterPrint);
    };

    window.addEventListener('afterprint', afterPrint);
    window.print();
  }

  function installPageRule(media) {
    let style = document.getElementById('dynamicPageRule');
    if (!style) {
      style = document.createElement('style');
      style.id = 'dynamicPageRule';
      document.head.appendChild(style);
    }

    if (media === 'LETTER_PORTRAIT') {
      style.textContent = '@page { size: letter portrait; margin: 0.5in; }';
    } else if (media === 'HALF_LETTER_LANDSCAPE') {
      style.textContent = '@page { size: 11in 5.5in; margin: 0.5in; }';
    } else {
      style.textContent = '@page { size: 80mm 140mm; margin: 4mm; }';
    }
  }

  function mediaClass(media) {
    if (media === 'LETTER_PORTRAIT') return 'print-letter';
    if (media === 'HALF_LETTER_LANDSCAPE') return 'print-half-letter';
    return 'print-80mm';
  }

  function setOverall(text, tone) {
    const el = $('overallState');
    el.textContent = text;
    el.className = 'state state-' + tone;
  }

  function log(message) {
    const li = document.createElement('li');
    const time = document.createElement('time');
    time.textContent = new Date().toLocaleTimeString([], {
      hour:'numeric',
      minute:'2-digit',
      second:'2-digit'
    });
    const span = document.createElement('span');
    span.textContent = message;
    li.append(time, span);
    $('activityLog').prepend(li);
  }

  function cleanId(value) {
    return String(value || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 80);
  }

  function cleanLabel(value) {
    return String(value || '').trim().slice(0, 120);
  }
})();
