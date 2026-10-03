import { expandPrintSelection } from '../../shared/routing.js';

let registry;
const $ = id => document.getElementById(id);

document.addEventListener('DOMContentLoaded', init);

async function init() {
  registry = await fetch('../../config/routes.example.json').then(r => r.json());

  const options = registry.routes.map(route =>
    '<option value="' + esc(route.id) + '">' + esc(route.label || route.id) + '</option>'
  ).join('');

  $('primary').innerHTML = options;
  $('secondary').innerHTML = options;

  if ($('secondary').options.length > 1) $('secondary').selectedIndex = 1;

  $('sendSecond').addEventListener('change', update);
  $('primary').addEventListener('change', update);
  $('secondary').addEventListener('change', update);
  $('continue').addEventListener('click', update);

  update();
}

function update() {
  $('secondaryRow').hidden = !$('sendSecond').checked;
  $('pickerError').hidden = true;

  try {
    const jobs = expandPrintSelection({
      transactionId:'PROTOTYPE-TRANSACTION',
      sourceApp:'PASSKIOSK',
      primaryRouteId:$('primary').value,
      secondaryRouteId:$('sendSecond').checked ? $('secondary').value : ''
    }, registry);

    $('result').innerHTML = jobs.map((job, i) =>
      '<div class="job">' +
        '<div class="copy">' + (i + 1) + '</div>' +
        '<div>' +
          '<strong>' + esc(job.copyRole + ' · ' + job.routeLabel) + '</strong>' +
          '<div class="meta">Endpoint: ' + esc(job.endpointId) + '</div>' +
          '<div class="meta">Binding: ' + esc(job.bindingKey) + ' · Media: ' + esc(job.mediaProfileId) + '</div>' +
        '</div>' +
      '</div>'
    ).join('');
  } catch (err) {
    $('pickerError').hidden = false;
    $('pickerError').textContent = err.message;
    $('result').innerHTML = '<div class="empty">Fix the printer selection above.</div>';
  }
}

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  })[c]);
}
