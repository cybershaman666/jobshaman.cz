[CmdletBinding()]
param(
    [string]$RepoRoot,
    [string]$TaskPrefix = "JobShaman Ingest",
    [string]$MorningTime = "06:00",
    [string]$AfternoonTime = "14:00",
    [string]$ImageName = "jobshaman-backend",
    [switch]$RebuildImage
)

$ErrorActionPreference = "Stop"

function Resolve-RepoRoot {
    param([string]$Candidate)

    if ($Candidate) {
        return (Resolve-Path -LiteralPath $Candidate).Path
    }

    if (-not $PSScriptRoot) {
        throw "Unable to resolve script directory from PSScriptRoot."
    }
    $scriptDir = $PSScriptRoot
    return (Resolve-Path -LiteralPath (Join-Path $scriptDir "..\..")).Path
}

function Ensure-Command {
    param([string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found in PATH."
    }
}

function Register-IngestTask {
    param(
        [string]$TaskName,
        [string]$AtTime,
        [string]$PowerShellExe,
        [string]$ScriptPath,
        [string]$WorkingDirectory
    )

    $actionArgs = @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", ('"{0}"' -f $ScriptPath),
        "-RepoRoot", ('"{0}"' -f $WorkingDirectory),
        "-ImageName", ('"{0}"' -f $ImageName)
    )

    if ($RebuildImage) {
        $actionArgs += "-Rebuild"
    }

    $taskAction = New-ScheduledTaskAction -Execute $PowerShellExe -Argument ($actionArgs -join " ") -WorkingDirectory $WorkingDirectory
    $taskTrigger = New-ScheduledTaskTrigger -Daily -At $AtTime
    $taskSettings = New-ScheduledTaskSettingsSet `
        -StartWhenAvailable `
        -MultipleInstances IgnoreNew `
        -ExecutionTimeLimit (New-TimeSpan -Hours 8)

    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $taskAction `
        -Trigger $taskTrigger `
        -Settings $taskSettings `
        -Description "Runs JobShaman unified jobs ingest in Docker" `
        -Force | Out-Null
}

$resolvedRepoRoot = Resolve-RepoRoot -Candidate $RepoRoot
$runnerScript = Join-Path $resolvedRepoRoot "scripts\windows\run_jobs_ingest.ps1"

if (-not (Test-Path -LiteralPath $runnerScript)) {
    throw "Runner script not found: $runnerScript"
}

Ensure-Command -Name "docker"

$powerShellExe = (Get-Command powershell.exe).Source

Register-IngestTask `
    -TaskName "$TaskPrefix Morning" `
    -AtTime $MorningTime `
    -PowerShellExe $powerShellExe `
    -ScriptPath $runnerScript `
    -WorkingDirectory $resolvedRepoRoot

Register-IngestTask `
    -TaskName "$TaskPrefix Afternoon" `
    -AtTime $AfternoonTime `
    -PowerShellExe $powerShellExe `
    -ScriptPath $runnerScript `
    -WorkingDirectory $resolvedRepoRoot

Write-Host "Scheduled tasks installed:"
Write-Host " - $TaskPrefix Morning at $MorningTime"
Write-Host " - $TaskPrefix Afternoon at $AfternoonTime"
