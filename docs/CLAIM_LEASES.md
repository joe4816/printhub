# Claim leases and crash recovery

An unattended print endpoint can disappear after claiming work.

The queue therefore needs a short **claim lease** rather than a permanent `SENDING` state.

## Safe recovery boundary

```
QUEUED
   |
   v
CLAIMED  -- lease expires --> QUEUED
   |
   v
PRINT_INVOKED
```

An expired `CLAIMED` job can safely return to `QUEUED` **only when the endpoint has not yet reported PRINT_INVOKED**.

Once printing has been invoked, the backend should not automatically requeue the job. Doing so could create a duplicate physical copy.

## Claim fields

Target job fields:

- Claimed By
- Claim ID
- Claimed At
- Lease Expires At

The server creates a unique Claim ID when it atomically assigns the job.

Completion / failure messages must identify the same endpoint and Claim ID.

## Endpoint crash scenarios

### Crash before print invocation

The lease expires while status is still `CLAIMED`.

The backend may return the job to `QUEUED`.

### Crash after print invocation

The job has already reached `PRINT_INVOKED`.

Do **not** auto-retry.

The physical printer may already have produced the copy. An operator can deliberately issue a reprint if needed.

## Why this matters for ChromeOS

The browser-only ChromeOS path cannot reliably prove that paper exited the printer.

Therefore `PRINT_INVOKED` is a meaningful durable boundary: automatic recovery stops there.

## Shared implementation

`shared/claiming.js` implements the pure claim / lease rules used by the simulator and future backend adapters.

The actual atomic claim must still occur server-side.
