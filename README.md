# PrintHub

PrintHub is a reusable ChromeOS print appliance for school workflows.

It is intentionally **not** a PassKiosk-only project. PassKiosk is expected to be the first job source, but PrintHub is designed so other systems can submit jobs later without inheriting PassKiosk business logic.

## Architecture

PrintHub has two browser-side pieces:

1. **GitHub Pages dashboard** — appliance status, printer visibility, diagnostics, and operator-safe controls.
2. **Managed ChromeOS extension** — privileged access to the ChromeOS-only `chrome.printing` API.

The extension is the physical-printing layer. The public web page never contains printer credentials, worker keys, or other secrets.

```
Source apps
  PassKiosk
  Badgie
  Future apps
      |
      v
job-source adapters / APIs
      |
      v
PrintHub ChromeOS appliance
  GitHub Pages dashboard
      |
      v
managed PrintHub extension
      |
      v
chrome.printing
      |
      v
managed ChromeOS printers
```

## Current foundation

The initial build provides:

- a standalone PrintHub dashboard;
- managed-printer discovery through a Chrome extension;
- a manual synthetic PDF test-print path;
- live print-job status events from `chrome.printing`;
- an enterprise managed-policy schema for appliance configuration;
- a documented generic job envelope for future source adapters.

**Automatic source polling is deliberately not enabled yet.** The current PassKiosk worker returns application-specific document snapshots that still need a renderer contract before PrintHub should claim or complete those jobs.

## GitHub Pages

Intended site:

`https://joe4816.github.io/printhub/`

This repository contains only public client code. Do not commit worker keys, Wi-Fi credentials, student data, Google credentials, or other secrets.

## ChromeOS extension

The extension source is under `extension/`.

For unattended printing, Chrome requires the extension to have the `printing` permission. Chrome's printing API is ChromeOS-only. To suppress the normal confirmation dialog for `chrome.printing.submitJob()`, the deployed extension must also be included in the Google Admin `PrintingAPIExtensionsAllowlist` policy.

See `docs/CHROMEOS_DEPLOYMENT.md` before deployment.
