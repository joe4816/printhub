# PrintHub architecture

## Purpose

PrintHub is shared **printing infrastructure**, not an application-specific workflow.

A source application owns the business event. PrintHub owns the route from a logical print destination to a physical print endpoint.

The central abstraction is:

```
transaction
    |
    v
logical route
    |
    +--> renderer / media profile
    |
    +--> endpoint queue
             |
             v
       endpoint binding
             |
             v
       physical printer
```

## Source application responsibilities

A source application such as PassKiosk owns:

- business rules;
- user workflow;
- the transaction record;
- the user's primary and optional second-copy selections;
- source-specific data needed to render the document.

The source must not need a Chrome printer ID, Windows spooler ID, printer IP address, or USB detail.

## Route responsibilities

A logical route is the user-facing destination.

Examples:

- `FRONT_RECEIPT`
- `AP_RECEIPT`
- `AP_FILE`

Each route resolves to:

- one endpoint;
- one endpoint printer binding;
- one media profile;
- one renderer.

Two selected routes create two independent print jobs tied to the same transaction.

## Endpoint types

### CHROMEOS_BROWSER

A dedicated managed Chromebook auto-launches PrintHub.

Two ChromeOS transports are now proven:

1. **browser-default fallback** — `window.print()` plus ChromeOS silent/default-printer policy;
2. **managed exact-printer bridge** — the PrintHub extension enumerates ChromeOS printers with `chrome.printing` and submits a PDF to one exact runtime printer ID.

The exact-printer bridge is useful for office/document printers and as a receipt fallback, but receipt PDFs still inherit page-orientation and page-geometry behavior from ChromeOS/PPD handling.

Raw ESC/POS over TCP is therefore not the preferred ChromeOS receipt transport.

### WINDOWS_AGENT

A local Windows service / agent.

This endpoint can support more than one physical printer and more than one transport.

Current binding modes are:

- `WINDOWS_NAMED_PRINTER` for ordinary Windows print queues;
- `RAW_TCP_9100` for compatible network receipt printers.

The RAW path sends ESC/POS bytes directly to the printer and therefore avoids PDF page size/orientation issues. It is the preferred receipt transport when an always-on Windows PrintHub agent can reach the printer.

See `WINDOWS_AGENT.md`.

## Endpoint identity

An endpoint ID identifies a queue consumer, for example:

`PH-AP-RECEIPT-01`

The endpoint ID is **not a secret**.

When production polling is connected, authentication must bind a credential to the endpoint(s) it is allowed to service. The backend must not trust an arbitrary client-supplied endpoint ID by itself.

## Rendering boundary

The preferred long-term boundary is a ready-to-print artifact.

PrintHub core should not need to understand what a tardy, hall pass, fine, badge, or detention means.

A source adapter may either:

1. provide a ready-to-print artifact, or
2. deliberately invoke a source-specific renderer before the generic endpoint handoff.

The generic endpoint job should then carry the rendered document plus print metadata.

## Current PassKiosk boundary

The current PassKiosk worker returns application-specific document snapshots. Therefore automatic production polling remains disabled.

Before PrintHub claims PassKiosk jobs, PassKiosk must gain an endpoint-aware handoff and a deliberate rendering boundary. That change should be made only after this routing model is accepted.


## Preferred split transport

For the currently tested school environment, the preferred production shape is:

```text
PassKiosk / other source
        |
        v
logical PrintHub route
        |
        +--> receipt route --> Windows agent --> ESC/POS --> TCP 9100 --> receipt printer
        |
        +--> file route ----> ChromeOS bridge or Windows queue --> PDF --> office printer
```

The source application still selects a logical route, never a printer IP or runtime Chrome printer ID. Physical transport details remain inside PrintHub endpoint bindings.
