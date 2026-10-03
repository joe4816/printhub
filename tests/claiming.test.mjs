import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claimJob,
  isClaimExpired,
  recoverExpiredClaim,
  assertClaimOwner
} from '../shared/claiming.js';

const baseJob = {
  printJobId:'PJ-1',
  endpointId:'PH-ONE',
  status:'QUEUED',
  history:[]
};

test('queued job can be claimed only by its endpoint', () => {
  const claimed = claimJob(baseJob, {
    endpointId:'PH-ONE',
    claimId:'CLAIM-1',
    now:'2026-10-03T19:00:00Z',
    leaseMs:60000
  });

  assert.equal(claimed.status, 'CLAIMED');
  assert.equal(claimed.claimedBy, 'PH-ONE');
  assert.equal(claimed.claimId, 'CLAIM-1');
  assert.equal(claimed.leaseExpiresAt, '2026-10-03T19:01:00.000Z');
});

test('wrong endpoint cannot claim job', () => {
  assert.throws(() => claimJob(baseJob, {
    endpointId:'PH-TWO',
    claimId:'CLAIM-1',
    now:'2026-10-03T19:00:00Z'
  }), /not authorized/);
});

test('expired claimed job can safely return to queued', () => {
  const claimed = claimJob(baseJob, {
    endpointId:'PH-ONE',
    claimId:'CLAIM-1',
    now:'2026-10-03T19:00:00Z',
    leaseMs:60000
  });

  assert.equal(isClaimExpired(claimed, '2026-10-03T19:01:01Z'), true);

  const recovered = recoverExpiredClaim(claimed, '2026-10-03T19:01:01Z');
  assert.equal(recovered.status, 'QUEUED');
  assert.equal(recovered.claimedBy, '');
  assert.equal(recovered.history.at(-1).recovery, 'EXPIRED_CLAIM');
});

test('active claim ownership is checked by endpoint and claim ID', () => {
  const claimed = claimJob(baseJob, {
    endpointId:'PH-ONE',
    claimId:'CLAIM-1',
    now:'2026-10-03T19:00:00Z',
    leaseMs:60000
  });

  assert.equal(assertClaimOwner(claimed, {
    endpointId:'PH-ONE',
    claimId:'CLAIM-1',
    now:'2026-10-03T19:00:30Z'
  }), true);

  assert.throws(() => assertClaimOwner(claimed, {
    endpointId:'PH-ONE',
    claimId:'WRONG',
    now:'2026-10-03T19:00:30Z'
  }), /ownership/);
});

test('expired claim cannot report completion', () => {
  const claimed = claimJob(baseJob, {
    endpointId:'PH-ONE',
    claimId:'CLAIM-1',
    now:'2026-10-03T19:00:00Z',
    leaseMs:60000
  });

  assert.throws(() => assertClaimOwner(claimed, {
    endpointId:'PH-ONE',
    claimId:'CLAIM-1',
    now:'2026-10-03T19:01:05Z'
  }), /expired/);
});
