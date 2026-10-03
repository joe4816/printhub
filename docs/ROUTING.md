# Routing model

## User-facing rule

Applications should present **logical destinations**, not printer hardware details.

Example:

```
Primary printer
[ AP Receipt ▼ ]

☑ Send second copy

Second printer
[ AP File Copy ▼ ]
```

The selections are route IDs.

The backend expands those route IDs into one independent PrintHub job per selected destination.

## Why routes are separate from endpoints

A route answers:

> Where does the user want this copy to go, and what should that copy look like?

An endpoint answers:

> Which appliance is responsible for physically printing it?

The two are related but not identical.

For example, one Windows endpoint can expose two different routes:

```
AP_RECEIPT
  -> endpoint PH-AP-WIN-01
  -> binding RECEIPT
  -> media 80MM_RECEIPT

AP_FILE
  -> endpoint PH-AP-WIN-01
  -> binding FILE
  -> media LETTER_FILE
```

A ChromeOS endpoint normally exposes only one printer binding:

```
FRONT_RECEIPT
  -> endpoint PH-FRONT-RECEIPT-01
  -> binding DEFAULT
  -> media 80MM_RECEIPT
```

## Multi-copy fan-out

One source transaction remains one source transaction.

Selecting a second copy does **not** duplicate the business event.

It creates sibling print jobs:

```
Transaction PK-123
  |
  +-- Print Job 1
  |     route AP_RECEIPT
  |     copyRole PRIMARY
  |
  +-- Print Job 2
        route AP_FILE
        copyRole SECONDARY
```

Each sibling job has its own lifecycle. One copy can succeed while another fails and is retried.

## Duplicate route rule

The UI should normally prevent users from selecting the same route as both primary and secondary.

If two copies on the same physical printer are ever needed, model that explicitly as `copies: 2` or as a deliberate duplicate-copy feature rather than accidentally generating two indistinguishable jobs.

## Route registry

See:

`config/routes.example.json`

The registry has three layers:

1. media profiles;
2. endpoints and their local printer bindings;
3. logical routes.

No secret belongs in the route registry.
