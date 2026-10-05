(() => {
  'use strict';

  const cfg = window.PRINTHUB_CONFIG || {};
  const $ = id => document.getElementById(id);
  const STORAGE_KEY = 'PRINTHUB_ENDPOINT_V1';
  const BRIDGE_CHANNEL = 'PRINTHUB_BRIDGE_V1';
  const pendingBridge = new Map();

  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('message', onBridgeMessage);

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
    $('refreshPrinters').addEventListener('click', refreshBridgePrinters);
    $('bridgePrint').addEventListener('click', directPrintTest);
    $('bridgePrinter').addEventListener('change', () => {
      $('bridgePrint').disabled = !$('bridgePrinter').value;
    });

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

    log('Browser-default printing mode active.');
    detectBridge();
  }

  async function detectBridge() {
    try {
      const info = await bridgeRequest('PING', {}, 2500);
      $('bridgeState').textContent = 'Connected v' + info.version;
      $('bridgeBadge').textContent = 'bridge connected';
      $('bridgeBadge').className = 'badge';
      $('bridgeResult').textContent = 'Bridge connected. Loading installed printers…';
      log('ChromeOS bridge connected: v' + info.version + '.');
      await refreshBridgePrinters();
    } catch (_) {
      $('bridgeState').textContent = 'Not detected';
      $('bridgeBadge').textContent = 'default mode';
      $('bridgeBadge').className = 'badge badge-neutral';
      $('bridgeResult').textContent = 'Bridge not detected. Default-printer mode is still available.';
      $('bridgePrinter').disabled = true;
      $('bridgePrint').disabled = true;
      log('ChromeOS direct-print bridge not detected; using default-printer fallback.');
    }
  }

  async function refreshBridgePrinters() {
    $('refreshPrinters').disabled = true;
    try {
      const value = await bridgeRequest('GET_PRINTERS', {}, 5000);
      const printers = Array.isArray(value.printers) ? value.printers : [];
      const select = $('bridgePrinter');
      select.innerHTML = '';

      if (!printers.length) {
        select.append(new Option('No installed printers returned', ''));
        select.disabled = true;
        $('bridgePrint').disabled = true;
        $('bridgeResult').textContent = 'Bridge is connected, but ChromeOS returned no installed printers.';
        log('Bridge returned zero printers.');
        return;
      }

      select.append(new Option('Choose a printer…', ''));
      for (const p of printers) {
        const label = p.name + (p.isDefault ? '  [default]' : '') + (p.uri ? ' — ' + p.uri : '');
        select.append(new Option(label, p.id));
      }

      select.disabled = false;
      $('bridgePrint').disabled = true;
      $('bridgeResult').textContent = printers.length + ' installed printer(s) returned by ChromeOS.';
      log('Bridge returned ' + printers.length + ' installed printer(s).');
    } catch (err) {
      $('bridgeResult').textContent = 'Could not read printers: ' + err.message;
      log('Bridge printer enumeration failed: ' + err.message);
    } finally {
      $('refreshPrinters').disabled = false;
    }
  }

  async function directPrintTest() {
    const printerId = $('bridgePrinter').value;
    const printerName = $('bridgePrinter').selectedOptions[0]?.textContent || 'selected printer';
    const lengthMm = clampNumber($('directLengthMm').value, 60, 160, 60);
    $('directLengthMm').value = String(lengthMm);
    if (!printerId) return;

    $('bridgePrint').disabled = true;
    $('bridgeResult').textContent = 'Submitting directly to ' + printerName + '…';
    log('Direct printer test requested for ' + printerName + '.');

    try {
      const result = await bridgeRequest('PRINT_TEST', {printerId, heightMicrons: Math.round(lengthMm * 1000)}, 15000);
      const lengthNote = ' · ' + ((result.heightMicrons || Math.round(lengthMm * 1000)) / 1000).toFixed(0) + ' mm';
      const cutNote = result.trimSupported
        ? ' · CUT: trim requested'
        : ' · CUT: not exposed by current ChromeOS driver';
      $('bridgeResult').textContent =
        'Direct submit returned ' + (result.status || 'UNKNOWN') +
        (result.jobId ? ' · job ' + result.jobId : '') +
        lengthNote + cutNote + '. Confirm the physical output.';
      log('Direct print submit returned ' + (result.status || 'UNKNOWN') +
        ' for ' + (result.printerName || printerName) +
        (result.trimSupported ? '; trim requested.' : '; trim capability not exposed.'));
    } catch (err) {
      $('bridgeResult').textContent = 'Direct print failed: ' + err.message;
      log('Direct print failed: ' + err.message);
    } finally {
      $('bridgePrint').disabled = !$('bridgePrinter').value;
    }
  }

  function bridgeRequest(action, payload, timeoutMs) {
    const id = 'ph-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingBridge.delete(id);
        reject(new Error('No response from the ChromeOS bridge.'));
      }, timeoutMs || 5000);

      pendingBridge.set(id, {resolve, reject, timer});
      window.postMessage({
        channel:BRIDGE_CHANNEL,
        source:'PRINTHUB_PAGE',
        type:'request',
        id,
        action,
        payload:payload || {}
      }, window.location.origin);
    });
  }

  function onBridgeMessage(event) {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const msg = event.data || {};
    if (msg.channel !== BRIDGE_CHANNEL || msg.source !== 'PRINTHUB_EXTENSION') return;

    if (msg.type === 'response' && msg.id) {
      const pending = pendingBridge.get(msg.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      pendingBridge.delete(msg.id);
      if (msg.ok) pending.resolve(msg.value || {});
      else pending.reject(new Error(msg.error || 'Bridge request failed.'));
      return;
    }

    if (msg.type === 'event' && msg.event === 'JOB_STATUS') {
      const value = msg.value || {};
      log('ChromeOS print job ' + (value.jobId || '?') + ' status: ' + (value.status || 'UNKNOWN') + '.');
    }
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

  function clampNumber(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.round(n)));
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
