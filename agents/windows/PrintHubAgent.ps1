[CmdletBinding()]
param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot 'config.json'),
    [switch]$Diagnose
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Stop-WithMessage {
    param(
        [string]$Message,
        [int]$ExitCode = 1
    )

    Write-Error $Message
    exit $ExitCode
}

if (-not (Test-Path -LiteralPath $ConfigPath)) {
    Stop-WithMessage -Message "PrintHub config not found: $ConfigPath. Copy config.example.json to config.json and edit the bindings." -ExitCode 2
}

try {
    $config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
}
catch {
    Stop-WithMessage -Message "Could not parse PrintHub config: $($_.Exception.Message)" -ExitCode 2
}

if (-not $config.endpointId) {
    Stop-WithMessage -Message 'Config is missing endpointId.' -ExitCode 2
}

if (-not $config.bindings) {
    Stop-WithMessage -Message 'Config is missing bindings.' -ExitCode 2
}

Write-Host ''
Write-Host 'PrintHub Windows Agent Diagnostics'
Write-Host '----------------------------------'
Write-Host ("Endpoint : {0}" -f $config.endpointId)
Write-Host ("Label    : {0}" -f $config.label)
Write-Host ''

try {
    $printers = @(Get-Printer | Sort-Object Name)
}
catch {
    Stop-WithMessage -Message "Windows printer enumeration failed: $($_.Exception.Message)" -ExitCode 2
}

Write-Host ("Installed Windows printers: {0}" -f $printers.Count)
foreach ($printer in $printers) {
    Write-Host ("  - {0}  [Driver: {1}] [Port: {2}]" -f $printer.Name, $printer.DriverName, $printer.PortName)
}

Write-Host ''
Write-Host 'Configured PrintHub bindings'
Write-Host '----------------------------'

$rows = @()
$allReady = $true

foreach ($property in $config.bindings.PSObject.Properties) {
    $bindingKey = $property.Name
    $binding = $property.Value
    $printerName = [string]$binding.printerName
    $match = $printers | Where-Object { $_.Name -eq $printerName } | Select-Object -First 1

    if (-not $match) {
        $allReady = $false
    }

    $rows += [pscustomobject]@{
        Binding   = $bindingKey
        Transport = [string]$binding.transport
        Printer   = $printerName
        Installed = [bool]$match
    }
}

$rows | Format-Table -AutoSize

Write-Host ''
if ($allReady) {
    Write-Host 'RESULT: All configured printer bindings exist on this Windows machine.'
}
else {
    Write-Warning 'RESULT: One or more configured printer names do not exactly match an installed Windows printer.'
}

if ($Diagnose) {
    if ($allReady) {
        exit 0
    }

    exit 4
}

Write-Warning 'Production queue polling is intentionally disabled in this foundation build.'
Write-Host 'Run with -Diagnose while the generic endpoint protocol is finalized.'
exit 3
