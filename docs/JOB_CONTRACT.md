# Generic PrintHub job contract — draft v1

This contract describes the target boundary between a source adapter and a PrintHub endpoint.

## Fan-out rule

One source transaction may create one or more print jobs.

Example user selection:

- Primary printer: `AP_RECEIPT`
- Send second copy: checked
- Second printer: `AP_FILE`

The routing layer creates two independent jobs. They share a transaction / group ID but each job has its own route, endpoint, media profile, renderer, status, and retry lifecycle.

## Endpoint job

```json
{
  "schemaVersion": 1,
  "printJobId": "PJ-20261003-000123-01",
  "jobGroupId": "JG-20261003-000123",
  "sourceApp": "PASSKIOSK",
  "sourceTransactionId": "PK-20261003-000123",
  "copyRole": "PRIMARY",
  "createdAt": "2026-10-03T18:30:00-07:00",

  "routeId": "AP_RECEIPT",
  "endpointId": "PH-AP-WIN-01",
  "bindingKey": "RECEIPT",
  "mediaProfileId": "80MM_RECEIPT",

  "document": {
    "contentType": "application/pdf",
    "dataEncoding": "base64",
    "data": "..."
  },

  "printOptions": {
    "copies": 1,
    "duplex": "NO_DUPLEX",
    "color": "MONOCHROME"
  },

  "metadata": {
    "displayLabel": "Student copy"
  }
}
```

## Core requirements

- `printJobId` is globally unique and idempotent.
- `jobGroupId` ties sibling copies to the same source event.
- `sourceTransactionId` links back to the source system.
- `copyRole` is normally `PRIMARY` or `SECONDARY`.
- `routeId` is the logical destination selected by the application user.
- `endpointId` identifies the queue consumer.
- `bindingKey` tells that endpoint which local printer binding to use.
- `mediaProfileId` controls physical page / roll assumptions.
- the generic `document` should already be printable.
- a PrintHub endpoint must not need source-specific student or transaction semantics in order to print.

## ChromeOS endpoint behavior

For `CHROMEOS_BROWSER` endpoints:

- `bindingKey` should normally be `DEFAULT`;
- the document is rendered into the browser print surface;
- `window.print()` sends it to the ChromeOS default printer;
- the page cannot reliably determine physical printer completion.

The backend should therefore distinguish **browser print invoked** from a stronger physical completion signal if one is ever available.

## Windows endpoint behavior

For `WINDOWS_AGENT` endpoints:

- `bindingKey` resolves to a configured Windows printer name;
- the agent may support multiple bindings;
- the agent reports submission / failure using the endpoint protocol.

## Target statuses

At minimum:

- `QUEUED`
- `CLAIMED`
- `PRINT_INVOKED`
- `PRINTED` when a transport can establish it
- `FAILED`

For browser-only ChromeOS printing, do not falsely upgrade `PRINT_INVOKED` to `PRINTED` without evidence.
