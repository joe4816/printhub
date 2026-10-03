export function claimJob(job, options = {}) {
  if (!job || job.status !== 'QUEUED') {
    throw new Error('Only QUEUED jobs can be claimed.');
  }

  const endpointId = String(options.endpointId || '').trim();
  const claimId = String(options.claimId || '').trim();
  const expectedEndpoint = String(job.endpointId || '').trim();

  if (!endpointId) throw new Error('endpointId is required to claim a job.');
  if (!claimId) throw new Error('claimId is required to claim a job.');
  if (expectedEndpoint && expectedEndpoint !== endpointId) {
    throw new Error('Endpoint is not authorized for this job.');
  }

  const now = parseTime(options.now ?? Date.now(), 'claim time');
  const leaseMs = normalizeLease(options.leaseMs);

  return {
    ...job,
    status:'CLAIMED',
    claimedBy:endpointId,
    claimId,
    claimedAt:new Date(now).toISOString(),
    leaseExpiresAt:new Date(now + leaseMs).toISOString(),
    history:[
      ...(job.history || []),
      {
        status:'CLAIMED',
        at:new Date(now).toISOString(),
        endpointId,
        claimId
      }
    ]
  };
}

export function isClaimExpired(job, now = Date.now()) {
  if (!job || job.status !== 'CLAIMED' || !job.leaseExpiresAt) return false;
  const nowMs = parseTime(now, 'current time');
  const expires = Date.parse(job.leaseExpiresAt);
  if (Number.isNaN(expires)) return false;
  return expires <= nowMs;
}

export function recoverExpiredClaim(job, now = Date.now()) {
  if (!isClaimExpired(job, now)) {
    throw new Error('Job does not have an expired CLAIMED lease.');
  }

  const at = new Date(parseTime(now, 'recovery time')).toISOString();

  return {
    ...job,
    status:'QUEUED',
    claimedBy:'',
    claimId:'',
    claimedAt:'',
    leaseExpiresAt:'',
    history:[
      ...(job.history || []),
      {
        status:'QUEUED',
        at,
        recovery:'EXPIRED_CLAIM'
      }
    ]
  };
}

export function assertClaimOwner(job, options = {}) {
  if (!job || job.status !== 'CLAIMED') {
    throw new Error('Job is not currently CLAIMED.');
  }

  const endpointId = String(options.endpointId || '').trim();
  const claimId = String(options.claimId || '').trim();

  if (job.claimedBy !== endpointId || job.claimId !== claimId) {
    throw new Error('Claim ownership does not match.');
  }

  if (isClaimExpired(job, options.now ?? Date.now())) {
    throw new Error('Claim lease has expired.');
  }

  return true;
}

function normalizeLease(value) {
  const n = Number(value ?? 60000);
  if (!Number.isFinite(n) || n < 5000 || n > 10 * 60 * 1000) {
    throw new Error('leaseMs must be between 5000 and 600000.');
  }
  return Math.floor(n);
}

function parseTime(value, label) {
  if (value instanceof Date) {
    const ms = value.getTime();
    if (!Number.isNaN(ms)) return ms;
  }

  if (typeof value === 'number' && Number.isFinite(value)) return value;

  const ms = Date.parse(String(value || ''));
  if (Number.isNaN(ms)) throw new Error('Invalid ' + label + '.');
  return ms;
}
