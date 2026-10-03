import test from 'node:test';
import assert from 'node:assert/strict';
import { passKioskDocumentModel } from '../adapters/passkiosk.js';

test('PASS transaction maps to generic hall-pass model', () => {
  const model = passKioskDocumentModel({
    'Transaction ID':'PK-1',
    'Workflow':'PASS',
    'Student Name':'Sample Student',
    'Grade':'7',
    'From':'Library',
    'To':'Room 204',
    'Reason(s)':'Returning to class',
    'Created At':'2026-10-03T18:30:00-07:00',
    'Session User':'Sample Staff'
  }, {schoolName:'Becker Middle School'});

  assert.equal(model.brand, 'Becker Middle School');
  assert.equal(model.title, 'Hall Pass');
  assert.ok(model.fields.some(x => x.label === 'From' && x.value === 'Library'));
  assert.ok(model.fields.some(x => x.label === 'To' && x.value === 'Room 204'));
});

test('RQST transaction maps destination and delivery information', () => {
  const model = passKioskDocumentModel({
    'Transaction ID':'PK-2',
    'Workflow':'RQST',
    'Student Name':'Sample Student',
    'Requested By':'Sample Adult',
    'Destination':'Main Office',
    'When':'At:',
    'At Time':'1:15 PM',
    'Delivery Period':'P6',
    'Delivery Room':'210',
    'Delivery Teacher':'Sample Teacher'
  });

  assert.equal(model.title, 'Call Pass');
  assert.ok(model.fields.some(x => x.label === 'Send student to' && x.value === 'Main Office'));
  assert.ok(model.fields.some(x => x.label === 'When' && x.value === 'At 1:15 PM'));
});

test('detention transaction keeps directions as body content', () => {
  const model = passKioskDocumentModel({
    'Transaction ID':'PK-3',
    'Workflow':'LUNCH_DET',
    'Student Name':'Sample Student',
    'Issued By':'Sample Administrator',
    'Detention Date':'2026-10-05T00:00:00-07:00',
    'Report To':'Cafeteria',
    'Reason(s)':'Tardy',
    'Directions Snapshot':'Report directly to the cafeteria.\nCheck in on arrival.'
  });

  assert.equal(model.title, 'Lunch Detention');
  assert.match(model.body, /Report directly/);
  assert.match(model.body, /Check in/);
});

test('unknown workflow still produces a generic printable model', () => {
  const model = passKioskDocumentModel({
    'Transaction ID':'PK-4',
    'Workflow':'FUTURE',
    'Student Name':'Sample Student'
  });

  assert.equal(model.title, 'PassKiosk · FUTURE');
  assert.equal(model.subtitle, 'PK-4');
});
