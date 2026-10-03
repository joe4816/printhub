# PrintHub implementation readiness checklist

This document separates what can be completed in code from what requires the real school environment.

## Already modeled in repository

- logical print routes;
- endpoint IDs;
- endpoint types;
- local printer bindings;
- media profiles;
- primary + optional second-copy fan-out;
- one source transaction with independent sibling print jobs;
- print-job state machine;
- safe claim leases;
- retry semantics;
- generic receipt / paper renderers;
- offline PassKiosk transaction adapter;
- ChromeOS browser-default print test;
- Windows printer diagnostics;
- Windows endpoint-job dry run;
- automated tests and semantic config validation.

## ChromeOS endpoint information still needed

For each production Chromebook endpoint:

- final endpoint ID;
- human-readable endpoint label;
- Google Admin OU / device group placement;
- exact managed printer name assigned to the device;
- confirmation that the intended printer is the effective default;
- confirmation that silent printing is effective;
- physical print test for each media profile used by that endpoint.

Suggested endpoint naming pattern:

`PH-<LOCATION>-<PURPOSE>-<NN>`

Example:

`PH-FRONT-RECEIPT-01`

## Windows endpoint information still needed

For each Windows endpoint:

- final endpoint ID;
- computer name / location;
- exact output of `Get-Printer`;
- exact Windows printer queue name for each PrintHub binding;
- driver name;
- port name;
- whether the printer is USB, TCP/IP, shared queue, or another Windows port type;
- printer model;
- whether RAW receipt output is supported / desirable;
- whether ordinary PDF / document printing is supported silently;
- account under which the future agent will run.

For the AP office example, collect both:

- tardy receipt printer;
- Kyocera queue.

## Route decisions still needed

For every user-facing printer choice:

- route ID;
- route label shown to staff;
- endpoint ID;
- binding key;
- media profile;
- renderer ID.

Example:

```
AP_RECEIPT
label: AP Receipt
endpoint: PH-AP-WIN-01
binding: RECEIPT
media: 80MM_RECEIPT

AP_FILE
label: AP File Copy
endpoint: PH-AP-WIN-01
binding: FILE
media: LETTER_FILE
```

## Media tests still needed

Software can define nominal dimensions, but the final physical profiles should be confirmed on real hardware.

For 80 mm receipt output verify:

- printable width;
- left/right margin;
- top feed;
- cut / tear spacing;
- text size;
- long-content page breaking.

For Kyocera / office output verify:

- letter vs half-letter;
- orientation;
- tray / paper source expectations;
- margins;
- duplex setting;
- scaling.

## PassKiosk decisions still needed

Before production migration:

- final route list presented at sign-in / printer selection;
- whether the second-copy checkbox is available to everyone or only selected routes / users;
- whether a preferred second-copy route should be remembered for a session;
- whether reprints default to the original route pair or ask again;
- which workflows support second copy;
- desired filing-copy content differences from the student copy.

## Production activation gates

Do not enable live endpoint polling until all of these are true:

1. route registry validates;
2. endpoint has final identity;
3. endpoint authentication method is deployed;
4. endpoint can only claim its authorized queue;
5. real printer binding is confirmed;
6. renderer output is physically tested;
7. status callback path is tested;
8. claim expiration is tested before PRINT_INVOKED;
9. no automatic retry occurs after PRINT_INVOKED;
10. primary + secondary copies can succeed / fail independently;
11. existing PassKiosk queued jobs remain compatible or are drained before migration.
