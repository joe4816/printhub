const MEDIA_PAGE_STYLES = Object.freeze({
  '80MM_RECEIPT': '@page { size: 80mm 120mm; margin: 4mm; }',
  'LETTER_FILE': '@page { size: letter portrait; margin: 0.5in; }',
  'HALF_LETTER_LANDSCAPE': '@page { size: 11in 5.5in; margin: 0.5in; }'
});

export function renderDocument(job, payload = {}) {
  const media = String(job && job.mediaProfileId || '').trim();
  const rendererId = String(job && job.rendererId || '').trim();

  if (!media) throw new Error('mediaProfileId is required.');
  if (!rendererId) throw new Error('rendererId is required.');

  const model = normalizePayload(payload);

  if (media === '80MM_RECEIPT') {
    return renderReceipt(job, model);
  }

  if (media === 'LETTER_FILE' || media === 'HALF_LETTER_LANDSCAPE') {
    return renderFileCopy(job, model);
  }

  throw new Error('Unsupported media profile: ' + media + '.');
}

export function pageStyleFor(mediaProfileId) {
  const style = MEDIA_PAGE_STYLES[String(mediaProfileId || '')];
  if (!style) throw new Error('Unsupported media profile: ' + mediaProfileId + '.');
  return style;
}

function renderReceipt(job, model) {
  const fields = model.fields.map(field =>
    '<div class="ph-field"><span>' + esc(field.label) + '</span><strong>' + esc(field.value) + '</strong></div>'
  ).join('');

  const body = model.body
    ? '<div class="ph-body">' + esc(model.body).replace(/\n/g, '<br>') + '</div>'
    : '';

  const html = [
    '<article class="ph-doc ph-receipt">',
    '<header>',
    '<div class="ph-brand">' + esc(model.brand || 'PrintHub') + '</div>',
    '<h1>' + esc(model.title) + '</h1>',
    model.subtitle ? '<div class="ph-subtitle">' + esc(model.subtitle) + '</div>' : '',
    '</header>',
    '<div class="ph-rule"></div>',
    fields,
    body,
    '<div class="ph-rule"></div>',
    '<footer>',
    model.footer ? '<div>' + esc(model.footer) + '</div>' : '',
    '<div class="ph-meta">' + esc(job.routeLabel || job.routeId || '') + '</div>',
    '</footer>',
    '</article>'
  ].join('');

  return {
    title: model.title,
    mediaProfileId: job.mediaProfileId,
    pageStyle: pageStyleFor(job.mediaProfileId),
    html
  };
}

function renderFileCopy(job, model) {
  const rows = model.fields.map(field =>
    '<tr><th>' + esc(field.label) + '</th><td>' + esc(field.value) + '</td></tr>'
  ).join('');

  const html = [
    '<article class="ph-doc ph-file-copy">',
    '<header>',
    '<div class="ph-brand">' + esc(model.brand || 'PrintHub') + '</div>',
    '<h1>' + esc(model.title) + '</h1>',
    model.subtitle ? '<div class="ph-subtitle">' + esc(model.subtitle) + '</div>' : '',
    '</header>',
    '<table><tbody>' + rows + '</tbody></table>',
    model.body ? '<section class="ph-body">' + esc(model.body).replace(/\n/g, '<br>') + '</section>' : '',
    '<footer>',
    model.footer ? '<div>' + esc(model.footer) + '</div>' : '',
    '<div class="ph-meta">Route: ' + esc(job.routeLabel || job.routeId || '') + '</div>',
    '</footer>',
    '</article>'
  ].join('');

  return {
    title: model.title,
    mediaProfileId: job.mediaProfileId,
    pageStyle: pageStyleFor(job.mediaProfileId),
    html
  };
}

function normalizePayload(payload) {
  const fields = Array.isArray(payload.fields)
    ? payload.fields.map(x => ({
        label: String(x && x.label || '').trim(),
        value: String(x && x.value || '').trim()
      })).filter(x => x.label || x.value)
    : [];

  return {
    brand: String(payload.brand || 'PrintHub').trim(),
    title: String(payload.title || 'Print Document').trim(),
    subtitle: String(payload.subtitle || '').trim(),
    body: String(payload.body || '').trim(),
    footer: String(payload.footer || '').trim(),
    fields
  };
}

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    "'":'&#39;',
    '"':'&quot;'
  })[c]);
}
