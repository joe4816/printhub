# Printer picker prototype

A standalone non-production prototype is available at:

`/prototype/printer-picker/`

It demonstrates the intended staff interaction:

```
Primary printer
[ route ]

☐ Send second copy
```

When the checkbox is enabled, a second route selector appears.

The prototype uses the real shared routing engine and the example route registry, but it creates no backend records and contacts no production system.

It also displays the generated endpoint, binding, and media profile underneath so the implementation can be inspected while the UI remains simple for staff.

The production PassKiosk UI should copy the interaction pattern, not expose the technical endpoint details.
