# ChromeOS deployment — canonical PrintHub path

## Current architecture decision

The production PassKiosk receipt path uses the managed **PrintHub ChromeOS bridge** and the ChromeOS-only `chrome.printing` API.

```
PassKiosk
    |
    v
Print_Jobs / PrintHub source
    |
    v
managed PassGen Chromebook
    |
    v
PrintHub
    |
    v
managed Chrome extension
    |
    +-- enumerate installed printers
    +-- resolve the current exact Chrome runtime printer ID
    +-- submit PDF with chrome.printing
    |
    v
selected physical printer
```

This is the canonical multi-printer design for PassGen. Do not replace it with a Windows receipt relay or a default-printer-per-job design unless the architecture is explicitly revisited.

## Why the bridge is canonical

The same managed Chromebook must be able to print to more than one physical printer. The bridge has already physically proven:

- printer enumeration;
- exact printer selection by current Chrome runtime ID;
- PDF submission;
- Receipt Printer 1 output and automatic cut;
- Receipt Printer 2 output and automatic cut;
- office-printer PDF submission.

The public PrintHub page never stores a Chrome runtime printer ID as an application route. Runtime IDs are discovered locally by the managed bridge.

## Managed printer policy

Google Admin assigns the printers available to the PassGen device / OU.

Printer defaults such as paper size, DPI, duplex, color, and quality are useful queue baselines, but they are **not routing**. PrintHub still chooses the intended physical destination explicitly through the bridge.

For the two receipt queues, the current proven baseline is:

- nominal roll width: 80 mm;
- receipt queue default: 80 x 60 mm;
- 203 x 203 DPI;
- single-sided;
- black and white;
- normal quality.

A submitted receipt PDF may request a longer page than 60 mm. The bridge uses the printer capabilities and requested document height rather than forcing every job to the queue default length.

## Receipt PDF geometry

Receipt PDFs must be physically portrait: page height must be greater than the 80 mm roll width.

A prior 80 x 79 mm Call Pass PDF was interpreted as landscape and auto-rotated by the shared ChromeOS/CUPS path on both receipt printers. PrintHub build `0.6.3-receipt-portrait-fix` corrects the sample proof by enforcing a minimum 80 x 90 mm page while retaining dynamic growth for longer content.

Do not troubleshoot network connectivity, cutter support, extension installation, or printer defaults for that already-resolved rotation failure.

## Fallback browser printing

`window.print()` remains available only as a diagnostic/fallback path.

It prints to whatever ChromeOS currently considers the device default and therefore is **not** the production routing method for PassGen.

## Production queue activation

Production polling remains disabled until the source connection is authenticated and restricted so the endpoint cannot claim work intended for another route.

Secrets belong only in managed extension policy or another protected endpoint configuration. Never place a worker credential in the public GitHub Pages application.

Before activating a production route:

1. identify the logical PassKiosk route;
2. bind that route to this PrintHub endpoint;
3. resolve the intended installed printer locally;
4. verify the renderer on real hardware;
5. enable authenticated route-scoped polling;
6. verify claim, print invocation, completion/failure callback, and deliberate retry behavior.

Receipt Printer 1 is the first production route. Receipt Printer 2 follows only after the first route works end-to-end.
