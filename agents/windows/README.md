# Windows agent scaffold

The Windows side is still non-production, but it now supports three deliberate modes:

- printer / binding diagnostics;
- endpoint-job dry-run validation;
- a manual RAW TCP / ESC-POS receipt proof for a configured binding.

It does **not** poll the production backend or print production queue jobs yet.

## First local setup

1. Copy `config.example.json` to `config.json`.
2. Replace the example printer names with the exact names shown in Windows.
3. Run:

```powershell
.\PrintHubAgent.ps1 -Diagnose
```

The script enumerates installed Windows printers and validates each configured binding by exact printer name.

## Dry-run an endpoint batch

After the bindings are correct:

```powershell
.\PrintHubAgent.ps1 -DryRunJobs .\sample-jobs.json
```

The dry run verifies that every job:

- has a print job ID;
- is addressed to this endpoint;
- references a configured binding;
- includes a media profile;
- resolves to a currently installed Windows printer;
- does not duplicate another job ID inside the supplied batch.

No physical print call occurs.

## Local files

`config.json`, runtime state, local secrets, and logs are ignored by Git.

The checked-in `sample-jobs.json` contains fake development data only.


## RAW TCP receipt proof

A receipt binding may use:

```json
{
  "transport": "RAW_TCP_9100",
  "host": "192.0.2.10",
  "port": 9100
}
```

The agent diagnostics test whether that TCP target is reachable without sending print data.

To deliberately send one synthetic ESC/POS receipt and cut it:

```powershell
.\PrintHubAgent.ps1 -RawReceiptTestBinding RECEIPT
```

This path bypasses PDF/page geometry entirely:

```text
ESC/POS bytes -> TCP 9100 -> receipt printer -> cut
```

It is intentionally a manual proof only. Production queue polling remains disabled until the endpoint authentication and claim/complete protocol are wired.
