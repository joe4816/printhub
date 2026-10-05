[CmdletBinding()]
param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot 'config.json'),
    [switch]$Diagnose,
    [string]$DryRunJobs = ''
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

function Read-JsonFile {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        Stop-WithMessage -Message "File not found: $Path" -ExitCode 2
    }

    try {
        return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    }
    catch {
        Stop-WithMessage -Message "Could not parse JSON file $Path : $($_.Exception.Message)" -ExitCode 2
    }
}

function Get-BindingMap {
    param($Config)

    $map = @{}
    foreach ($property in $Config.bindings.PSObject.Properties) {
        $map[$property.Name] = $property.Value
    }

    return $map
}

function Test-DryRunJobs {
    param(
        [string]$Path,
        $Config,
        [hashtable]$Bindings,
        [array]$InstalledPrinters
    )

    $document = Read-JsonFile -Path $Path
    $jobs = @()

    if ($document -is [System.Array]) {
        $jobs = @($document)
    }
    elseif ($document.jobs) {
        $jobs = @($document.jobs)
    }
    else {
        $jobs = @($document)
    }

    Write-Host ''
    Write-Host 'Dry-run endpoint jobs'
    Write-Host '---------------------'

    $seen = @{}
    $rows = @()
    $allValid = $true

    foreach ($job in $jobs) {
        $jobId = [string]$job.printJobId
        $endpointId = [string]$job.endpointId
        $bindingKey = [string]$job.bindingKey
        $media = [string]$job.mediaProfileId

        $reason = ''
        $valid = $true

        if ([string]::IsNullOrWhiteSpace($jobId)) {
            $valid = $false
            $reason = 'Missing printJobId'
        }
        elseif ($seen.ContainsKey($jobId)) {
            $valid = $false
            $reason = 'Duplicate printJobId in batch'
        }
        elseif ($endpointId -ne [string]$Config.endpointId) {
            $valid = $false
            $reason = 'Endpoint mismatch'
        }
        elseif (-not $Bindings.ContainsKey($bindingKey)) {
            $valid = $false
            $reason = 'Unknown binding'
        }
        elseif ([string]::IsNullOrWhiteSpace($media)) {
            $valid = $false
            $reason = 'Missing mediaProfileId'
        }
        else {
            $binding = $Bindings[$bindingKey]
            $printerName = [string]$binding.printerName
            $printer = $InstalledPrinters | Where-Object { $_.Name -eq $printerName } | Select-Object -First 1

            if (-not $printer) {
                $valid = $false
                $reason = 'Configured printer is not installed'
            }
        }

        if (-not [string]::IsNullOrWhiteSpace($jobId)) {
            $seen[$jobId] = $true
        }

        if (-not $valid) {
            $allValid = $false
        }

        $rows += [pscustomobject]@{
            Job        = $jobId
            Route      = [string]$job.routeId
            Binding    = $bindingKey
            Media      = $media
            Valid      = $valid
            Reason     = $reason
        }
    }

    $rows | Format-Table -AutoSize

    Write-Host ''
    if ($allValid) {
        Write-Host 'DRY RUN RESULT: Every sample job can be resolved to this endpoint and an installed printer.'
        return $true
    }

    Write-Warning 'DRY RUN RESULT: One or more sample jobs cannot be serviced by this endpoint.'
    return $false
}

$config = Read-JsonFile -Path $ConfigPath

if (-not $config.endpointId) {
    Stop-WithMessage -Message 'Config is missing endpointId.' -ExitCode 2
}

if (-not $config.bindings) {
    Stop-WithMessage -Message 'Config is missing bindings.' -ExitCode 2
}

$bindings = Get-BindingMap -Config $config

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

foreach ($bindingKey in ($bindings.Keys | Sort-Object)) {
    $binding = $bindings[$bindingKey]
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

if (-not [string]::IsNullOrWhiteSpace($DryRunJobs)) {
    $dryRunReady = Test-DryRunJobs -Path $DryRunJobs -Config $config -Bindings $bindings -InstalledPrinters $printers

    if ($dryRunReady) {
        exit 0
    }

    exit 5
}

if ($Diagnose) {
    if ($allReady) {
        exit 0
    }

    exit 4
}

Write-Warning 'Production queue polling and physical printing are intentionally disabled in this foundation build.'
Write-Host 'Use -Diagnose or -DryRunJobs while the generic endpoint protocol is finalized.'
exit 3
