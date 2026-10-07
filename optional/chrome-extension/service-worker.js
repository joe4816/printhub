importScripts('printer-routing.js');
const EXTENSION_VERSION='0.6.3';
const SOURCE_JOB_PREFIX='PRINTHUB_SOURCE_JOB_';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'PRINTHUB_REQUEST') return;

  handleRequest(String(msg.action || ''), msg.payload || {})
    .then(value => sendResponse({ok:true,value}))
    .catch(err => sendResponse({ok:false,error:String(err && err.message || err)}));

  return true;
});

chrome.printing.onJobStatusChanged.addListener((jobId, status) => {
  broadcastJobStatus(jobId, status);
  handleSourceJobStatus(jobId, status).catch(() => {});
});

async function handleRequest(action, payload) {
  if (action === 'PING') {
    const managed = await managedSettings();
    return {
      extension:true,
      version:EXTENSION_VERSION,
      deviceName:String(managed.deviceName || 'Managed ChromeOS')
    };
  }

  if (action === 'GET_PRINTERS') {
    const printers = await chrome.printing.getPrinters();
    return {printers:printers.map(publicPrinter)};
  }

  if (action === 'PRINT_TEST') {
    const managed = await managedSettings();
    if (managed.allowTestPrint === false) throw new Error('Test printing is disabled by managed policy.');
    return submitTestPrint(String(payload.printerId || ''), payload);
  }

  if (action === 'PRINT_PDF') {
    return submitPdfDocument(String(payload.printerId || ''), payload);
  }

  if (action === 'SOURCE_STATUS') {
    return sourceStatus();
  }

  if (action === 'POLL_SOURCE') {
    return pollSource(payload);
  }

  if (action === 'PRINT_SOURCE_JOB') {
    return submitSourceJob(payload);
  }

  if (action === 'FAIL_SOURCE_JOB') {
    return failSourceJob(payload);
  }

  throw new Error('Unsupported PrintHub action: ' + action);
}

async function managedSettings() {
  try {
    return await chrome.storage.managed.get(null);
  } catch (_) {
    return {};
  }
}

async function sourceConfig() {
  const managed = await managedSettings();
  const raw = String(managed.sourceConfigJson || '').trim();
  if (!raw) return null;

  let cfg;
  try {
    cfg = JSON.parse(raw);
  } catch (_) {
    throw new Error('Managed sourceConfigJson is not valid JSON.');
  }

  const endpointUrl = String(cfg.endpointUrl || '').trim();
  const endpointId = String(cfg.endpointId || '').trim();
  const endpointKey = String(cfg.endpointKey || '').trim();
  const bindings = Object.fromEntries(PRINTER_ROUTES.map(r=>[r.key,{name:r.name,mediaProfileId:r.mediaProfileId}]));
  // Managed overrides can supply stable CUPS URIs without exposing credentials to the page.
  for (const [key,binding] of Object.entries(cfg.bindings || {})) {
    bindings[key] = {...bindings[key],...binding};
  }

  if (!/^https:\/\/script\.google\.com\/(?:a\/macros\/[^/]+\/)?macros?\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpointUrl) &&
      !/^https:\/\/script\.google\.com\/a\/macros\/[^/]+\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpointUrl) &&
      !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpointUrl)) {
    throw new Error('Managed source endpointUrl must be an Apps Script /exec URL.');
  }
  if (!endpointId) throw new Error('Managed source endpointId is required.');
  if (endpointKey.length < 32) throw new Error('Managed source endpointKey is missing or invalid.');
  if (!Object.keys(bindings).length) throw new Error('Managed source bindings are required.');

  return {
    endpointUrl,
    endpointId,
    endpointKey,
    bindings,
    pollAfterMs:clampNumber(cfg.pollAfterMs, 1000, 30000, 2500)
  };
}

async function sourceStatus() {
  const cfg = await sourceConfig();
  if (!cfg) return {configured:false};

  await reconcileSourceJobs();

  const ping = await callSource(cfg, 'endpoint.ping', {});
  return {
    configured:true,
    endpointId:cfg.endpointId,
    enabled:Boolean(ping.enabled),
    pollAfterMs:Number(ping.pollAfterMs || cfg.pollAfterMs || 2500),
    bindings:Object.keys(cfg.bindings),
    printerRoutes:await auditPrinterRoutes(cfg)
  };
}

async function pollSource(payload) {
  const cfg = await requireSourceConfig();
  await reconcileSourceJobs();

  const result = await callSource(cfg, 'endpoint.poll', {
    maxJobs:clampNumber(payload && payload.maxJobs, 1, 5, 1),
    // Old hub pages render receipts only; do not offer them copier claims.
    readyBindingKeys:(await auditPrinterRoutes(cfg)).filter(r=>r.ready &&
      (Array.isArray(payload && payload.supportedMediaProfiles) ? payload.supportedMediaProfiles : ['80MM_RECEIPT']).includes(r.mediaProfileId || '80MM_RECEIPT')).map(r=>r.key)
  });

  return {
    endpointId:cfg.endpointId,
    pollAfterMs:Number(result.pollAfterMs || cfg.pollAfterMs || 2500),
    jobs:Array.isArray(result.jobs) ? result.jobs : []
  };
}

async function submitSourceJob(payload) {
  const cfg = await requireSourceConfig();
  const job = payload && payload.job || {};
  const printJobId = String(job.printJobId || '').trim();
  const claimId = String(job.claim && job.claim.claimId || '').trim();
  const bindingKey = String(job.bindingKey || '').trim();

  if (!printJobId || !claimId) throw new Error('Source job is missing printJobId or claimId.');
  if (String(job.endpointId || '') !== cfg.endpointId) throw new Error('Source job endpoint does not match this managed endpoint.');
  if (!bindingKey) throw new Error('Source job bindingKey is required.');

  const printer = await resolveBindingPrinter(cfg, bindingKey);
  const encoded = String(payload && payload.pdfBase64 || '');
  if (!encoded) throw new Error('PDF payload is required.');
  if (encoded.length > 4000000) throw new Error('PDF payload is too large for the PrintHub bridge.');

  const info = await printerInfo(printer.id);
  const caps = info && info.capabilities && info.capabilities.printer;
  if (!caps) throw new Error('ChromeOS did not return capabilities for ' + printer.name + '.');

  const requestedHeight = clampNumber(payload && payload.heightMicrons, 60000, 500000, 100000);
  const trimSupported = supportsTrim(caps);
  const trimRequested = payload && payload.trim !== false;
  const requestedProfile = String(job.mediaProfileId || '');
  const profile = bindingKey === 'BACK_OFFICE' && requestedProfile === 'B6' ? 'A6' : requestedProfile;
  const bindingProfile = cfg.bindings[bindingKey].mediaProfileId;
  if (bindingProfile && bindingProfile !== profile) throw new Error('Job paper does not match binding ' + bindingKey);
  const media = chooseProfileMedia(caps, profile, requestedHeight);
  const ticket = buildProfileTicket(caps, media, trimRequested && trimSupported, profile);
  const pdf = base64ToBlob(encoded, 'application/pdf');

  const response = await chrome.printing.submitJob({
    job:{
      printerId:printer.id,
      title:String(payload && payload.title || 'PassKiosk Document').slice(0,120),
      ticket,
      contentType:'application/pdf',
      document:pdf
    }
  });

  if (!response || response.status !== 'OK' || !response.jobId) {
    throw new Error('ChromeOS rejected the print job: ' + String(response && response.status || 'UNKNOWN'));
  }

  const rendererVersion = String(payload && payload.rendererVersion || '').trim();

  // Persist the source mapping before any network callback. ChromeOS can move
  // a small receipt job to PRINTED very quickly, and the status event must be
  // able to resolve the source claim even if it fires while the callback is
  // still in flight.
  await chrome.storage.local.set({
    [SOURCE_JOB_PREFIX + response.jobId]:{
      printJobId,
      claimId,
      rendererVersion,
      submittedAt:new Date().toISOString()
    }
  });

  await callSource(cfg, 'endpoint.complete', {
    printJobId,
    claimId,
    status:'PRINT_INVOKED',
    rendererVersion,
    detail:'Submitted to ChromeOS printer ' + printer.name
  });

  return {
    status:response.status,
    jobId:response.jobId,
    printerId:printer.id,
    printerName:printer.name,
    trimSupported,
    trimRequested:Boolean(trimRequested && trimSupported),
    heightMicrons:Number(media.height_microns || requestedHeight)
  };
}

async function failSourceJob(payload) {
  const cfg = await requireSourceConfig();
  const job = payload && payload.job || {};
  const printJobId = String(job.printJobId || '').trim();
  const claimId = String(job.claim && job.claim.claimId || '').trim();

  if (!printJobId || !claimId) throw new Error('Source job is missing printJobId or claimId.');

  return callSource(cfg, 'endpoint.complete', {
    printJobId,
    claimId,
    status:'FAILED',
    errorCode:String(payload && payload.errorCode || 'SOURCE_FAILED'),
    errorMessage:String(payload && payload.errorMessage || 'PrintHub failed before print invocation.'),
    rendererVersion:String(payload && payload.rendererVersion || '')
  });
}

async function requireSourceConfig() {
  const cfg = await sourceConfig();
  if (!cfg) throw new Error('Managed PassKiosk source is not configured.');
  return cfg;
}

async function callSource(cfg, action, payload) {
  const body = {
    action,
    endpointId:cfg.endpointId,
    endpointKey:cfg.endpointKey,
    ...(payload || {})
  };

  const response = await fetch(cfg.endpointUrl, {
    method:'POST',
    redirect:'follow',
    credentials:'include',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify(body)
  });

  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch (_) {
    throw new Error('PassKiosk endpoint returned a non-JSON response.');
  }

  if (!response.ok || !result || result.ok !== true) {
    throw new Error(String(result && result.error || 'PassKiosk endpoint request failed.'));
  }
  return result;
}

async function resolveBindingPrinter(cfg, bindingKey) {
  const binding = cfg.bindings[bindingKey];
  if (!binding || typeof binding !== 'object') {
    throw new Error('Managed printer binding not found: ' + bindingKey);
  }

  return resolveExactPrinter(await chrome.printing.getPrinters(), binding, bindingKey);
}


let routeAuditCache = null;
async function auditPrinterRoutes(cfg) {
  const signature = JSON.stringify(cfg.bindings);
  if (routeAuditCache && routeAuditCache.signature === signature && Date.now()-routeAuditCache.at < 60000) return routeAuditCache.routes;
  const printers = await chrome.printing.getPrinters();
  const routes = [];
  for (const [key,binding] of Object.entries(cfg.bindings)) {
    const row = {key,name:String(binding.name || key),mediaProfileId:String(binding.mediaProfileId || ''),ready:false};
    try {
      const printer = resolveExactPrinter(printers,binding,key);
      const info = await printerInfo(printer.id);
      const caps = info && info.capabilities && info.capabilities.printer;
      if (!caps) throw new Error('Printer capabilities unavailable.');
      if (['UNREACHABLE','STOPPED','EXPIRED_CERTIFICATE'].includes(info.status)) throw new Error('Printer status: ' + info.status);
      const profile = row.mediaProfileId || '80MM_RECEIPT';
      const media = chooseProfileMedia(caps,profile,100000);
      buildProfileTicket(caps,media,false,profile);
      row.name = printer.name; row.ready = true; row.printerId = printer.id;
    } catch (err) { row.error = String(err.message || err); }
    routes.push(row);
  }
  routeAuditCache = {signature,at:Date.now(),routes};
  return routes;
}
const printerInfoCache = new Map();
async function printerInfo(id) {
  const cached = printerInfoCache.get(id);
  if (cached && Date.now()-cached.at < 60000) return cached.info;
  const info = await chrome.printing.getPrinterInfo(id);
  printerInfoCache.set(id,{at:Date.now(),info});
  return info;
}

async function handleSourceJobStatus(jobId, status) {
  if (!['PRINTED','FAILED','CANCELED'].includes(String(status || ''))) return;

  const key = SOURCE_JOB_PREFIX + jobId;
  const stored = await chrome.storage.local.get(key);
  const source = stored && stored[key];
  if (!source) return;

  const cfg = await sourceConfig();
  if (!cfg) return;

  if (status === 'PRINTED') {
    await callSource(cfg, 'endpoint.complete', {
      printJobId:source.printJobId,
      claimId:source.claimId,
      status:'PRINTED',
      rendererVersion:String(source.rendererVersion || '')
    });
  } else {
    await callSource(cfg, 'endpoint.complete', {
      printJobId:source.printJobId,
      claimId:source.claimId,
      status:'FAILED',
      errorCode:status === 'CANCELED' ? 'CHROME_JOB_CANCELED' : 'CHROME_JOB_FAILED',
      errorMessage:status === 'CANCELED'
        ? 'ChromeOS canceled the print job.'
        : 'ChromeOS reported the print job failed.',
      rendererVersion:String(source.rendererVersion || '')
    });
  }

  await chrome.storage.local.remove(key);
}

async function reconcileSourceJobs() {
  const cfg = await sourceConfig();
  if (!cfg || typeof chrome.printing.getJobStatus !== 'function') return;

  const all = await chrome.storage.local.get(null);
  const entries = Object.entries(all).filter(([key]) => key.startsWith(SOURCE_JOB_PREFIX));

  for (const [key, source] of entries) {
    const chromeJobId = key.slice(SOURCE_JOB_PREFIX.length);
    try {
      const status = await chrome.printing.getJobStatus(chromeJobId);
      if (['PRINTED','FAILED','CANCELED'].includes(status)) {
        await handleSourceJobStatus(chromeJobId, status);
      }
    } catch (_) {
      // Keep the mapping. A later status event or reconciliation may still resolve it.
    }
  }
}

function broadcastJobStatus(jobId, status) {
  chrome.tabs.query({url:'https://joe4816.github.io/printhub/*'}).then(tabs => {
    for (const tab of tabs) {
      if (!tab.id) continue;
      chrome.tabs.sendMessage(tab.id, {
        type:'PRINTHUB_EVENT',
        event:'JOB_STATUS',
        value:{jobId,status}
      }).catch(() => {});
    }
  });
}

function publicPrinter(p) {
  return {
    id:p.id,
    name:p.name,
    description:p.description || '',
    isDefault:Boolean(p.isDefault),
    source:p.source || '',
    uri:p.uri || ''
  };
}

async function submitTestPrint(printerId, payload) {
  if (!printerId) throw new Error('Choose a printer.');

  const printers = await chrome.printing.getPrinters();
  const printer = printers.find(p => p.id === printerId);
  if (!printer) throw new Error('The selected printer is no longer installed.');

  const info = await chrome.printing.getPrinterInfo(printerId);
  const caps = info && info.capabilities && info.capabilities.printer;
  if (!caps) throw new Error('ChromeOS did not return capabilities for this printer.');

  const requestedHeight = clampNumber(payload && payload.heightMicrons, 60000, 160000, 78000);
  const trimSupported = supportsTrim(caps);
  const media = chooseMedia(caps, requestedHeight);
  const ticket = buildTicket(caps, media, trimSupported);
  const widthMicrons = Number(media.width_microns || 80000);
  const heightMicrons = Number(media.height_microns || 78000);
  const pdf = makeTestPdf(printer.name, widthMicrons, heightMicrons, trimSupported);

  const response = await chrome.printing.submitJob({
    job:{
      printerId,
      title:'PrintHub Direct Printer Test',
      ticket,
      contentType:'application/pdf',
      document:pdf
    }
  });

  return {
    status:response && response.status,
    jobId:response && response.jobId ? response.jobId : '',
    printerId,
    printerName:printer.name,
    trimSupported,
    trimRequested:trimSupported,
    heightMicrons
  };
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function supportsTrim(caps) {
  const vendor = Array.isArray(caps.vendor_capability) ? caps.vendor_capability : [];
  return vendor.some(item => {
    const id = String(item && item.id || '').toLowerCase();
    const name = String(item && item.display_name || '').toLowerCase();
    return id === 'finishings/11' || name === 'finishings/11' || id === 'finishings';
  });
}

function chooseMedia(caps, requestedHeight) {
  const options = caps.media_size && Array.isArray(caps.media_size.option)
    ? caps.media_size.option : [];

  if (!options.length) {
    return {width_microns:80000,height_microns:requestedHeight};
  }

  const continuous = options.find(x => x.is_continuous_feed);
  if (continuous) {
    const minH = Number(continuous.min_height_microns || 25400);
    const maxH = Number(continuous.max_height_microns || 2000000);
    return {
      width_microns:Number(continuous.width_microns || 80000),
      height_microns:Math.max(minH, Math.min(requestedHeight, maxH))
    };
  }

  const eighty = options.find(x => {
    const w=Number(x.width_microns || 0);
    return w >= 76000 && w <= 82000;
  });
  const preferred = eighty || options.find(x => x.is_default) || options[0];
  return {
    width_microns:Number(preferred.width_microns || 80000),
    height_microns:Number(preferred.height_microns || requestedHeight),
    vendor_id:preferred.vendor_id
  };
}

function buildTicket(caps, media, trimSupported) {
  const color = defaultOption(caps.color, {type:'STANDARD_MONOCHROME'});
  const duplex = defaultOption(caps.duplex, {type:'NO_DUPLEX'});
  const orientation = defaultOption(caps.page_orientation, {type:'PORTRAIT'});
  const dpi = defaultOption(caps.dpi, {horizontal_dpi:203,vertical_dpi:203});

  const print = {
    color:{type:color.type || 'STANDARD_MONOCHROME'},
    duplex:{type:duplex.type || 'NO_DUPLEX'},
    page_orientation:{type:orientation.type || 'PORTRAIT'},
    copies:{copies:1},
    dpi:{
      horizontal_dpi:Number(dpi.horizontal_dpi || 203),
      vertical_dpi:Number(dpi.vertical_dpi || 203)
    },
    media_size:media,
    collate:{collate:false}
  };

  if (trimSupported) {
    print.vendor_ticket_item = [{id:'finishings', value:'trim'}];
  }

  return {version:'1.0', print};
}

function defaultOption(capability, fallback) {
  const options = capability && Array.isArray(capability.option) ? capability.option : [];
  return options.find(x => x.is_default) || options[0] || fallback;
}

function makeTestPdf(printerName, widthMicrons, heightMicrons, trimSupported) {
  const widthPt = Math.max(144, micronsToPoints(widthMicrons));
  const heightPt = Math.max(168, micronsToPoints(heightMicrons));
  const lines = [
    'PRINTHUB',
    'DIRECT PRINTER TEST',
    '',
    'Printer: ' + printerName,
    'Time: ' + new Date().toLocaleString(),
    '',
    'Selected by printer ID.',
    trimSupported ? 'Cut: trim requested.' : 'Cut: driver does not expose trim.'
  ];

  const content = pdfTextStream(lines, 12, Math.max(30, heightPt - 24));
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + widthPt.toFixed(2) + ' ' + heightPt.toFixed(2) + '] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Length ' + byteLength(content) + ' >>\nstream\n' + content + '\nendstream'
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((obj, index) => {
    offsets.push(byteLength(pdf));
    pdf += (index + 1) + ' 0 obj\n' + obj + '\nendobj\n';
  });

  const xref = byteLength(pdf);
  pdf += 'xref\n0 ' + (objects.length + 1) + '\n';
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }

  pdf += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\n';
  pdf += 'startxref\n' + xref + '\n%%EOF';

  return new Blob([new TextEncoder().encode(pdf)], {type:'application/pdf'});
}

function pdfTextStream(lines, x, y) {
  const safe = s => String(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
  let out = 'BT\n/F1 9 Tf\n' + x + ' ' + y + ' Td\n';
  lines.forEach((line, i) => {
    if (i) out += '0 -14 Td\n';
    out += '(' + safe(line) + ') Tj\n';
  });
  return out + 'ET';
}

function micronsToPoints(v) {
  return Number(v || 0) * 72 / 25400;
}

function byteLength(s) {
  return new TextEncoder().encode(s).length;
}

async function submitPdfDocument(printerId, payload) {
  if (!printerId) throw new Error('Choose a printer.');

  const printers = await chrome.printing.getPrinters();
  const printer = printers.find(p => p.id === printerId);
  if (!printer) throw new Error('The selected printer is no longer installed.');

  const encoded = String(payload && payload.pdfBase64 || '');
  if (!encoded) throw new Error('PDF payload is required.');
  if (encoded.length > 4000000) throw new Error('PDF payload is too large for the PrintHub bridge.');

  const info = await chrome.printing.getPrinterInfo(printerId);
  const caps = info && info.capabilities && info.capabilities.printer;
  if (!caps) throw new Error('ChromeOS did not return capabilities for this printer.');

  const requestedHeight = clampNumber(payload && payload.heightMicrons, 60000, 500000, 100000);
  const trimSupported = supportsTrim(caps);
  const trimRequested = payload && payload.trim !== false;
  const media = chooseMedia(caps, requestedHeight);
  const ticket = buildTicket(caps, media, trimRequested && trimSupported);
  const pdf = base64ToBlob(encoded, 'application/pdf');

  const response = await chrome.printing.submitJob({
    job:{
      printerId,
      title:String(payload && payload.title || 'PrintHub Document').slice(0,120),
      ticket,
      contentType:'application/pdf',
      document:pdf
    }
  });

  return {
    status:response && response.status,
    jobId:response && response.jobId ? response.jobId : '',
    printerId,
    printerName:printer.name,
    trimSupported,
    trimRequested:Boolean(trimRequested && trimSupported),
    heightMicrons:Number(media.height_microns || requestedHeight)
  };
}

function base64ToBlob(base64, type) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], {type});
}

