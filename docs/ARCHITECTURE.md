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

The current first implementation.

A dedicated managed Chromebook auto-launches PrintHub. The endpoint:

1. polls only its own endpoint queue (future adapter);
2. renders the assigned job;
3. calls `window.print()`;
4. relies on ChromeOS policy for silent printing and the device's default printer.

The web page does not enumerate or select physical printers. This is a deliberate constraint that removes the Chrome extension requirement.

A ChromeOS browser endpoint should normally have exactly one intended default physical printer.

### WINDOWS_AGENT

A local Windows service / agent.

This endpoint can support more than one physical printer because each route binding can name a Windows-installed printer explicitly.

This is the intended path for:

- USB-only printers;
- printers already attached to a Windows workstation;
- one Windows machine that must service multiple local print queues.

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
