# Windows agent scaffold

This folder is intentionally diagnostic-only right now.

## First local test

1. Copy `config.example.json` to `config.json`.
2. Replace the example printer names with the exact names shown in Windows.
3. Run PowerShell:

```powershell
.\PrintHubAgent.ps1 -Diagnose
```

The script enumerates installed Windows printers and validates each configured PrintHub binding by exact printer name.

It does not connect to a backend and it does not print anything.

`config.json` is ignored by Git so local machine-specific configuration is not accidentally committed.
