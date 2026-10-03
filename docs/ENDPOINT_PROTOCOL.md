# Endpoint protocol — target contract

This document describes the generic queue protocol PrintHub should move toward.

It is a design contract only. The current PassKiosk worker API has not yet been migrated to this shape.

## Authentication rule

An endpoint ID is not authentication.

A production credential must be authorized server-side for one or more endpoint IDs. A client must not be able to claim another endpoint's queue merely by changing:

`endpointId`

## Poll

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
      "document": {
        "contentType": "application/pdf",
        "dataEncoding": "base64",
        "data": "..."
      }
    }
  ]
}
```

The server must atomically claim returned jobs so a second consumer cannot receive the same job concurrently.

## Completion

Conceptual request:

```json
{
  "action": "endpoint.complete",
  "endpointId": "PH-AP-WIN-01",
  "printJobId": "PJ-123-01",
  "status": "PRINT_INVOKED",
  "detail": "Submitted to Windows queue AP Receipt Printer"
}
```

Valid endpoint-reported statuses should be constrained by transport.

A browser-only ChromeOS endpoint can reliably report that printing was invoked, but not necessarily that paper physically exited the printer.

A Windows spooler-based endpoint may be able to report stronger submission or spooler status, depending on implementation.

## Failure

Conceptual request:

```json
{
  "action": "endpoint.complete",
  "endpointId": "PH-AP-WIN-01",
  "printJobId": "PJ-123-01",
  "status": "FAILED",
  "errorCode": "PRINTER_NOT_FOUND",
  "detail": "Configured Windows printer was not installed"
}
```

## Retry ownership

The backend should own retry policy.

Endpoints report outcomes. They should not independently duplicate source jobs.

A retried print should either:

- reuse the same idempotent `printJobId` with a new attempt record, or
- create a deliberate retry attempt linked to the original job.

The exact persistence model can be chosen when PassKiosk's current `Print_Jobs` schema is migrated.
