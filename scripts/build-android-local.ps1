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

$apkOutputDir = Join-Path $resolvedOutputDir "apk"
$aabOutputDir = Join-Path $resolvedOutputDir "aab"
$logOutputDir = Join-Path $resolvedOutputDir "logs"

New-Item -ItemType Directory -Path $apkOutputDir -Force | Out-Null
New-Item -ItemType Directory -Path $aabOutputDir -Force | Out-Null
New-Item -ItemType Directory -Path $logOutputDir -Force | Out-Null

$androidDir = Join-Path $root "android"
$gradlew = Join-Path $androidDir "gradlew.bat"

if (-not (Test-Path $gradlew)) {
  throw "android\gradlew.bat nao encontrado. Rode primeiro: npx expo prebuild --platform android"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logFile = Join-Path $logOutputDir "android-local-build-$stamp.log"

function Send-BuildNotification([string]$title, [string]$message) {
  try {
    Import-Module BurntToast -ErrorAction Stop
    New-BurntToastNotification -Text $title, $message -Silent
  } catch {
    Write-Host "Notificacao do Windows indisponivel: $message"
  }
}

function Write-Step([string]$message) {
  $line = "[$(Get-Date -Format 'HH:mm:ss')] $message"
  Write-Host $line
  Add-Content -LiteralPath $logFile -Value $line
}

try {
  Write-Step "Iniciando build Android local sem usar creditos EAS/Expo."
  Write-Step "Projeto: $root"
  Write-Step "Saida APK: $apkOutputDir"
  Write-Step "Saida AAB: $aabOutputDir"
  Write-Step "Logs: $logOutputDir"

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

  $apkOut = Join-Path $apkOutputDir "GSF-Clubes-local-$stamp.apk"
  $aabOut = Join-Path $aabOutputDir "GSF-Clubes-local-$stamp.aab"

  Copy-Item -LiteralPath $apk.FullName -Destination $apkOut -Force
  Copy-Item -LiteralPath $aab.FullName -Destination $aabOut -Force

  Write-Step "APK gerado: $apkOut"
  Write-Step "AAB gerado: $aabOut"
  Send-BuildNotification "GSF Clubes" "APK e AAB gerados com sucesso."
} catch {
  $erro = $_.Exception.Message
  Write-Step "ERRO: $erro"
  Send-BuildNotification "GSF Clubes" "Falha ao gerar APK/AAB. Veja o log em builds\logs."
  throw
}
