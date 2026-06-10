Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Push-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location ..

npm install
npm run dev

Pop-Location
