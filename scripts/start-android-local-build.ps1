param(
  [string]$OutputDir,
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
  "-OutputDir", "`"$OutputDir`""
)

if ($SkipTypecheck) {
  $argsList += "-SkipTypecheck"
}

Start-Process -FilePath "powershell.exe" -ArgumentList $argsList -WorkingDirectory $root
Write-Host "Build Android local iniciado em outro PowerShell."
Write-Host "APK:  $OutputDir\apk"
Write-Host "AAB:  $OutputDir\aab"
Write-Host "Logs: $OutputDir\logs"
