import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateRegistry, expandPrintSelection } from '../shared/routing.js';

const registry = JSON.parse(
  await readFile(new URL('../config/routes.example.json', import.meta.url), 'utf8')
);

test('example routing registry validates', () => {
  assert.equal(validateRegistry(registry), true);
});

test('one selected route creates one primary job', () => {
  const jobs = expandPrintSelection({
    transactionId: 'T-100',
    sourceApp: 'PASSKIOSK',
    primaryRouteId: 'FRONT_RECEIPT'
  }, registry);

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].copyRole, 'PRIMARY');
  assert.equal(jobs[0].routeId, 'FRONT_RECEIPT');
  assert.equal(jobs[0].endpointId, 'PH-FRONT-RECEIPT-01');
  assert.equal(jobs[0].bindingKey, 'DEFAULT');
  assert.equal(jobs[0].mediaProfileId, '80MM_RECEIPT');
  assert.equal(jobs[0].status, 'QUEUED');
});

test('second copy fans one transaction into sibling jobs', () => {
  const jobs = expandPrintSelection({
    transactionId: 'T-200',
    sourceApp: 'PASSKIOSK',
    primaryRouteId: 'AP_RECEIPT',
    secondaryRouteId: 'AP_FILE'
  }, registry);

  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].jobGroupId, jobs[1].jobGroupId);
  assert.equal(jobs[0].sourceTransactionId, 'T-200');
  assert.equal(jobs[1].sourceTransactionId, 'T-200');
  assert.equal(jobs[0].copyRole, 'PRIMARY');
  assert.equal(jobs[1].copyRole, 'SECONDARY');
  assert.equal(jobs[0].bindingKey, 'RECEIPT');
  assert.equal(jobs[1].bindingKey, 'FILE');
  assert.equal(jobs[0].endpointId, 'PH-AP-WIN-01');
  assert.equal(jobs[1].endpointId, 'PH-AP-WIN-01');
});

test('same route cannot be selected as both copies', () => {
  assert.throws(() => expandPrintSelection({
    transactionId: 'T-300',
    sourceApp: 'PASSKIOSK',
    primaryRouteId: 'AP_RECEIPT',
    secondaryRouteId: 'AP_RECEIPT'
  }, registry), /must be different/);
});

test('unknown route is rejected', () => {
  assert.throws(() => expandPrintSelection({
    transactionId: 'T-400',
    sourceApp: 'PASSKIOSK',
    primaryRouteId: 'DOES_NOT_EXIST'
  }, registry), /Unknown print route/);
});

test('invalid binding in registry is rejected', () => {
  const broken = structuredClone(registry);
  broken.routes[0].bindingKey = 'MISSING';

  assert.throws(() => validateRegistry(broken), /missing binding/i);
});

test('invalid media profile in registry is rejected', () => {
  const broken = structuredClone(registry);
  broken.routes[0].mediaProfileId = 'MISSING';

  assert.throws(() => validateRegistry(broken), /missing media profile/i);
});

test('duplicate route IDs are rejected', () => {
  const broken = structuredClone(registry);
  broken.routes.push(structuredClone(broken.routes[0]));

  assert.throws(() => validateRegistry(broken), /Duplicate route ID/);
});

test('duplicate endpoint IDs are rejected', () => {
  const broken = structuredClone(registry);
  broken.endpoints.push(structuredClone(broken.endpoints[0]));

  assert.throws(() => validateRegistry(broken), /Duplicate endpoint ID/);
});

test('route renderer is required', () => {
  const broken = structuredClone(registry);
  delete broken.routes[0].rendererId;

  assert.throws(() => validateRegistry(broken), /renderer ID/);
});

test('endpoint binding mode is required', () => {
  const broken = structuredClone(registry);
  delete broken.endpoints[0].bindings.DEFAULT.mode;

  assert.throws(() => validateRegistry(broken), /missing mode/i);
});
