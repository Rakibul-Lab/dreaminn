# Manual FTP upload prep (Windows). Run from project root after npm ci.
# Upload the printed folder with FileZilla to your cPanel Node app directory.
#
# Requires Git Bash or WSL for "npm run build" (uses cp). Or run build in GitHub Actions
# and download the artifact — easiest: use deploy-ftp.yml on push instead.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "==> npm ci"
npm ci

Write-Host "==> prisma generate"
npx prisma generate

Write-Host "==> npm run build (use Git Bash if cp fails in PowerShell)"
npm run build

$standalone = Join-Path $PWD ".next\standalone"
New-Item -ItemType Directory -Force -Path (Join-Path $standalone "tmp") | Out-Null
Set-Content -Path (Join-Path $standalone "tmp\restart.txt") -Value (Get-Date -Format o)

Write-Host ""
Write-Host "Upload THIS folder via FileZilla (FTP):"
Write-Host "  $standalone"
Write-Host ""
Write-Host "Remote path on server: /rrpdreaminn/ (or your Node app root)"
Write-Host "Startup file in cPanel Node.js App: server.js"
Write-Host "Do NOT upload .env — set variables in cPanel Node.js panel."
