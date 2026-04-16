param(
  [string]$ProjectId = "ai4impact-cc315",
  [string]$BackendId = "ai4impact-backend",
  [string]$GitBranch = "main",
  [switch]$SourceDeploy,
  [switch]$Force,
  [switch]$AllowMainDeploy,
  [switch]$AcknowledgeAppHosting
)

$ErrorActionPreference = "Stop"

if (-not $AcknowledgeAppHosting) {
  throw "App Hosting deploy is paused by default. Re-run with -AcknowledgeAppHosting only when you intentionally want to use Firebase App Hosting."
}

if ($GitBranch -eq "main" -and -not $AllowMainDeploy) {
  throw "Main branch rollout is blocked by default for safety. Deploy from release/* branch or re-run with -AllowMainDeploy when main is intentionally approved."
}

function Invoke-FirebaseTools {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  & npx.cmd firebase-tools @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "firebase-tools command failed: firebase-tools $($Arguments -join ' ')"
  }
}

Write-Host "Checking App Hosting backend '$BackendId' in project '$ProjectId'..." -ForegroundColor Cyan
Invoke-FirebaseTools -Arguments @("apphosting:backends:get", $BackendId, "--project", $ProjectId)

if ($SourceDeploy) {
  throw "SourceDeploy is not supported in this repo because firebase.json has no App Hosting deploy target mapping. Use branch rollout mode or configure App Hosting source deploy in Firebase first."
} else {
  $rolloutCommand = @(
    "apphosting:rollouts:create",
    $BackendId,
    "--project",
    $ProjectId,
    "-b",
    $GitBranch
  )

  if ($Force) {
    $rolloutCommand += "--force"
  }

  Write-Host "Creating App Hosting rollout from branch '$GitBranch'..." -ForegroundColor Green
  Invoke-FirebaseTools -Arguments $rolloutCommand
}

Write-Host "Deploy/Rollout command completed. Updated backend status:" -ForegroundColor Green
Invoke-FirebaseTools -Arguments @("apphosting:backends:get", $BackendId, "--project", $ProjectId)

Write-Host "Done. Run runtime health checks against the hosted domain before traffic cutover." -ForegroundColor Green
