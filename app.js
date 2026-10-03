(() => {
  'use strict';

  const cfg = window.PRINTHUB_CONFIG || {};
  const CHANNEL = cfg.channel || 'PRINTHUB_BRIDGE_V1';
  const pending = new Map();
  let seq = 0;
  let extensionReady = false;
  let printers = [];

  const $ = id => document.getElementById(id);

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    $('buildVersion').textContent = cfg.build || 'dev';
    $('footerBuild').textContent = cfg.build || 'dev';
    tickClock();
    setInterval(tickClock, 1000);
    $('refreshPrinters').addEventListener('click', refreshPrinters);
    $('testPrint').addEventListener('click', printTest);
    $('clearLog').addEventListener('click', () => $('activityLog').innerHTML = '');

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    try {
      const pong = await request('PING', {}, cfg.extensionWaitMs || 1800);
      extensionReady = Boolean(pong && pong.extension);
      $('extensionState').textContent = extensionReady ? 'Connected' : 'Unavailable';
      if (pong && pong.deviceName) $('deviceName').textContent = pong.deviceName;
      log('Print extension connected.');
      await refreshPrinters();
    } catch (_) {
      setOverall('WAITING', 'warn');
      $('extensionState').textContent = 'Not detected';
      $('printerSummary').textContent = '0';
      $('printerList').innerHTML = '<div class="empty">Install / force-install the managed PrintHub extension on this ChromeOS kiosk.</div>';
      log('Print extension not detected.');
    }
  }

  function tickClock() {
    $('clock').textContent = new Date().toLocaleString([], {
      weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit', second:'2-digit'
    });
  }

  function request(action, payload = {}, timeoutMs = 5000) {
    const id = 'ph-' + Date.now() + '-' + (++seq);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('PrintHub extension did not respond.'));
      }, timeoutMs);

      pending.set(id, {resolve, reject, timer});
      window.postMessage({
        channel: CHANNEL,
        source: 'PRINTHUB_PAGE',
        type: 'request',
        id,
        action,
        payload
      }, window.location.origin);
    });
  }

  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const msg = event.data || {};
    if (msg.channel !== CHANNEL || msg.source !== 'PRINTHUB_EXTENSION') return;

    if (msg.type === 'response' && msg.id) {
      const waiter = pending.get(msg.id);
      if (!waiter) return;
      pending.delete(msg.id);
      clearTimeout(waiter.timer);
      if (msg.ok) waiter.resolve(msg.value);
      else waiter.reject(new Error(msg.error || 'PrintHub extension error.'));
      return;
    }

    if (msg.type === 'event') {
      handleExtensionEvent(msg.event, msg.value);
    }
  });

  async function refreshPrinters() {
    if (!extensionReady) return;
    try {
      const result = await request('GET_PRINTERS');
      printers = Array.isArray(result && result.printers) ? result.printers : [];
      renderPrinters();
      setOverall(printers.length ? 'READY' : 'NO PRINTERS', printers.length ? 'ok' : 'warn');
      log('Printer inventory refreshed: ' + printers.length + ' found.');
    } catch (err) {
      setOverall('ERROR', 'bad');
      log(err.message);
    }
  }

  function renderPrinters() {
    $('printerSummary').textContent = String(printers.length);
    $('printerList').innerHTML = printers.length
      ? printers.map(p => '<div class="printer"><div><div class="printer-name">' + esc(p.name) + '</div><div class="printer-meta muted">' + esc([p.source, p.uri].filter(Boolean).join(' · ')) + '</div></div><span class="badge">' + (p.isDefault ? 'DEFAULT' : 'READY') + '</span></div>').join('')
      : '<div class="empty">ChromeOS reports no installed printers.</div>';

    const select = $('testPrinter');
    select.disabled = !printers.length;
    $('testPrint').disabled = !printers.length;
    select.innerHTML = printers.map(p => '<option value="' + attr(p.id) + '">' + esc(p.name) + (p.isDefault ? ' — default' : '') + '</option>').join('');
  }

  async function printTest() {
    const printerId = $('testPrinter').value;
    if (!printerId) return;
    const printer = printers.find(p => p.id === printerId);
    $('testPrint').disabled = true;
    $('testResult').textContent = 'Submitting test to ' + (printer ? printer.name : 'selected printer') + '…';
    try {
      const result = await request('PRINT_TEST', {printerId}, 15000);
      $('testResult').textContent = 'Submitted. Chrome job ID: ' + (result.jobId || 'unknown') + '.';
      log('Test job submitted to ' + (printer ? printer.name : printerId) + '.');
    } catch (err) {
      $('testResult').textContent = err.message;
      log('Test print failed: ' + err.message);
    } finally {
      $('testPrint').disabled = !printers.length;
    }
  }

  function handleExtensionEvent(name, value) {
    if (name === 'JOB_STATUS') {
      const text = 'Job ' + (value.jobId || '') + ': ' + (value.status || 'UNKNOWN');
      $('testResult').textContent = text;
      log(text);
    }
  }

  function setOverall(text, tone) {
    const el = $('overallState');
    el.textContent = text;
    el.className = 'state state-' + tone;
  }

  function log(message) {
    const li = document.createElement('li');
    const t = document.createElement('time');
    t.textContent = new Date().toLocaleTimeString([], {hour:'numeric', minute:'2-digit', second:'2-digit'});
    const span = document.createElement('span');
    span.textContent = message;
    li.append(t, span);
    $('activityLog').prepend(li);
  }

  function esc(v) {
    return String(v ?? '').replace(/[&<>'"]/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
    })[c]);
  }

  function attr(v) { return esc(v); }
})();
