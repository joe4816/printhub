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
    $('sampleCallPass').addEventListener('click', sampleCallPassTest);
    $('templatePreview').addEventListener('click', downloadTemplatePreview);
    $('refreshRoutes').addEventListener('click', refreshPrinterRoutes);
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
      await refreshPrinterRoutes();
    } catch (_) {
      $('bridgeState').textContent = 'Not detected';
      $('bridgeBadge').textContent = 'default mode';
      $('bridgeBadge').className = 'badge badge-neutral';
      $('bridgeResult').textContent = 'Bridge not detected. Default-printer mode is still available.';
      $('bridgePrinter').disabled = true;
      $('bridgePrint').disabled = true;
      $('sampleCallPass').disabled = true;
      log('ChromeOS direct-print bridge not detected; using default-printer fallback.');
      await refreshPrinterRoutes();
    }
  }

  async function refreshPrinterRoutes() {
    const target = $('printerRouteRows');
    $('refreshRoutes').disabled = true;
    try {
      const catalog = await import('./shared/printer-catalog.js?v=0.8.5');
      let status;
      try { status = await bridgeRequest('SOURCE_STATUS',{},15000); }
      catch (_) { status = {}; }
      const actual = Array.isArray(status.printerRoutes) ? status.printerRoutes : [];
      target.replaceChildren();
      for (const route of catalog.PRINTER_ROUTES) {
        const checked = actual.find(r=>r.key===route.key);
        const tr = document.createElement('tr');
        const result = checked ? (checked.ready ? 'Ready' : checked.error || 'Unavailable') : 'Bridge v0.6.0 required';
        for (const value of [route.name,route.mediaProfileId === '80MM_RECEIPT' ? '80 mm receipt' : route.mediaProfileId === 'B6' ? 'B6 · quarter-letter' : 'Statement',result]) {
          const td = document.createElement('td'); td.textContent=value; tr.append(td);
        }
        target.append(tr);
      }
      $('printerRoutesResult').textContent = actual.length ? actual.filter(r=>r.ready).length + ' of 6 printer routes ready. Only ready routes receive queued jobs.' : 'Install bridge v0.6.0 to verify these bindings on this Chromebook.';
    } catch (err) { $('printerRoutesResult').textContent = err.message; }
    finally { $('refreshRoutes').disabled = false; }
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
        $('sampleCallPass').disabled = true;
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
      $('sampleCallPass').disabled = false;
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

  async function downloadTemplatePreview() {
    const paper = $('templatePaper').value;
    const selected = $('templateWorkflow').value;
    const workflow = selected === 'PASS_EXCUSED' ? 'PASS' : selected;
    try {
      const {buildPassKioskPdf} = await import('./shared/passkiosk-receipt-pdf.js?v=0.8.5');
      const tx = {
        Workflow:workflow, 'Student Name':'TEST - ' + selected.replaceAll('_', ' '),
        'Student ID':'TEST-ONLY', Grade:8, 'Created At':new Date().toISOString(),
        'Transaction ID':'SAMPLE-NOT-RECORDED', 'Session User':'Sample Adult',
        'Issued By':'Sample Adult', 'Requested By':'Sample Adult', 'Approved By':'Sample Adult',
        From:'Office - Room 239', To:'Rm 202 / Sample Teacher', Excused:selected === 'PASS_EXCUSED',
        'Reason(s)':selected === 'PASS' ? '' : workflow === 'PASS' ? 'Returning from Office Visit' : 'TEST ONLY - sample reason',
        'Delivery Period':'P1', 'Delivery Room':'109', 'Delivery Teacher':'Sample Teacher',
        Destination:'Office - Room 239', When:'Immediately',
        'Detention Date':new Intl.DateTimeFormat('en-CA', {timeZone:'America/Los_Angeles', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date()),
        'Report To':workflow === 'DET' ? 'Room 602' : 'The Cafeteria',
        'Directions Snapshot':workflow === 'DET'
          ? 'Report to the detention room 602 by 1:46 PM.\nDetention will be released at 4:20 PM.\nA late bus will be available for students eligible for transportation Monday through Thursday.'
          : 'Report directly to the cafeteria for your lunch period.\nImmediately check in with the administrator by the restrooms and let them know if you will be eating a school lunch.\nUse the restroom before arriving at detention.\nArrival more than 5 minutes late earns an additional day of detention.',
        'Bus Route(s)':'TEST ROUTE', 'Bus Drop-off(s)':'TEST STOP'
      };
      const doc = buildPassKioskPdf(tx, paper);
      const bytes = Uint8Array.from(atob(doc.pdfBase64), c => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], {type:'application/pdf'}));
      const link = document.createElement('a');
      link.href = url; link.download = 'PassKiosk-' + selected + '-' + paper + '-sample.pdf';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      $('templatePreviewResult').textContent = 'Downloaded ' + doc.title + ' · ' + paper + '. No pass or print job was created.';
    } catch (err) { $('templatePreviewResult').textContent = 'Preview failed: ' + err.message; }
  }

  async function sampleCallPassTest() {
    const printerId = $('bridgePrinter').value;
    const printerName = $('bridgePrinter').selectedOptions[0]?.textContent || 'selected printer';
    if (!printerId) {
      $('callPassResult').textContent = 'Choose an installed printer above, then press PRINT SAMPLE REQUEST FOR STUDENT.';
      return;
    }

    const {buildPassKioskReceiptPdf} = await import('./shared/passkiosk-receipt-pdf.js?v=0.8.5');
    const doc = buildPassKioskReceiptPdf({
      Workflow:'RQST', 'Student Name':'JORDAN SMITH',
      'Delivery Period':'P3', 'Delivery Room':'214', 'Delivery Teacher':'Lind',
      Destination:'Back Office / Counseling Office',
      'Requested By':'L. Siqueiros', When:'Immediately',
      'Reason(s)':'Going Home / Parent is waiting',
      'Transaction ID':'PK-SAMPLE-CALL'
    });
    $('sampleCallPass').disabled = true;
    $('callPassResult').textContent = 'Submitting Request for Student proof to ' + printerName + '…';
    log('PassKiosk Request for Student proof requested for ' + printerName + ' at ' + Math.round(doc.heightMicrons / 1000) + ' mm.');

    try {
      const result = await bridgeRequest('PRINT_PDF', {
        printerId,
        title:'PassKiosk Request for Student Proof',
        pdfBase64:doc.pdfBase64,
        heightMicrons:doc.heightMicrons,
        trim:true
      }, 15000);

      $('callPassResult').textContent =
        'Request for Student submit returned ' + (result.status || 'UNKNOWN') +
        ' · ' + Math.round((result.heightMicrons || doc.heightMicrons) / 1000) + ' mm' +
        (result.trimRequested ? ' · CUT requested' : ' · CUT unavailable') +
        '. Confirm the physical output.';
      log('Request for Student proof submit returned ' + (result.status || 'UNKNOWN') +
        ' for ' + (result.printerName || printerName) + '.');
    } catch (err) {
      $('callPassResult').textContent = 'Request for Student proof failed: ' + err.message;
      log('Request for Student proof failed: ' + err.message);
    } finally {
      $('sampleCallPass').disabled = false;
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
