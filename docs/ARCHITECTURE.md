# PrintHub architecture

## Purpose

PrintHub is shared **printing infrastructure**, not an application-specific workflow.

A source application decides **what** should print. PrintHub decides **which installed ChromeOS printer** receives the rendered document and records physical print status.

## Separation of responsibilities

### Source application
Owns:
- business rules;
- user workflow;
- document meaning;
- transaction records;
- application-specific rendering data;
- deciding that a print job should exist.

### PrintHub
Owns:
- installed-printer discovery;
- physical printer selection;
- printer capability inspection;
- submission through `chrome.printing`;
- physical print status;
- retries / failure reporting once the generic source contract is connected.

### Managed extension
The privileged bridge is a Manifest V3 Chrome extension because a normal web page cannot call the ChromeOS-only `chrome.printing` API.

The dashboard communicates with the extension through a narrowly scoped content script on:

`https://joe4816.github.io/printhub/*`

## Secrets

No source secret belongs in the GitHub repository.

When source adapters are added, credentials should be supplied through managed extension policy (`chrome.storage.managed`) or another enterprise-managed secret path.

## PassKiosk

PassKiosk is the first planned source, but its current worker response contains a PassKiosk-specific document snapshot rather than a ready-to-print generic document.

PrintHub must not automatically poll that queue until one of these is implemented:

1. PassKiosk returns a ready-to-print artifact (preferred long-term generic boundary), or
2. a PassKiosk renderer adapter is installed inside PrintHub.

Until then, production polling remains intentionally disabled.
