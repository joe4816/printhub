const $ = id => document.getElementById(id);
let generatedUrl = '';

document.addEventListener('DOMContentLoaded', init);

async function init() {
  const registry = await fetch('../config/routes.example.json').then(r => r.json());

  $('media').innerHTML = Object.entries(registry.mediaProfiles || {}).map(([id, profile]) =>
    '<option value="' + esc(id) + '">' + esc(id + ' · ' + (profile.description || '')) + '</option>'
  ).join('');

  $('generate').addEventListener('click', generate);
  $('apply').addEventListener('click', () => {
    if (generatedUrl) location.href = generatedUrl;
  });
  $('copy').addEventListener('click', copyUrl);
}

function generate() {
  clearError();

  const endpoint = cleanId($('endpoint').value);
  const label = $('label').value.trim();
  const media = cleanId($('media').value);

  if (!endpoint || endpoint === 'PH-UNASSIGNED') {
    showError('Enter a real endpoint ID.');
    return;
  }

  if (!/^PH-[A-Z0-9_-]+$/.test(endpoint)) {
    showError('Endpoint ID should begin with PH- and use letters, numbers, underscores, or hyphens.');
    return;
  }

  if (!label) {
    showError('Enter a human-readable endpoint label.');
    return;
  }

  const url = new URL('../', location.href);
  url.searchParams.set('endpoint', endpoint);
  url.searchParams.set('label', label);
  url.searchParams.set('media', media);

  generatedUrl = url.toString();
  $('url').value = generatedUrl;
  $('copy').disabled = false;
  $('apply').disabled = false;
}

async function copyUrl() {
  if (!generatedUrl) return;

  try {
    await navigator.clipboard.writeText(generatedUrl);
    $('copy').textContent = 'Copied';
    setTimeout(() => $('copy').textContent = 'Copy', 1400);
  } catch (_) {
    $('url').select();
    document.execCommand('copy');
  }
}

function cleanId(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 80);
}

function showError(message) {
  $('error').hidden = false;
  $('error').textContent = message;
}

function clearError() {
  $('error').hidden = true;
  $('error').textContent = '';
}

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  })[c]);
}
