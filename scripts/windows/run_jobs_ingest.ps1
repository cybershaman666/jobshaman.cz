[CmdletBinding()]
param(
    [string]$RepoRoot,
    [string]$ImageName = "jobshaman-backend",
    [string]$EnvFile,
    [string]$LogDir,
    [switch]$Rebuild,
    [string]$Countries = "CZ,AT,DE,SK,PL",
    [string]$Sites = "indeed,linkedin,google",
    [string]$Queries = "software engineer,project manager,data analyst,sales,marketing,customer support,operations",
    [int]$ResultsWanted = 30,
    [int]$HoursOld = 168,
    [double]$JobspySleepSeconds = 1.0,
    [int]$LinkedinResultsWantedCap = 12,
    [int]$LimitLocationsPerCountry = 4,
    [int]$JobspyGeocodingLimit = 1200,
    [switch]$LinkedinFetchDescription,
    [switch]$SkipJobspyGeocodingBackfill,
    [switch]$DisableRemoteNormalization
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

$resolvedRepoRoot = Resolve-RepoRoot -Candidate $RepoRoot
$resolvedEnvFile = if ($EnvFile) {
    (Resolve-Path -LiteralPath $EnvFile).Path
} else {
    Join-Path $resolvedRepoRoot "backend\.env"
}

if (-not (Test-Path -LiteralPath $resolvedEnvFile)) {
    throw "Env file not found: $resolvedEnvFile"
}

$resolvedLogDir = if ($LogDir) {
    $LogDir
} else {
    Join-Path $resolvedRepoRoot "logs\jobs-ingest"
}

Ensure-Command -Name "docker"

New-Item -ItemType Directory -Force -Path $resolvedLogDir | Out-Null

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logFile = Join-Path $resolvedLogDir "jobs-ingest_$timestamp.log"

if ($Rebuild) {
    Write-Host "Building Docker image '$ImageName'..."
    & docker build -f backend\Dockerfile -t $ImageName . 2>&1 | Tee-Object -FilePath $logFile -Append
    if ($LASTEXITCODE -ne 0) {
        throw "Docker build failed. See log: $logFile"
    }
}

$containerName = "jobshaman-ingest-" + ([guid]::NewGuid().ToString("N").Substring(0, 8))
$dockerArgs = @(
    "run",
    "--rm",
    "--name", $containerName,
    "--env-file", $resolvedEnvFile,
    "-e", "PYTHONUNBUFFERED=1",
    $ImageName,
    "python", "scripts/run_unified_jobs_ingest.py",
    "--countries", $Countries,
    "--sites", $Sites,
    "--queries", $Queries,
    "--results-wanted", "$ResultsWanted",
    "--hours-old", "$HoursOld",
    "--jobspy-sleep-seconds", "$JobspySleepSeconds",
    "--linkedin-results-wanted-cap", "$LinkedinResultsWantedCap",
    "--limit-locations-per-country", "$LimitLocationsPerCountry",
    "--jobspy-geocoding-limit", "$JobspyGeocodingLimit"
)

if ($LinkedinFetchDescription) {
    $dockerArgs += "--linkedin-fetch-description"
}
if ($SkipJobspyGeocodingBackfill) {
    $dockerArgs += "--skip-jobspy-geocoding-backfill"
}
if ($DisableRemoteNormalization) {
    $dockerArgs += "--disable-remote-normalization"
}

Push-Location $resolvedRepoRoot
try {
    Write-Host "Starting unified ingest. Log: $logFile"
    & docker @dockerArgs 2>&1 | Tee-Object -FilePath $logFile -Append
    $exitCode = $LASTEXITCODE
} finally {
    Pop-Location
}

if ($exitCode -ne 0) {
    throw "Unified ingest failed with exit code $exitCode. See log: $logFile"
}

Write-Host "Unified ingest finished successfully. Log: $logFile"
