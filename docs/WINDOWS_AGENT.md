# Windows PrintHub agent

## Purpose

The Windows agent is the endpoint type for printers that are already installed on a Windows machine, including USB-only printers.

Unlike the simple ChromeOS browser endpoint, one Windows endpoint can bind multiple logical PrintHub routes to multiple exact Windows printer names.

Example:

```
PH-AP-WIN-01
  |
  +-- RECEIPT -> "AP Receipt Printer"
  |
  +-- FILE    -> "AP Kyocera"
```

That allows one source transaction to fan out to two different printers while remaining one transaction in the source application.

## Local configuration

See:

`agents/windows/config.example.json`

A local production config should define:

- `endpointId`;
- a human-readable label;
- one or more binding keys;
- the exact Windows printer name for each binding;
- the supported document transport for each binding.

Do not commit a production config that contains credentials.

## Credential

The endpoint credential must be stored separately from the public config.

Target examples:

- a service environment variable;
- a local protected secret file with restricted ACLs;
- Windows Credential Manager;
- another OS-managed secret mechanism.

The backend must map that credential to the endpoint(s) it may service.

## Printer transport modes

The Windows agent should eventually support at least two physical print transports.

### WINDOWS_NAMED_PRINTER

For office printers and other ordinary Windows print queues.

A PDF-capable local renderer will be needed to submit a ready-to-print PDF to an exact named queue without user interaction.

The renderer implementation has not been selected yet; the contract intentionally does not depend on one specific third-party executable.

### RAW_TCP_9100

For compatible network receipt printers.

A binding specifies a host and port (normally 9100). The agent opens a TCP socket and sends printer-ready ESC/POS bytes directly to the device. No PDF, Windows spooler, or page-orientation layer is involved.

The current agent includes a deliberate manual proof:

```powershell
.\PrintHubAgent.ps1 -RawReceiptTestBinding RECEIPT
```

That proof emits a synthetic ESC/POS receipt, feeds a short buffer, and requests a full cut.

## Current safe implementation

`agents/windows/PrintHubAgent.ps1` currently supports diagnostics and dry runs.

### Diagnostics

```powershell
.\PrintHubAgent.ps1 -Diagnose
```

This:

- loads the local endpoint config;
- enumerates Windows printers;
- validates each binding by exact printer name;
- displays driver and port information;
- exits non-zero if a configured binding is missing.

### Endpoint-job dry run

```powershell
.\PrintHubAgent.ps1 -DryRunJobs .\sample-jobs.json
```

This verifies job IDs, endpoint ownership, binding keys, media-profile presence, batch duplicates, and installed-printer resolution.

It deliberately does not print.

## Still intentionally disabled

The Windows agent does not yet:

- poll a production server;
- possess a production endpoint credential;
- claim live jobs;
- submit production PDFs to Windows;
- submit production RAW receipt jobs from the queue;
- report live completion / failure callbacks.

It **can** now validate RAW TCP bindings and deliberately send a manual ESC/POS proof to one configured receipt target.

Those pieces should be enabled only after the endpoint protocol and PassKiosk migration are finalized and the real printer environment has been inspected.
