import { expandPrintSelection } from '../shared/routing.js';
import { renderDocument } from '../shared/renderers.js';

let registry;
let jobs = [];
let selectedJobId = '';

const $ = id => document.getElementById(id);

document.addEventListener('DOMContentLoaded', init);

async function init() {
  registry = await fetch('../config/routes.example.json').then(r => {
    if (!r.ok) throw new Error('Could not load routing registry.');
    return r.json();
  });

  populateRoutes();
  $('sendSecond').addEventListener('change', toggleSecond);
  $('createJobs').addEventListener('click', createJobs);
  $('reset').addEventListener('click', reset);
  $('printPreview').addEventListener('click', printPreview);
  toggleSecond();
  log('Simulator ready. No production systems are connected.');
}

function populateRoutes() {
  const options = (registry.routes || []).map(route =>
    '<option value="' + escAttr(route.id) + '">' + esc(route.label || route.id) + ' · ' + esc(route.mediaProfileId) + '</option>'
  ).join('');

  $('primaryRoute').innerHTML = options;
  $('secondaryRoute').innerHTML = options;

  if ($('secondaryRoute').options.length > 1) {
    $('secondaryRoute').selectedIndex = 1;
  }
}

function toggleSecond() {
  $('secondaryWrap').hidden = !$('sendSecond').checked;
}

function createJobs() {
  clearError();

  try {
    const input = {
      transactionId: $('transactionId').value.trim(),
      sourceApp: 'SIMULATOR',
      primaryRouteId: $('primaryRoute').value,
      secondaryRouteId: $('sendSecond').checked ? $('secondaryRoute').value : ''
    };

    jobs = expandPrintSelection(input, registry).map(job => ({
      ...job,
      status: 'QUEUED',
      attempts: 0,
      history: [{status:'QUEUED', at:new Date().toISOString()}]
    }));

    selectedJobId = jobs[0] ? jobs[0].printJobId : '';
    render();
    log('Created ' + jobs.length + ' simulated print job' + (jobs.length === 1 ? '' : 's') + ' for ' + input.transactionId + '.');
  } catch (err) {
    showError(err.message);
  }
}

function reset() {
  jobs = [];
  selectedJobId = '';
  $('events').innerHTML = '';
  render();
  log('Simulator reset.');
}

function render() {
  $('jobCount').textContent = jobs.length + (jobs.length === 1 ? ' job' : ' jobs');

  if (!jobs.length) {
    $('queues').className = 'queues empty';
    $('queues').textContent = 'Create a simulated transaction to populate endpoint queues.';
    $('preview').className = 'preview empty';
    $('preview').textContent = 'Select a job to preview its renderer and media profile.';
    $('printPreview').disabled = true;
    return;
  }

  const grouped = groupBy(jobs, job => job.endpointId);
  $('queues').className = 'queues';
  $('queues').innerHTML = [...grouped.entries()].map(([endpointId, endpointJobs]) => {
    const endpoint = (registry.endpoints || []).find(x => x.id === endpointId);
    const label = endpoint ? endpoint.label : endpointId;

    return '<section class="queue">' +
      '<div class="queue-head"><strong>' + esc(label) + '</strong><span class="pill">' + esc(endpointId) + '</span></div>' +
      '<div class="queue-jobs">' + endpointJobs.map(jobCard).join('') + '</div>' +
      '</section>';
  }).join('');

  $('queues').querySelectorAll('[data-job-id]').forEach(el => {
    el.addEventListener('click', event => {
      if (event.target.closest('button')) return;
      selectedJobId = el.dataset.jobId;
      render();
    });
  });

  $('queues').querySelectorAll('[data-action]').forEach(button => {
    button.addEventListener('click', () => transition(button.dataset.jobId, button.dataset.action));
  });

  renderPreview();
}

function jobCard(job) {
  const selected = job.printJobId === selectedJobId ? ' selected' : '';
  return '<article class="job' + selected + '" data-job-id="' + escAttr(job.printJobId) + '">' +
    '<div><strong>' + esc(job.routeLabel) + '</strong>' +
    '<div class="meta">' + esc(job.copyRole) + ' · ' + esc(job.mediaProfileId) + ' · ' + esc(job.bindingKey) + '</div></div>' +
    '<span class="state s-' + escAttr(job.status.toLowerCase()) + '">' + esc(job.status) + '</span>' +
    '<div class="job-actions">' +
      actionButton(job, 'CLAIMED', 'Claim') +
      actionButton(job, 'PRINT_INVOKED', 'Invoke print') +
      actionButton(job, 'PRINTED', 'Mark printed') +
      actionButton(job, 'FAILED', 'Fail') +
      (job.status === 'FAILED' ? '<button class="ghost" data-action="RETRY" data-job-id="' + escAttr(job.printJobId) + '">Retry</button>' : '') +
    '</div>' +
    '</article>';
}

function actionButton(job, status, label) {
  const allowed = {
    QUEUED:['CLAIMED','FAILED'],
    CLAIMED:['PRINT_INVOKED','FAILED'],
    PRINT_INVOKED:['PRINTED','FAILED'],
    PRINTED:[],
    FAILED:[]
  };

  const disabled = !(allowed[job.status] || []).includes(status);
  return '<button class="ghost" ' + (disabled ? 'disabled ' : '') +
    'data-action="' + status + '" data-job-id="' + escAttr(job.printJobId) + '">' + esc(label) + '</button>';
}

function transition(jobId, action) {
  const job = jobs.find(x => x.printJobId === jobId);
  if (!job) return;

  if (action === 'RETRY') {
    job.status = 'QUEUED';
    job.attempts += 1;
    job.history.push({status:'QUEUED', at:new Date().toISOString(), retry:true});
    log('Retry queued for ' + job.routeLabel + ' (attempt ' + (job.attempts + 1) + ').');
  } else {
    job.status = action;
    job.history.push({status:action, at:new Date().toISOString()});
    log(job.routeLabel + ' → ' + action + '.');
  }

  selectedJobId = jobId;
  render();
}

function renderPreview() {
  const job = jobs.find(x => x.printJobId === selectedJobId) || jobs[0];
  if (!job) return;

  selectedJobId = job.printJobId;
  const rendered = renderDocument(job, samplePayload());

  $('preview').className = 'preview';
  $('preview').innerHTML = rendered.html;
  $('printPreview').disabled = false;
}

function printPreview() {
  const job = jobs.find(x => x.printJobId === selectedJobId);
  if (!job) return;

  const rendered = renderDocument(job, samplePayload());
  $('printSurface').innerHTML = rendered.html;
  installPrintRule(rendered.pageStyle);
  log('Browser print preview invoked for ' + job.routeLabel + '.');
  window.print();
}

function samplePayload() {
  return {
    brand:'PrintHub Simulator',
    title:$('docTitle').value.trim() || 'Print Document',
    subtitle:$('docSubtitle').value.trim(),
    fields:[
      {label:'Student', value:$('studentName').value.trim()},
      {label:'Destination', value:$('destination').value.trim()},
      {label:'Time', value:new Date().toLocaleString()}
    ],
    body:'This document was generated entirely inside the PrintHub simulator.',
    footer:'No production queue or student system was contacted.'
  };
}

function installPrintRule(rule) {
  let style = document.getElementById('simPageRule');
  if (!style) {
    style = document.createElement('style');
    style.id = 'simPageRule';
    document.head.appendChild(style);
  }
  style.textContent = rule;
}

function groupBy(items, fn) {
  const map = new Map();
  for (const item of items) {
    const key = fn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function log(message) {
  const li = document.createElement('li');
  const time = document.createElement('time');
  time.textContent = new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit',second:'2-digit'});
  const span = document.createElement('span');
  span.textContent = message;
  li.append(time, span);
  $('events').prepend(li);
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

function escAttr(value) {
  return esc(value);
}
