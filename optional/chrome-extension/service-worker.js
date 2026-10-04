const EXTENSION_VERSION='0.2.0';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'PRINTHUB_REQUEST') return;

  handleRequest(String(msg.action || ''), msg.payload || {})
    .then(value => sendResponse({ok:true,value}))
    .catch(err => sendResponse({ok:false,error:String(err && err.message || err)}));

  return true;
});

chrome.printing.onJobStatusChanged.addListener((jobId, status) => {
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
    return submitTestPrint(String(payload.printerId || ''));
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

async function submitTestPrint(printerId) {
  if (!printerId) throw new Error('Choose a printer.');

  const printers = await chrome.printing.getPrinters();
  const printer = printers.find(p => p.id === printerId);
  if (!printer) throw new Error('The selected printer is no longer installed.');

  const info = await chrome.printing.getPrinterInfo(printerId);
  const caps = info && info.capabilities && info.capabilities.printer;
  if (!caps) throw new Error('ChromeOS did not return capabilities for this printer.');

  const media = chooseMedia(caps);
  const ticket = buildTicket(caps, media);
  const widthMicrons = Number(media.width_microns || 80000);
  const heightMicrons = Number(media.height_microns || 140000);
  const pdf = makeTestPdf(printer.name, widthMicrons, heightMicrons);

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
    printerName:printer.name
  };
}

function chooseMedia(caps) {
  const options = caps.media_size && Array.isArray(caps.media_size.option)
    ? caps.media_size.option : [];

  if (!options.length) {
    return {width_microns:80000,height_microns:140000};
  }

  const continuous = options.find(x => x.is_continuous_feed);
  if (continuous) {
    const minH = Number(continuous.min_height_microns || 25400);
    const maxH = Number(continuous.max_height_microns || 2000000);
    return {
      width_microns:Number(continuous.width_microns || 80000),
      height_microns:Math.max(minH, Math.min(140000, maxH))
    };
  }

  const eighty = options.find(x => {
    const w=Number(x.width_microns || 0);
    return w >= 76000 && w <= 82000;
  });
  const preferred = eighty || options.find(x => x.is_default) || options[0];
  return {
    width_microns:Number(preferred.width_microns || 80000),
    height_microns:Number(preferred.height_microns || 140000),
    vendor_id:preferred.vendor_id
  };
}

function buildTicket(caps, media) {
  const color = defaultOption(caps.color, {type:'STANDARD_MONOCHROME'});
  const duplex = defaultOption(caps.duplex, {type:'NO_DUPLEX'});
  const orientation = defaultOption(caps.page_orientation, {type:'PORTRAIT'});
  const dpi = defaultOption(caps.dpi, {horizontal_dpi:203,vertical_dpi:203});

  return {
    version:'1.0',
    print:{
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
    }
  };
}

function defaultOption(capability, fallback) {
  const options = capability && Array.isArray(capability.option) ? capability.option : [];
  return options.find(x => x.is_default) || options[0] || fallback;
}

function makeTestPdf(printerName, widthMicrons, heightMicrons) {
  const widthPt = Math.max(144, micronsToPoints(widthMicrons));
  const heightPt = Math.max(180, micronsToPoints(heightMicrons));
  const lines = [
    'PRINTHUB',
    'DIRECT PRINTER TEST',
    '',
    'Printer: ' + printerName,
    'Time: ' + new Date().toLocaleString(),
    '',
    'Selected by printer ID.',
    'No default-printer policy used.'
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
