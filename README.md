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

### ChromeOS browser endpoint — first implementation

A dedicated managed Chromebook auto-launches:

`https://joe4816.github.io/printhub/`

The endpoint prints with `window.print()`. ChromeOS policy supplies the printer available to that device/group, the default printer, and silent printing.

The page does **not** need a Chrome extension for this one-default-printer design.

### Windows agent endpoint — planned

A Windows PrintHub agent can service one or more Windows-installed printers by exact printer name. This is the path for USB-connected printers and for machines that already host local printer queues.

The current PowerShell scaffold can enumerate printers, validate exact bindings, and dry-run endpoint jobs without printing.

See `docs/WINDOWS_AGENT.md`.

## Development lab

The static routing simulator is available at:

`https://joe4816.github.io/printhub/simulator/`

It uses fake data only. It can exercise primary + second-copy fan-out, endpoint queues, independent status transitions, retries, and rendered receipt/file-copy previews without contacting PassKiosk.

## Repository status

The current foundation includes:

- a standalone endpoint dashboard;
- a browser-only silent-print test path;
- persistent endpoint identity via URL / local storage;
- a generic endpoint and routing model;
- dual-copy / multi-route fan-out semantics;
- generic 80 mm and paper renderers;
- a browser simulator;
- automated routing / renderer tests;
- a draft generic endpoint protocol;
- a Windows agent diagnostics + dry-run scaffold;
- an additive PassKiosk migration plan;
- the earlier Chrome extension experiment preserved under `optional/chrome-extension/` for a future multi-printer ChromeOS design.

**Production queue polling is deliberately not enabled yet.** The current PassKiosk worker returns application-specific document data. PrintHub should not claim live jobs until the backend exposes an endpoint-aware generic contract or a renderer adapter is deliberately connected.

## GitHub Pages

`https://joe4816.github.io/printhub/`

This is a public client repository. Never commit worker keys, passwords, student data, Google credentials, Wi-Fi credentials, or printer credentials.
