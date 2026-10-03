# PrintHub documentation

Use this index to navigate the current design.

## Architecture

- `ARCHITECTURE.md` — route → endpoint → binding → physical printer model
- `ROUTING.md` — logical routes and primary / second-copy fan-out
- `JOB_CONTRACT.md` — generic endpoint job envelope
- `STATUS_MODEL.md` — print-job lifecycle
- `CLAIM_LEASES.md` — safe queue claiming and crash recovery
- `ENDPOINT_PROTOCOL.md` — target heartbeat / poll / completion protocol

## Endpoint implementations

- `CHROMEOS_DEPLOYMENT.md` — no-extension ChromeOS browser endpoint
- `PROVISIONING.md` — endpoint setup helper and auto-launch URL generation
- `WINDOWS_AGENT.md` — Windows printer-host endpoint
- `READINESS_CHECKLIST.md` — real-environment information still required

## Source integration

- `PASSKIOSK_ADAPTER.md` — offline PassKiosk transaction normalization
- `PASSKIOSK_MIGRATION.md` — additive production migration plan

## Development and testing

- `SIMULATOR.md` — browser routing / queue simulator
- `PRINTER_PICKER_UI.md` — primary + optional second-copy UI prototype
- `TESTING.md` — automated tests and CI

## Public tools

Endpoint setup helper:

`https://joe4816.github.io/printhub/setup/`

Routing simulator:

`https://joe4816.github.io/printhub/simulator/`

Printer-picker prototype:

`https://joe4816.github.io/printhub/prototype/printer-picker/`

The simulator and picker use fake data and do not connect to the live PassKiosk queue.
