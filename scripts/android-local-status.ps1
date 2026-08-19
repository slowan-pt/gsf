param(
  [string]$OutputDir
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not $OutputDir) {
  $OutputDir = Join-Path $root "builds"
}

$apkDir = Join-Path $OutputDir "apk"
$aabDir = Join-Path $OutputDir "aab"
$logDir = Join-Path $OutputDir "logs"

Write-Host "Ultimos APKs:"
if (Test-Path $apkDir) {
  Get-ChildItem $apkDir -Filter "*.apk" | Sort-Object LastWriteTime -Descending | Select-Object -First 5 FullName, LastWriteTime
} else {
  Write-Host "Nenhum diretorio de APK encontrado."
}

Write-Host ""
Write-Host "Ultimos AABs:"
if (Test-Path $aabDir) {
  Get-ChildItem $aabDir -Filter "*.aab" | Sort-Object LastWriteTime -Descending | Select-Object -First 5 FullName, LastWriteTime
} else {
  Write-Host "Nenhum diretorio de AAB encontrado."
}

Write-Host ""
Write-Host "Ultimo log:"
if (Test-Path $logDir) {
  $log = Get-ChildItem $logDir -Filter "android-local-build-*.log" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($log) {
    Write-Host $log.FullName
    Get-Content $log.FullName -Tail 80
  } else {
    Write-Host "Nenhum log encontrado."
  }
} else {
  Write-Host "Nenhum diretorio de logs encontrado."
}

