# Optional ChromeOS multi-printer extension

This folder preserves the first PrintHub Chrome extension experiment.

It is **not required** for the current no-extension design.

Use this path only if a future ChromeOS PrintHub endpoint must dynamically:

- enumerate multiple installed ChromeOS printers;
- select a specific physical printer from JavaScript;
- submit through `chrome.printing`.

For the current one-default-printer-per-ChromeOS-endpoint design, use `window.print()` plus managed default-printer and silent-printing policies instead.

This code remains experimental and is not connected to the production queue.
