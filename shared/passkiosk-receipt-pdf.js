export function buildPassKioskReceiptPdf(transaction) {
  const tx = transaction || {};
  const workflow = String(tx['Workflow'] || '').trim().toUpperCase();
  const widthMicrons = 80000;
  const blocks = [];

  const addText = (text, size = 9, bold = false, align = 'left') => {
    const value = String(text ?? '').trim();
    if (!value) return;
    for (const line of wrapText(value, maxCharsForSize(size))) {
      blocks.push({kind:'text', text:line, size, bold, align});
    }
  };
  const addLabelValue = (label, value, boldValue = true) => {
    const clean = String(value ?? '').trim();
    if (!clean) return;
    addText(label, 7.5, true);
    addText(clean, 10, boldValue);
    blocks.push({kind:'gap', height:3});
  };

  addText('BECKER MIDDLE SCHOOL', 10, true, 'center');
  addText(workflowTitle(workflow), 15, true, 'center');
  blocks.push({kind:'rule'});

  addLabelValue('STUDENT', tx['Student Name']);
  const grade = String(tx['Grade'] ?? '').trim();
  if (grade) addText('Grade ' + grade, 8, false);
  blocks.push({kind:'gap', height:4});

  if (workflow === 'PASS') {
    addLabelValue('FROM', tx['From']);
    addLabelValue('TO', tx['To']);
    blocks.push({kind:'checkbox', label:'EXCUSED', checked:tx['Excused'] === true});
    blocks.push({kind:'gap', height:5});
    addLabelValue('REASON / EXCUSED FOR', tx['Reason(s)'], false);
    addLabelValue('ISSUED', formatDateTime(tx['Created At']), false);
  } else if (workflow === 'RQST') {
    addLabelValue('SEND STUDENT TO', tx['Destination']);
    addLabelValue('REQUESTED BY', tx['Requested By']);
    addLabelValue('WHEN', requestWhen(tx));
    const delivery = [tx['Delivery Period'], tx['Delivery Room'], tx['Delivery Teacher']]
      .map(v => String(v ?? '').trim()).filter(Boolean);
    if (delivery.length) addLabelValue('DELIVER TO', unique(delivery).join(' - '), false);
    addLabelValue('REASON', tx['Reason(s)'], false);
  } else if (workflow === 'DET' || workflow === 'LUNCH_DET') {
    addLabelValue('ISSUED BY', tx['Issued By']);
    addLabelValue('DATE', formatDate(tx['Detention Date']), false);
    addLabelValue('REPORT TO', tx['Report To']);
    addLabelValue('REASON', tx['Reason(s)'], false);
    const directions = String(tx['Directions Snapshot'] || '').trim();
    if (directions) {
      addText('DIRECTIONS', 7.5, true);
      for (const line of directions.split(/\r?\n/).map(x => x.trim()).filter(Boolean)) {
        addText('- ' + line, 8.5, false);
      }
      blocks.push({kind:'gap', height:3});
    }
  } else {
    addLabelValue('WORKFLOW', workflow || 'UNKNOWN', false);
    addLabelValue('CREATED', formatDateTime(tx['Created At']), false);
    addLabelValue('NOTES', tx['Notes'], false);
  }

  blocks.push({kind:'rule'});
  const by = String(tx['Session User'] || '').trim();
  if (by) addText('Created by ' + by, 7.5, false, 'center');
  const tid = String(tx['Transaction ID'] || '').trim();
  if (tid) addText(tid, 6.5, false, 'center');

  const topPt = 14;
  const bottomPt = 18;
  const contentPt = blocks.reduce((sum, block) => sum + blockHeight(block), 0);
  const minPt = micronsToPoints(90000);
  const heightPt = Math.max(minPt, topPt + contentPt + bottomPt);
  const heightMicrons = Math.ceil(heightPt * 25400 / 72 / 1000) * 1000;
  const actualHeightPt = micronsToPoints(heightMicrons);
  const widthPt = micronsToPoints(widthMicrons);

  let y = actualHeightPt - topPt;
  let stream = '';
  for (const block of blocks) {
    if (block.kind === 'gap') {
      y -= Number(block.height || 3);
      continue;
    }
    if (block.kind === 'rule') {
      stream += '0.5 w 10 ' + y.toFixed(2) + ' m ' + (widthPt - 10).toFixed(2) + ' ' + y.toFixed(2) + ' l S\n';
      y -= 8;
      continue;
    }
    if (block.kind === 'checkbox') {
      const box = 8;
      const x = 12;
      const boxY = y - box + 1;
      stream += '0.8 w ' + x + ' ' + boxY.toFixed(2) + ' ' + box + ' ' + box + ' re S\n';
      if (block.checked) {
        stream += '1 w ' + (x + 1.5) + ' ' + (boxY + 4).toFixed(2) + ' m ' + (x + 3.5) + ' ' + (boxY + 1.5).toFixed(2) + ' l ' + (x + 7) + ' ' + (boxY + 7).toFixed(2) + ' l S\n';
      }
      stream += pdfText(block.label, 9, true, x + 13, y, 'left', widthPt);
      y -= 12;
      continue;
    }
    if (block.kind === 'text') {
      stream += pdfText(block.text, block.size, block.bold, 10, y, block.align, widthPt);
      y -= textLineHeight(block.size);
    }
  }

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + widthPt.toFixed(2) + ' ' + actualHeightPt.toFixed(2) + '] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    '<< /Length ' + byteLength(stream) + ' >>\nstream\n' + stream + 'endstream'
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((obj, i) => {
    offsets.push(byteLength(pdf));
    pdf += (i + 1) + ' 0 obj\n' + obj + '\nendobj\n';
  });
  const xref = byteLength(pdf);
  pdf += 'xref\n0 ' + (objects.length + 1) + '\n';
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  pdf += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\n';
  pdf += 'startxref\n' + xref + '\n%%EOF';

  return {
    title: workflowTitle(workflow) + (tx['Student Name'] ? ' - ' + String(tx['Student Name']).trim() : ''),
    widthMicrons,
    heightMicrons,
    pdfBase64: bytesToBase64(new TextEncoder().encode(pdf))
  };
}

function workflowTitle(workflow) {
  if (workflow === 'PASS') return 'HALL PASS';
  if (workflow === 'RQST') return 'CALL PASS';
  if (workflow === 'DET') return 'AFTER-SCHOOL DETENTION';
  if (workflow === 'LUNCH_DET') return 'LUNCH DETENTION';
  if (workflow === 'BUS') return 'ACTIVITY BUS';
  return workflow ? 'PASSKIOSK ' + workflow : 'PASSKIOSK DOCUMENT';
}
function requestWhen(tx) {
  const when = String(tx['When'] || '').trim();
  const at = String(tx['At Time'] || '').trim();
  if (!when) return '';
  return when === 'At:' && at ? 'At ' + at : when;
}
function formatDateTime(value) {
  const d = parseDate(value);
  if (!d) return String(value ?? '').trim();
  return new Intl.DateTimeFormat('en-US', {month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}).format(d);
}
function formatDate(value) {
  const d = parseDate(value);
  if (!d) return String(value ?? '').trim();
  return new Intl.DateTimeFormat('en-US', {month:'short',day:'numeric',year:'numeric'}).format(d);
}
function parseDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
function maxCharsForSize(size) {
  if (size >= 14) return 24;
  if (size >= 10) return 34;
  if (size >= 9) return 40;
  return 46;
}
function wrapText(text, maxChars) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const words = clean.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? line + ' ' + word : word;
    if (candidate.length <= maxChars || !line) line = candidate;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}
function blockHeight(block) {
  if (block.kind === 'gap') return Number(block.height || 3);
  if (block.kind === 'rule') return 8;
  if (block.kind === 'checkbox') return 12;
  if (block.kind === 'text') return textLineHeight(block.size);
  return 0;
}
function textLineHeight(size) { return Math.max(9.5, Number(size || 9) + 2.5); }
function pdfText(text, size, bold, x, y, align, widthPt) {
  const font = bold ? 'F2' : 'F1';
  let drawX = Number(x || 10);
  if (align === 'center') {
    const approxWidth = String(text).length * Number(size || 9) * 0.49;
    drawX = Math.max(10, (widthPt - approxWidth) / 2);
  }
  return 'BT\n/' + font + ' ' + Number(size || 9) + ' Tf\n' + drawX.toFixed(2) + ' ' + Number(y).toFixed(2) + ' Td\n(' + pdfEscape(text) + ') Tj\nET\n';
}
function pdfEscape(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7E]/g, '?');
}
function micronsToPoints(value) { return Number(value || 0) * 72 / 25400; }
function byteLength(value) { return new TextEncoder().encode(value).length; }
function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}
function unique(values) { return [...new Set(values)]; }
