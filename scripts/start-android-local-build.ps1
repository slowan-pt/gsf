param(
  [string]$OutputDir,
  [switch]$SkipTypecheck
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not $OutputDir) {
  $OutputDir = Join-Path $root "builds"
}

$argsList = @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", "`"$PSScriptRoot\build-android-local.ps1`"",
  "-OutputDir", "`"$OutputDir`""
)

if ($SkipTypecheck) {
  $argsList += "-SkipTypecheck"
}

Start-Process -FilePath "powershell.exe" -ArgumentList $argsList -WorkingDirectory $root
Write-Host "Build Android local iniciado em outro PowerShell. Saida: $OutputDir"

