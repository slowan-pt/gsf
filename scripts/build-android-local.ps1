param(
  [string]$OutputDir,
  [switch]$SkipTypecheck
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

if (-not $OutputDir) {
  $OutputDir = Join-Path $root "builds"
}

$resolvedOutputDir = if (Test-Path $OutputDir) {
  Resolve-Path $OutputDir
} else {
  New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
  Resolve-Path $OutputDir
}

$androidDir = Join-Path $root "android"
$gradlew = Join-Path $androidDir "gradlew.bat"

if (-not (Test-Path $gradlew)) {
  throw "android\gradlew.bat nao encontrado. Rode primeiro: npx expo prebuild --platform android"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logFile = Join-Path $resolvedOutputDir "android-local-build-$stamp.log"

function Write-Step([string]$message) {
  $line = "[$(Get-Date -Format 'HH:mm:ss')] $message"
  Write-Host $line
  Add-Content -LiteralPath $logFile -Value $line
}

Write-Step "Iniciando build Android local sem usar creditos EAS/Expo."
Write-Step "Projeto: $root"
Write-Step "Saida: $resolvedOutputDir"

if (-not $SkipTypecheck) {
  Write-Step "Rodando typecheck..."
  npm run typecheck 2>&1 | Tee-Object -FilePath $logFile -Append
}

Write-Step "Gerando APK e AAB com Gradle local..."
Push-Location $androidDir
try {
  .\gradlew.bat :app:assembleRelease :app:bundleRelease --no-daemon 2>&1 | Tee-Object -FilePath $logFile -Append
} finally {
  Pop-Location
}

$apk = Get-ChildItem -Path (Join-Path $androidDir "app\build\outputs\apk\release") -Filter "*.apk" -Recurse |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

$aab = Get-ChildItem -Path (Join-Path $androidDir "app\build\outputs\bundle\release") -Filter "*.aab" -Recurse |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $apk) {
  throw "APK nao encontrado apos o build. Veja o log: $logFile"
}

if (-not $aab) {
  throw "AAB nao encontrado apos o build. Veja o log: $logFile"
}

$apkOut = Join-Path $resolvedOutputDir "GSF-Clubes-local-$stamp.apk"
$aabOut = Join-Path $resolvedOutputDir "GSF-Clubes-local-$stamp.aab"

Copy-Item -LiteralPath $apk.FullName -Destination $apkOut -Force
Copy-Item -LiteralPath $aab.FullName -Destination $aabOut -Force

Write-Step "APK gerado: $apkOut"
Write-Step "AAB gerado: $aabOut"

try {
  New-BurntToastNotification -Text "GSF Clubes", "APK e AAB gerados com sucesso." -Silent
} catch {
  Write-Step "Notificacao do Windows indisponivel neste PowerShell."
}

