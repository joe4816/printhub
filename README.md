# PrintHub

PrintHub is shared local printing infrastructure for school workflows.

It is intentionally **not** a PassKiosk-only project. PassKiosk is the first planned source, but PrintHub is designed so Badgie and future systems can use the same routing model without inheriting PassKiosk business logic.

## Core idea

A source application chooses a **logical print route**. The route decides:

- which endpoint queue receives the job;
- which renderer / media profile builds the copy;
- which physical-printer binding the endpoint uses.

A single transaction can expand into multiple print jobs, so a user can select a primary printer and optionally **Send second copy** to another route.

```
                         one transaction
                               |
                    route-selection / fan-out
                       /               \
                      v                 v
              student copy         file copy
              AP_RECEIPT            AP_FILE
                   |                   |
                   v                   v
            PrintHub endpoint    PrintHub endpoint
                   |                   |
                   v                   v
           physical printer     physical printer
```

## Endpoint types

### ChromeOS browser endpoint

A dedicated managed Chromebook auto-launches:

`https://joe4816.github.io/printhub/`

Two ChromeOS paths are now proven:

- `window.print()` as a one-default-printer fallback;
- the managed PrintHub bridge using `chrome.printing` to enumerate and submit to an exact ChromeOS printer ID.

The exact-printer bridge can print and cut through the current receipt-printer PPD, but PDF receipt formatting still inherits ChromeOS page geometry/orientation behavior.

### Windows agent endpoint

A Windows PrintHub agent can service multiple bindings with different transports:

- exact Windows printer queues for office/file copies;
- direct `RAW_TCP_9100` ESC/POS for compatible network receipt printers.

The RAW path is the preferred receipt transport when an always-on Windows endpoint can reach the printer because it avoids PDF page geometry entirely.

## Development / setup tools

Endpoint setup helper:

`https://joe4816.github.io/printhub/setup/`

Routing simulator:

`https://joe4816.github.io/printhub/simulator/`

Printer-picker prototype:

`https://joe4816.github.io/printhub/prototype/printer-picker/`

The simulator and picker use fake data only and do not contact the live PassKiosk queue. The setup helper generates endpoint identifiers / URLs only; it does not grant queue access.

## Current foundation

PrintHub now includes:

- a standalone ChromeOS endpoint dashboard;
- browser-default / silent-print test support;
- persistent endpoint identity;
- an endpoint provisioning URL helper;
- route → endpoint → binding → media modeling;
- primary + optional second-copy fan-out;
- independent sibling-copy status / retry behavior;
- generic 80 mm, letter, and half-letter rendering;
- an offline PassKiosk transaction adapter;
- claim leases and safe pre-print crash recovery;
- a Windows printer diagnostics + endpoint-job dry-run agent;
- a deliberate RAW TCP / ESC-POS receipt proof with cutter control;
- automated tests and semantic configuration validation;
- a browser routing simulator;
- a printer-picker UI prototype;
- an additive PassKiosk migration plan;
- a managed ChromeOS exact-printer bridge under `optional/chrome-extension/`.

**Production queue polling remains deliberately disabled.** The current PassKiosk worker returns application-specific jobs and is not endpoint-aware yet. Live polling should wait until endpoint authentication, queue filtering, rendering, and callback behavior are migrated deliberately.

## Documentation

Start with:

`docs/README.md`

## GitHub Pages

`https://joe4816.github.io/printhub/`

This is a public client repository. Never commit worker keys, passwords, student data, Google credentials, Wi-Fi credentials, printer credentials, or endpoint secrets.
