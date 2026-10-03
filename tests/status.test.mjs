import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, applyTransition, applyRetry } from '../shared/status.js';

test('happy-path status progression is allowed', () => {
  assert.equal(canTransition('QUEUED','CLAIMED'), true);
  assert.equal(canTransition('CLAIMED','PRINT_INVOKED'), true);
  assert.equal(canTransition('PRINT_INVOKED','PRINTED'), true);
});

test('terminal printed job cannot transition further', () => {
  assert.equal(canTransition('PRINTED','FAILED'), false);
  assert.throws(() => applyTransition({status:'PRINTED'}, 'FAILED'), /Invalid print-job transition/);
});

test('failed job can be deliberately retried', () => {
  const retried = applyRetry({status:'FAILED',attempts:0,history:[]});
  assert.equal(retried.status, 'QUEUED');
  assert.equal(retried.attempts, 1);
  assert.equal(retried.history.at(-1).retry, true);
});

test('non-failed job cannot use retry transition', () => {
  assert.throws(() => applyRetry({status:'QUEUED'}), /Only FAILED jobs/);
});
