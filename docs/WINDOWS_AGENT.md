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

### RAW

For printers where the source adapter intentionally produces printer-ready bytes, such as ESC/POS output for a compatible receipt printer.

The agent can submit the raw job directly to the named Windows spooler queue.

This may be useful for receipt printers, but should only be enabled for a route whose renderer deliberately emits data compatible with that printer.

## Current scaffold

`agents/windows/PrintHubAgent.ps1` currently implements diagnostics only.

It:

- loads a local config;
- enumerates Windows printers;
- validates each configured binding by exact printer name;
- reports whether each route binding is ready.

It does **not** poll a production queue or print production jobs yet.

That is intentional until the endpoint protocol and PassKiosk handoff are finalized.
