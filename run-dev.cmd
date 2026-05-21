@echo off
setlocal

REM Run Next.js dev server on Windows without PowerShell npm.ps1 restrictions.

cd /d "%~dp0"

set "NPM_CMD=C:\Program Files\nodejs\npm.cmd"

if not exist "%NPM_CMD%" (
  echo ERROR: "%NPM_CMD%" not found.
  echo Install Node.js LTS from https://nodejs.org/ then reopen your terminal.
  exit /b 1
)

"%NPM_CMD%" run dev
