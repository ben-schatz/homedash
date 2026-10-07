# Run on the server to update and restart HomeDash.
# Usage (PowerShell, as admin): .\scripts\deploy.ps1
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
git pull --ff-only
npm ci --omit=dev
nssm restart HomeDash
Write-Host 'HomeDash updated and restarted.'
