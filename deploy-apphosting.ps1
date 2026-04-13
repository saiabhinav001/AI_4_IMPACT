param(
  [string]$ProjectId = "ai4impact-cc315",
  [string]$BackendId = "ai4impact-backend",
  [string]$GitBranch = "main",
  [switch]$SourceDeploy,
  [switch]$Force
)

$ErrorActionPreference = "Stop"

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
  $sourceDeployCommand = @(
    "deploy",
    "--only",
    "apphosting:$BackendId",
    "--project",
    $ProjectId,
    "--non-interactive"
  )

  if ($Force) {
    $sourceDeployCommand += "--force"
  }

  Write-Host "Deploying local source to App Hosting backend '$BackendId'..." -ForegroundColor Green
  Invoke-FirebaseTools -Arguments $sourceDeployCommand
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
