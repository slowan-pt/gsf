param(
  [string]$OutputDir,
  [ValidateSet("prod", "dev")]
  [string]$Environment = "prod",
  [switch]$SkipTypecheck
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not $OutputDir) {
  $OutputDir = Join-Path $root "builds"
}

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$argsList = @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", "`"$PSScriptRoot\build-android-local.ps1`"",
  "-OutputDir", "`"$OutputDir`"",
  "-BuildRoot", "`"C:\dev\gsfdbv`"",
  "-Environment", $Environment
)

if ($SkipTypecheck) {
  $argsList += "-SkipTypecheck"
}

Start-Process -FilePath "powershell.exe" -ArgumentList $argsList -WorkingDirectory $root -WindowStyle Hidden
Write-Host "Build Android local iniciado em segundo plano."
Write-Host "Ambiente: $Environment"
Write-Host "APK:  $OutputDir\apk"
Write-Host "AAB:  $OutputDir\aab"
Write-Host "Logs: $OutputDir\logs"
