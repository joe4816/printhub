# Endpoint protocol — target contract

This document describes the generic queue protocol PrintHub should move toward.

It is a design contract only. The current PassKiosk worker API has not yet been migrated to this shape.

## Authentication rule

An endpoint ID is not authentication.

A production credential must be authorized server-side for one or more endpoint IDs. A client must not be able to claim another endpoint's queue merely by changing:

`endpointId`

The server derives the endpoint authorization from the authenticated credential and rejects endpoint IDs outside that scope.

## Heartbeat

A lightweight heartbeat lets the backend distinguish an endpoint that is configured from one that is actually online.

Conceptual request:

```json
{
  "action": "endpoint.heartbeat",
  "endpointId": "PH-AP-WIN-01",
  "agentVersion": "0.2.0",
  "capabilities": ["WINDOWS_NAMED_PRINTER"]
}
```

Conceptual response:

```json
{
  "ok": true,
  "serverTime": "2026-10-03T19:30:00-07:00",
  "pollAfterMs": 2000
}
```

Heartbeat data is operational metadata only. It must not contain student data.

## Poll and atomic claim

Conceptual request:

```json
{
  "action": "endpoint.poll",
  "endpointId": "PH-AP-WIN-01",
  "maxJobs": 5
}
```

Authentication should be carried using the secure transport chosen for that endpoint type.

Conceptual response:

```json
{
  "ok": true,
  "endpointId": "PH-AP-WIN-01",
  "jobs": [
    {
      "schemaVersion": 1,
      "printJobId": "PJ-123-01",
      "jobGroupId": "JG-123",
      "routeId": "AP_RECEIPT",
      "bindingKey": "RECEIPT",
      "mediaProfileId": "80MM_RECEIPT",
      "claim": {
        "claimId": "CLM-random",
        "claimedAt": "2026-10-03T19:30:00-07:00",
        "leaseExpiresAt": "2026-10-03T19:31:00-07:00"
      },
      "document": {
        "contentType": "application/pdf",
        "dataEncoding": "base64",
        "data": "..."
      }
    }
  ]
}
```

The server must atomically change each returned job from `QUEUED` to `CLAIMED` before returning it.

A second endpoint poll must never receive the same active claim.

## Claim lease

A claim has a short lease.

If an endpoint disappears while the job is still only `CLAIMED`, the backend may recover the expired claim and return it to `QUEUED`.

The claim response therefore carries:

- Claim ID
- Claimed At
- Lease Expires At

Completion / failure messages must include the same Claim ID.

See `CLAIM_LEASES.md`.

## Print invocation

Before or immediately after calling the local print transport, the endpoint reports:

```json
{
  "action": "endpoint.complete",
  "endpointId": "PH-AP-WIN-01",
  "printJobId": "PJ-123-01",
  "claimId": "CLM-random",
  "status": "PRINT_INVOKED",
  "detail": "Submitted to Windows queue AP Receipt Printer"
}
```

Once a job reaches `PRINT_INVOKED`, it must not be automatically requeued after a timeout. The physical printer may already have produced the copy.

## Printed confirmation

A transport may later report:

```json
{
  "action": "endpoint.complete",
  "endpointId": "PH-AP-WIN-01",
  "printJobId": "PJ-123-01",
  "claimId": "CLM-random",
  "status": "PRINTED"
}
```

Only transports with a meaningful completion signal should report `PRINTED`.

A browser-only ChromeOS endpoint using `window.print()` can reliably report `PRINT_INVOKED`, but not necessarily that paper physically exited the printer.

## Failure

Conceptual request:

```json
{
  "action": "endpoint.complete",
  "endpointId": "PH-AP-WIN-01",
  "printJobId": "PJ-123-01",
  "claimId": "CLM-random",
  "status": "FAILED",
  "errorCode": "PRINTER_NOT_FOUND",
  "detail": "Configured Windows printer was not installed"
}
```

A completion call is accepted only when:

- the endpoint is authenticated for that endpoint ID;
- the job is currently owned by that endpoint;
- the Claim ID matches;
- the claim has not expired when the status is still pre-print.

## Retry ownership

The backend owns retry policy.

Endpoints report outcomes. They do not independently clone source jobs.

A deliberate retry should create or record a new attempt linked to the original job while preserving:

- source transaction;
- job group;
- route;
- endpoint;
- binding;
- media profile;
- renderer.

A failed secondary copy can therefore be retried independently of a successful primary copy.

## Idempotency

The server must treat duplicate completion messages for the same job / claim / status as idempotent whenever possible.

This protects against network retries.

A request that attempts to move a job backward through the state machine should be rejected rather than silently changing state.
