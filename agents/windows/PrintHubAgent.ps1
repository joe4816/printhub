[CmdletBinding()]
param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot 'config.json'),
    [switch]$Diagnose,
    [string]$DryRunJobs = '',
    [string]$RawReceiptTestBinding = ''
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


function Get-BindingTransport {
    param($Binding)
    return ([string]$Binding.transport).Trim().ToUpperInvariant()
}

function Test-RawTcpTarget {
    param(
        [string]$HostName,
        [int]$Port,
        [int]$TimeoutMs = 1500
    )

    if ([string]::IsNullOrWhiteSpace($HostName) -or $Port -lt 1 -or $Port -gt 65535) {
        return $false
    }

    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $async = $client.BeginConnect($HostName, $Port, $null, $null)
        if (-not $async.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) {
            return $false
        }
        $client.EndConnect($async)
        return $client.Connected
    }
    catch {
        return $false
    }
    finally {
        $client.Dispose()
    }
}

function Send-RawTcpBytes {
    param(
        [string]$HostName,
        [int]$Port,
        [byte[]]$Bytes
    )

    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $client.Connect($HostName, $Port)
        $stream = $client.GetStream()
        try {
            $stream.Write($Bytes, 0, $Bytes.Length)
            $stream.Flush()
        }
        finally {
            $stream.Dispose()
        }
    }
    finally {
        $client.Dispose()
    }
}

function Add-AsciiBytes {
    param(
        [System.Collections.Generic.List[byte]]$Buffer,
        [string]$Text
    )

    $Buffer.AddRange([System.Text.Encoding]::ASCII.GetBytes($Text))
}

function New-EscPosReceiptTestBytes {
    param(
        [string]$BindingKey,
        [string]$EndpointLabel
    )

    $buffer = [System.Collections.Generic.List[byte]]::new()
    $nl = [Environment]::NewLine

    # ESC @ initialize; ESC a 0 left align; ESC ! 0 normal text.
    $buffer.AddRange([byte[]](0x1B,0x40))
    $buffer.AddRange([byte[]](0x1B,0x61,0x00))
    $buffer.AddRange([byte[]](0x1B,0x21,0x00))

    Add-AsciiBytes -Buffer $buffer -Text ("PRINTHUB RAW TCP TEST" + $nl)
    Add-AsciiBytes -Buffer $buffer -Text (("Endpoint: {0}" -f $EndpointLabel) + $nl)
    Add-AsciiBytes -Buffer $buffer -Text (("Binding:  {0}" -f $BindingKey) + $nl)
    Add-AsciiBytes -Buffer $buffer -Text ("--------------------------------" + $nl)

    # ESC E 1 emphasized title; ESC E 0 off.
    $buffer.AddRange([byte[]](0x1B,0x45,0x01))
    Add-AsciiBytes -Buffer $buffer -Text ("CALL PASS" + $nl)
    $buffer.AddRange([byte[]](0x1B,0x45,0x00))

    Add-AsciiBytes -Buffer $buffer -Text ("STUDENT: TEST STUDENT" + $nl)
    Add-AsciiBytes -Buffer $buffer -Text ("SEND TO: TEST DESTINATION" + $nl)
    Add-AsciiBytes -Buffer $buffer -Text ("WHEN: IMMEDIATELY" + $nl)
    Add-AsciiBytes -Buffer $buffer -Text ("--------------------------------" + $nl)
    Add-AsciiBytes -Buffer $buffer -Text ("Direct ESC/POS over TCP 9100." + $nl)

    # ESC d 3 feeds three lines; GS V 0 full cut.
    $buffer.AddRange([byte[]](0x1B,0x64,0x03))
    $buffer.AddRange([byte[]](0x1D,0x56,0x00))

    return $buffer.ToArray()
}

function Invoke-RawReceiptTest {
    param(
        [string]$BindingKey,
        $Binding,
        $Config
    )

    $transport = Get-BindingTransport -Binding $Binding
    if ($transport -ne 'RAW_TCP_9100') {
        Stop-WithMessage -Message ("Binding {0} is {1}, not RAW_TCP_9100." -f $BindingKey, $transport) -ExitCode 6
    }

    $hostName = [string]$Binding.host
    $port = if ($Binding.port) { [int]$Binding.port } else { 9100 }

    if ([string]::IsNullOrWhiteSpace($hostName)) {
        Stop-WithMessage -Message ("Binding {0} is missing host." -f $BindingKey) -ExitCode 6
    }

    Write-Host ''
    Write-Host 'PrintHub RAW TCP receipt proof'
    Write-Host '------------------------------'
    Write-Host ("Endpoint : {0}" -f $Config.endpointId)
    Write-Host ("Binding  : {0}" -f $BindingKey)
    Write-Host ("Target   : {0}:{1}" -f $hostName, $port)
    Write-Host ''

    if (-not (Test-RawTcpTarget -HostName $hostName -Port $port -TimeoutMs 2000)) {
        Stop-WithMessage -Message ("Could not connect to {0}:{1}." -f $hostName, $port) -ExitCode 7
    }

    $bytes = New-EscPosReceiptTestBytes -BindingKey $BindingKey -EndpointLabel ([string]$Config.label)
    Send-RawTcpBytes -HostName $hostName -Port $port -Bytes $bytes

    Write-Host ("RAW TEST SENT: {0} bytes to {1}:{2}. Confirm paper output and cut." -f $bytes.Length, $hostName, $port)
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
            $transport = Get-BindingTransport -Binding $binding

            if ($transport -eq 'WINDOWS_NAMED_PRINTER') {
                $printerName = [string]$binding.printerName
                $printer = $InstalledPrinters | Where-Object { $_.Name -eq $printerName } | Select-Object -First 1

                if (-not $printer) {
                    $valid = $false
                    $reason = 'Configured printer is not installed'
                }
            }
            elseif ($transport -eq 'RAW_TCP_9100') {
                $hostName = [string]$binding.host
                $port = if ($binding.port) { [int]$binding.port } else { 9100 }

                if ([string]::IsNullOrWhiteSpace($hostName) -or $port -lt 1 -or $port -gt 65535) {
                    $valid = $false
                    $reason = 'RAW binding has invalid host/port'
                }
            }
            else {
                $valid = $false
                $reason = 'Unsupported transport'
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
        Write-Host 'DRY RUN RESULT: Every sample job can be resolved to this endpoint and a supported transport.'
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
    $transport = Get-BindingTransport -Binding $binding

    if ($transport -eq 'WINDOWS_NAMED_PRINTER') {
        $printerName = [string]$binding.printerName
        $match = $printers | Where-Object { $_.Name -eq $printerName } | Select-Object -First 1
        $ready = [bool]$match
        $target = $printerName
        $detail = if ($ready) { 'Installed' } else { 'Printer not installed' }
    }
    elseif ($transport -eq 'RAW_TCP_9100') {
        $hostName = [string]$binding.host
        $port = if ($binding.port) { [int]$binding.port } else { 9100 }
        $configured = -not [string]::IsNullOrWhiteSpace($hostName) -and $port -ge 1 -and $port -le 65535
        $reachable = $false

        if ($configured) {
            $reachable = Test-RawTcpTarget -HostName $hostName -Port $port
        }

        $ready = [bool]($configured -and $reachable)
        $target = if ($configured) { ("{0}:{1}" -f $hostName, $port) } else { '(invalid host/port)' }
        $detail = if (-not $configured) { 'Invalid host/port' } elseif ($reachable) { 'TCP reachable' } else { 'TCP not reachable' }
    }
    else {
        $ready = $false
        $target = ''
        $detail = 'Unsupported transport'
    }

    if (-not $ready) {
        $allReady = $false
    }

    $rows += [pscustomobject]@{
        Binding   = $bindingKey
        Transport = $transport
        Target    = $target
        Ready     = $ready
        Detail    = $detail
    }
}

$rows | Format-Table -AutoSize

Write-Host ''
if ($allReady) {
    Write-Host 'RESULT: All configured bindings are ready.'
}
else {
    Write-Warning 'RESULT: One or more configured bindings are not ready.'
}

if (-not [string]::IsNullOrWhiteSpace($RawReceiptTestBinding)) {
    if (-not $bindings.ContainsKey($RawReceiptTestBinding)) {
        Stop-WithMessage -Message ("Unknown binding: {0}" -f $RawReceiptTestBinding) -ExitCode 6
    }

    Invoke-RawReceiptTest -BindingKey $RawReceiptTestBinding -Binding $bindings[$RawReceiptTestBinding] -Config $config
    exit 0
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

Write-Warning 'Production queue polling remains disabled. The agent currently supports diagnostics, dry-run validation, and deliberate RAW TCP receipt proofs.'
Write-Host 'Use -Diagnose, -DryRunJobs, or -RawReceiptTestBinding while backend queue migration is finalized.'
exit 3
