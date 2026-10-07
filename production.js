(() => {
  'use strict';
  const CHANNEL = 'PRINTHUB_BRIDGE_V1';
  const pending = new Map();
  const RENDERER_VERSION = 'printhub-web-0.8.5';
  let running = false;
  let stopped = false;

  window.addEventListener('message', onBridgeMessage);
  document.addEventListener('DOMContentLoaded', () => setTimeout(start, 1200));

  async function start() {
    if (running || stopped) return;
    running = true;
    try {
      const bridge = await bridgeRequest('PING', {}, 5000);
      if (!versionAtLeast(String(bridge.version || '0.0.0'), '0.5.0')) {
        setSourceState('BRIDGE UPDATE NEEDED', 'idle');
        setSourceBadge('managed source · staged');
        log('PassKiosk production source requires ChromeOS bridge v0.5.0 or later; current bridge is v' + String(bridge.version || 'unknown') + '.');
        running = false;
        return;
      }

      const status = await bridgeRequest('SOURCE_STATUS', {}, 5000);
      if (!status.configured) {
        setSourceState('NOT CONFIGURED', 'idle');
        setSourceBadge('managed source · inactive');
        log('PassKiosk production source is not configured in managed extension policy.');
        running = false;
        return;
      }
      if (!status.enabled) {
        setSourceState('DISABLED', 'idle');
        setSourceBadge('managed source · authenticated');
        log('PassKiosk source is authenticated but production polling is disabled server-side.');
        running = false;
        return;
      }
      setSourceBadge('managed source · authenticated');
      setSourceState('POLLING', 'ok');
      log('PassKiosk production polling enabled for ' + status.endpointId + '.');
      if (!versionAtLeast(String(bridge.version || ''), '0.6.0')) log('Bridge v0.6.0 is required for all six printer routes. Current bridge continues Receipt Printer 1 only.');
      schedulePoll(250);
    } catch (err) {
      running = false;
      setSourceState('SOURCE ERROR', 'warn');
      log('PassKiosk source startup failed: ' + err.message);
    }
  }

  function schedulePoll(delay) {
    if (!stopped) setTimeout(pollOnce, Math.max(500, Number(delay || 2500)));
  }

  async function pollOnce() {
    if (stopped) return;
    try {
      const result = await bridgeRequest('POLL_SOURCE', {maxJobs:1, supportedMediaProfiles:['80MM_RECEIPT','STATEMENT','B6']}, 15000);
      const jobs = Array.isArray(result.jobs) ? result.jobs : [];
      for (const job of jobs) await processJob(job);
      setSourceState('POLLING', 'ok');
      schedulePoll(result.pollAfterMs || 2500);
    } catch (err) {
      setSourceState('RETRYING', 'warn');
      log('PassKiosk poll failed: ' + err.message);
      schedulePoll(5000);
    }
  }

  async function processJob(job) {
    const id = String(job && job.printJobId || '');
    if (!id) return;
    log('Claimed ' + id + ' · ' + (job.routeLabel || job.routeId || 'route') + '.');
    try {
      const profile = String(job.mediaProfileId || '');
      const renderers = { '80MM_RECEIPT':'PASSKIOSK_RECEIPT', STATEMENT:'PASSKIOSK_PDF', B6:'PASSKIOSK_PDF' };
      if (!renderers[profile]) throw new Error('Unsupported media profile: ' + profile);
      if (String(job.rendererId || '') !== renderers[profile]) throw new Error('Unsupported renderer: ' + String(job.rendererId || ''));
      const module = await import('./shared/passkiosk-receipt-pdf.js?v=0.8.5');
      const doc = await module.buildPrintablePassKioskPdf(job.transaction || {}, profile);
      const result = await bridgeRequest('PRINT_SOURCE_JOB', {
        job,
        title:doc.title,
        pdfBase64:doc.pdfBase64,
        heightMicrons:doc.heightMicrons,
        widthMicrons:doc.widthMicrons,
        trim:profile === '80MM_RECEIPT',
        rendererVersion:RENDERER_VERSION
      }, 20000);
      log('Submitted ' + id + ' to ' + (result.printerName || job.bindingKey || 'printer') +
        ' · ' + Math.round(Number(result.heightMicrons || doc.heightMicrons) / 1000) + ' mm' +
        (result.trimRequested ? ' · CUT requested.' : '.'));
    } catch (err) {
      log('PrintHub job ' + id + ' failed before print: ' + err.message);
      try {
        await bridgeRequest('FAIL_SOURCE_JOB', {
          job,
          errorCode:'RENDER_OR_SUBMIT_FAILED',
          errorMessage:String(err && err.message || err),
          rendererVersion:RENDERER_VERSION
        }, 10000);
      } catch (callbackErr) {
        log('Could not report failure for ' + id + ': ' + callbackErr.message);
      }
    }
  }

  function bridgeRequest(action, payload, timeoutMs) {
    const id = 'ph-prod-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('No response from the ChromeOS bridge.')); }, timeoutMs || 5000);
      pending.set(id, {resolve, reject, timer});
      window.postMessage({channel:CHANNEL, source:'PRINTHUB_PAGE', type:'request', id, action, payload:payload || {}}, window.location.origin);
    });
  }

  function onBridgeMessage(event) {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const msg = event.data || {};
    if (msg.channel !== CHANNEL || msg.source !== 'PRINTHUB_EXTENSION' || msg.type !== 'response' || !msg.id) return;
    const item = pending.get(msg.id);
    if (!item) return;
    clearTimeout(item.timer);
    pending.delete(msg.id);
    if (msg.ok) item.resolve(msg.value || {});
    else item.reject(new Error(msg.error || 'Bridge request failed.'));
  }

  function versionAtLeast(actual, required) {
    const a = String(actual || '').split('.').map(x => Number(x) || 0);
    const r = String(required || '').split('.').map(x => Number(x) || 0);
    for (let i = 0; i < Math.max(a.length, r.length); i++) {
      const av = a[i] || 0;
      const rv = r[i] || 0;
      if (av > rv) return true;
      if (av < rv) return false;
    }
    return true;
  }

  function setSourceState(text, tone) {
    const el = document.getElementById('passKioskSourceState');
    if (!el) return;
    el.textContent = text;
    el.className = 'state state-' + tone;
  }
  function setSourceBadge(text) {
    const el = document.getElementById('sourceBadge');
    if (el) el.textContent = text;
  }
  function log(message) {
    const list = document.getElementById('activityLog');
    if (!list) return;
    const li = document.createElement('li');
    const time = document.createElement('time');
    time.textContent = new Date().toLocaleTimeString([], {hour:'numeric', minute:'2-digit', second:'2-digit'});
    const span = document.createElement('span');
    span.textContent = message;
    li.append(time, span);
    list.prepend(li);
  }
})();
