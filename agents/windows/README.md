# Windows agent scaffold

The Windows side is still non-production, but it now supports two safe modes:

- printer / binding diagnostics;
- endpoint-job dry-run validation.

It does **not** connect to a backend and it does **not** print production jobs.

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
