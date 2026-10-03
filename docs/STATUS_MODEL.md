# Print-job status model

PrintHub uses a deliberately small state machine.

```
QUEUED
  | \
  |  \-> FAILED
  v
CLAIMED
  | \
  |  \-> FAILED
  v
PRINT_INVOKED
  | \
  |  \-> FAILED
  v
PRINTED
```

A failed job can be deliberately retried, which places that attempt back in `QUEUED`.

## State meanings

### QUEUED

The backend owns the job and no endpoint has claimed it.

### CLAIMED

An authenticated endpoint atomically claimed the job. Another endpoint must not receive the same job concurrently.

### PRINT_INVOKED

The endpoint invoked its local print transport.

Examples:

- ChromeOS browser called `window.print()`;
- Windows agent submitted the document to a local spooler / print transport.

This is the strongest status a browser-only ChromeOS endpoint can reliably assert on its own.

### PRINTED

Use only when the chosen endpoint transport has a meaningful confirmation that supports this claim.

Do not automatically convert `PRINT_INVOKED` to `PRINTED` merely because no JavaScript error occurred.

### FAILED

The attempt could not continue.

The failure record should retain an error code and useful detail.

## Retry

Retry is deliberate rather than an ordinary forward transition.

A retry:

- begins a new attempt;
- preserves the source transaction and route relationship;
- should never silently create a second source transaction;
- returns the attempt to `QUEUED`.

## Source status vs print status

A PassKiosk transaction's business status and a PrintHub copy's physical print status are separate concerns.

For a transaction with two copies:

```
Source transaction: valid

Primary copy: PRINTED
Second copy: FAILED
```

The failed second copy can be retried independently without re-running the business transaction.
