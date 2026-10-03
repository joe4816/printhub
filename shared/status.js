export const PRINT_JOB_STATES = Object.freeze([
  'QUEUED',
  'CLAIMED',
  'PRINT_INVOKED',
  'PRINTED',
  'FAILED'
]);

const TRANSITIONS = Object.freeze({
  QUEUED: Object.freeze(['CLAIMED', 'FAILED']),
  CLAIMED: Object.freeze(['PRINT_INVOKED', 'FAILED']),
  PRINT_INVOKED: Object.freeze(['PRINTED', 'FAILED']),
  PRINTED: Object.freeze([]),
  FAILED: Object.freeze([])
});

export function canTransition(from, to) {
  const next = TRANSITIONS[String(from || '')] || [];
  return next.includes(String(to || ''));
}

export function applyTransition(job, nextStatus) {
  if (!job || !job.status) throw new Error('Job with current status is required.');
  if (!canTransition(job.status, nextStatus)) {
    throw new Error('Invalid print-job transition: ' + job.status + ' → ' + nextStatus + '.');
  }

  const at = new Date().toISOString();
  return {
    ...job,
    status: nextStatus,
    history: [...(job.history || []), {status:nextStatus, at}]
  };
}

export function applyRetry(job) {
  if (!job || job.status !== 'FAILED') {
    throw new Error('Only FAILED jobs can be retried.');
  }

  const at = new Date().toISOString();
  return {
    ...job,
    status:'QUEUED',
    attempts:Number(job.attempts || 0) + 1,
    history:[...(job.history || []), {status:'QUEUED', at, retry:true}]
  };
}
