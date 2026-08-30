# Deploy helper for Windows PowerShell.
# Pushes local source and moves the LIVE web-app deployment to a fresh version.
# There is ONE login-required deployment; its /exec URL stays stable across redeploys.
#
# Usage:   .\deploy.ps1 "short description of the change"
#
# Requires Node/npm and @google/clasp (v3.x), and `clasp login` already done.
# See SETUP.md for the full workflow, drift checks, and rebuild steps.

param([string]$Message = "Sync from local workspace")

# The live deployment (stable /exec URL). Access = Anyone with Google Account.
$DEPLOYMENT_ID = "AKfycbytkA07aNklbDv3gKca-iI02FPCdC1Q0i3gAtE1Ls1ry9MCoIUmG_KabhCBip8C0vn91g"

if (-not (Get-Command clasp -ErrorAction SilentlyContinue)) {
  Write-Host "clasp not found. Install it first:  npm install -g @google/clasp"
  exit 1
}

Write-Host "1/3  Pushing local source to Apps Script..."
clasp push --force
if ($LASTEXITCODE -ne 0) { Write-Host "push failed — aborting."; exit 1 }

Write-Host "2/3  Creating a new immutable version..."
# clasp writes "Created version N" — capture all streams so the number is read
# whether clasp logs it to stdout or stderr.
$verOut = (clasp create-version "$Message" 2>&1 | Out-String)
$verOut | Write-Host
if ($LASTEXITCODE -ne 0) { Write-Host "create-version failed — aborting."; exit 1 }
$ver = ([regex]::Match($verOut, '(\d+)')).Value
if (-not $ver) { Write-Host "Could not read the new version number — redeploy manually (see SETUP.md)."; exit 1 }

Write-Host "3/3  Pointing the live deployment at version $ver..."
clasp redeploy $DEPLOYMENT_ID --versionNumber $ver --description "$Message"
if ($LASTEXITCODE -ne 0) { Write-Host "redeploy failed."; exit 1 }

Write-Host ""
Write-Host "Done. The /exec URL is unchanged. Hard-refresh (Ctrl+F5) to see the change."
Write-Host "Verify with:  clasp deployments   (the @N after the live id should be $ver)"
