import {requestClockTime} from '../shared/request-clock.js';

export function passKioskDocumentModel(transaction, options = {}) {
  const tx = transaction || {};
  const workflow = String(tx['Workflow'] || '').trim().toUpperCase();

  const common = {
    brand: String(options.schoolName || 'PassKiosk').trim(),
    title: workflowTitle(workflow),
    subtitle: String(tx['Transaction ID'] || '').trim(),
    fields: [
      field('Student', tx['Student Name']),
      field('Grade', tx['Grade'])
    ].filter(Boolean),
    body: '',
    footer: sourceFooter(tx)
  };

  if (workflow === 'PASS') {
    common.fields.push(
      field('From', tx['From']),
      field('To', tx['To']),
      {label:'Excused', value:tx['Excused'] === true ? 'Yes' : 'No'},
      field('Reason', tx['Reason(s)']),
      field('Issued', displayDateTime(tx['Created At']))
    );
    return compactModel(common);
  }

  if (workflow === 'RQST') {
    common.fields.push(
      field('Requested by', tx['Requested By']),
      field('Send student to', tx['Destination']),
      field('When', requestWhen(tx)),
      field('Delivery period', tx['Delivery Period']),
      field('Delivery room', tx['Delivery Room']),
      field('Delivery teacher', tx['Delivery Teacher']),
      field('Reason', tx['Reason(s)']),
      field('Created', displayDateTime(tx['Created At']))
    );
    return compactModel(common);
  }

  if (workflow === 'DET' || workflow === 'LUNCH_DET') {
    common.fields.push(
      field('Issued by', tx['Issued By']),
      field('Date', displayDate(tx['Detention Date'])),
      field('Report to', tx['Report To']),
      field('Reason', tx['Reason(s)'])
    );

    common.body = String(tx['Directions Snapshot'] || '').trim();
    return compactModel(common);
  }

  common.title = workflow ? 'PassKiosk · ' + workflow : 'PassKiosk Document';
  common.fields.push(
    field('Created', displayDateTime(tx['Created At'])),
    field('Notes', tx['Notes'])
  );

  return compactModel(common);
}

function workflowTitle(workflow) {
  if (workflow === 'PASS') return 'Hall Pass';
  if (workflow === 'RQST') return 'Call Pass';
  if (workflow === 'DET') return 'After-School Detention';
  if (workflow === 'LUNCH_DET') return 'Lunch Detention';
  if (workflow === 'BUS') return 'Late Bus';
  return 'PassKiosk Document';
}

function requestWhen(tx) {
  const when = String(tx['When'] || '').trim();
  const at = requestClockTime(tx['At Time']);
  if (!when) return '';
  if (when === 'At:' && at) return 'At ' + at;
  return when;
}

function sourceFooter(tx) {
  const pieces = [
    tx['Session User'] ? 'Created by ' + tx['Session User'] : '',
    tx['Transaction ID'] ? 'Transaction ' + tx['Transaction ID'] : ''
  ].filter(Boolean);

  return pieces.join(' · ');
}

function field(label, value) {
  const text = String(value ?? '').trim();
  return text ? {label, value:text} : null;
}

function compactModel(model) {
  return {
    ...model,
    fields:(model.fields || []).filter(Boolean)
  };
}

function displayDate(value) {
  const d = parseDate(value);
  if (!d) return String(value ?? '').trim();

  return new Intl.DateTimeFormat('en-US', {
    month:'short',
    day:'numeric',
    year:'numeric'
  }).format(d);
}

function displayDateTime(value) {
  const d = parseDate(value);
  if (!d) return String(value ?? '').trim();

  return new Intl.DateTimeFormat('en-US', {
    month:'short',
    day:'numeric',
    year:'numeric',
    hour:'numeric',
    minute:'2-digit'
  }).format(d);
}

function parseDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

