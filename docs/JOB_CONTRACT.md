# Generic PrintHub job contract (draft)

This is the target boundary between source applications and PrintHub.

The source should eventually hand PrintHub a **ready-to-print document**, not source-specific business objects.

## Job envelope

```json
{
  "schemaVersion": 1,
  "sourceApp": "PASSKIOSK",
  "jobId": "source-owned-unique-id",
  "createdAt": "2026-10-03T17:00:00-07:00",
  "printerRoute": "RECEIPT_1",
  "document": {
    "contentType": "application/pdf",
    "dataEncoding": "base64",
    "data": "..."
  },
  "printOptions": {
    "copies": 1,
    "mediaHint": "ROLL_80MM",
    "duplex": "NO_DUPLEX",
    "color": "MONOCHROME"
  },
  "metadata": {
    "displayLabel": "PassKiosk · Call Pass"
  }
}
```

## Required principles

- `sourceApp` identifies the producer but does not change PrintHub's core behavior.
- `jobId` is source-owned and idempotent.
- `printerRoute` is a logical route, not a Chrome printer ID.
- PrintHub maps logical routes to installed ChromeOS printers.
- `document` should already be printable.
- Source-specific student or transaction data should not be required by the PrintHub core.
- PrintHub reports physical status back using the source adapter.

## Status callback target

A source adapter should be able to report at least:

- `ACCEPTED`
- `PRINTING`
- `PRINTED`
- `FAILED`

The exact transport is intentionally left open until the first PassKiosk adapter is implemented.
