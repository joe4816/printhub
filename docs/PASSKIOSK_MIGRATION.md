# PassKiosk → PrintHub migration plan

This is a design plan only. It does **not** modify the live PassKiosk Apps Script project.

## Current PassKiosk behavior

The current backend creates Print_Jobs rows with fields including:

- Print Job ID
- Transaction ID
- Attempted At
- Completed At
- Device ID
- Initiated By Username
- Initiated By
- Printer Key
- Printer Name
- Output Format
- Attempt Type
- Reprint Of Job ID
- Status
- Error Code
- Error Message
- Renderer Version
- Snapshot Hash

The current worker polls every row whose status is `QUEUED`, changes it to `SENDING`, and then resolves the job's `Printer Key` against PassKiosk printer configuration.

That design assumes the worker itself knows the physical printer.

## Migration goal

Move hardware ownership out of PassKiosk.

PassKiosk should know:

- the logical route selected by the user;
- the media / renderer profile for that route;
- the endpoint responsible for the job.

PrintHub should own the physical printer binding.

## Proposed additive Print_Jobs columns

Keep existing columns during migration and add:

| Column | Purpose |
| --- | --- |
| Job Group ID | Links primary + optional second-copy jobs created from one transaction |
| Copy Role | PRIMARY / SECONDARY / ERROR_REPORT / REPRINT |
| Route ID | Logical destination chosen by the user |
| Route Label | Human-readable destination at time of submission |
| Endpoint ID | PrintHub queue consumer |
| Endpoint Type | CHROMEOS_BROWSER / WINDOWS_AGENT |
| Binding Key | DEFAULT / RECEIPT / FILE / etc. |
| Media Profile ID | 80MM_RECEIPT / LETTER_FILE / HALF_LETTER_LANDSCAPE |
| Renderer ID | Renderer selected for this copy |
| Claimed At | Time an endpoint atomically claimed the job |
| Claimed By | Endpoint ID that claimed it |
| Print Invoked At | Time the endpoint invoked its local print transport |
| Attempt Number | 1, 2, 3... |
| Parent Job ID | Original job for a deliberate retry |

The old Printer Key / Printer Name / Output Format fields can remain temporarily for backward compatibility and diagnostics.

## Printer-selection UI

Current selection:

```
Printer
[ destination ▼ ]
```

Target selection:

```
Primary printer
[ logical route ▼ ]

☐ Send second copy
```

When checked:

```
Primary printer
[ logical route ▼ ]

☑ Send second copy

Second printer
[ different logical route ▼ ]
```

Rules:

- second copy defaults off;
- primary and secondary routes cannot be identical;
- route labels are user-facing;
- users never choose an endpoint ID, Windows printer name, IP address, or Chrome printer ID.

## Fan-out

One PassKiosk transaction remains one transaction.

Example:

```
Transaction PK-123
  |
  +-- PJ-...-01
  |     copy role PRIMARY
  |     route FRONT_RECEIPT
  |
  +-- PJ-...-02
        copy role SECONDARY
        route AP_FILE
```

Both jobs share the same Job Group ID and Transaction ID.

A failure of the second copy must not invalidate or duplicate the primary copy.

## Worker migration

The current `worker.poll` scans all QUEUED jobs.

Target behavior:

```
endpoint.poll(endpointId)
```

The backend should atomically return only:

- status = QUEUED;
- endpoint ID = the authenticated endpoint;
- jobs that endpoint is authorized to claim.

Claim should change the status to `CLAIMED` rather than the current generic `SENDING`.

The endpoint then reports `PRINT_INVOKED`, `PRINTED` when that transport can establish it, or `FAILED`.

## ChromeOS status nuance

A browser-only ChromeOS endpoint using `window.print()` can establish that the browser print call was invoked.

It should not automatically claim physical `PRINTED` status unless a stronger signal exists.

For that path, PassKiosk should accept `PRINT_INVOKED` as the strongest browser-confirmable transport status.

## Windows status nuance

A Windows agent may be able to report stronger spooler submission status. The exact meaning of `PRINTED` should be documented once the final local print transport is selected.

## Reprints

The current PassKiosk reprint flow creates a new Print_Jobs row and links it with Reprint Of Job ID.

Preserve that principle.

Under PrintHub:

- reprint creates a new deliberate attempt;
- it inherits the original route / endpoint / binding / media / renderer unless the user explicitly chooses a new destination;
- Parent Job ID / Reprint Of Job ID links the attempt chain;
- the original completed job remains immutable.

## Error reports

Bulk error reports should become ordinary routed print jobs with an explicit copy role / renderer rather than depending on a physical printer configuration embedded in PassKiosk.

## Safe deployment sequence

1. Add new route / endpoint configuration without changing existing worker behavior.
2. Add new Print_Jobs columns.
3. Teach job creation to populate both legacy printer fields and new route fields.
4. Add endpoint-aware polling alongside the old worker endpoint.
5. Connect one test endpoint only.
6. Verify queue claiming, rendering, printing, completion, failure, and retry.
7. Add second-copy UI.
8. Verify sibling-copy independence.
9. Migrate remaining endpoints.
10. Retire legacy physical-printer fields only after every live route is on PrintHub.

At no point should existing queued jobs be reinterpreted automatically.
