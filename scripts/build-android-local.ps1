param(
  [string]$OutputDir,
  [string]$BuildRoot = "C:\dev\gsfdbv",
  [switch]$SkipPrebuild,
  [switch]$SkipTypecheck
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$env:NODE_ENV = "production"
$env:EXPO_NO_GIT_STATUS = "1"

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

function Sync-BuildRoot {
  $source = [System.IO.Path]::GetFullPath("$root\")
  $target = [System.IO.Path]::GetFullPath("$BuildRoot\")

  if ($source -ieq $target) {
    return
  }

  if ($target -notlike "C:\dev\*") {
    throw "BuildRoot recusado por seguranca: $target. Use um caminho dentro de C:\dev."
  }

  New-Item -ItemType Directory -Path $target -Force | Out-Null

  Write-Step "Sincronizando projeto para caminho curto: $target"

  $dirs = @("android", "app", "assets", "public", "scripts", "src", "supabase", "workers")
  foreach ($dir in $dirs) {
    $from = Join-Path $source $dir
    $to = Join-Path $target $dir
    if (Test-Path $from) {
      robocopy $from $to /E /NFL /NDL /NJH /NJS /NP /XD "build" ".gradle" ".cxx" "node_modules" ".git" | Out-Null
      if ($LASTEXITCODE -gt 7) {
        throw "Falha ao sincronizar $dir para $target. Codigo robocopy: $LASTEXITCODE"
      }
    }
  }

  $files = @("app.json", "App.tsx", "babel.config.js", "eas.json", "google-services.json", "index.ts", "metro.config.js", "package.json", "package-lock.json", "tsconfig.json", ".env")
  foreach ($file in $files) {
    $from = Join-Path $source $file
    if (Test-Path $from) {
      Copy-Item -LiteralPath $from -Destination (Join-Path $target $file) -Force
    }
  }

  if (-not (Test-Path (Join-Path $target "node_modules"))) {
    Write-Step "node_modules nao existe no caminho curto. Instalando dependencias..."
    Push-Location $target
    try {
      npm install --legacy-peer-deps 2>&1 | Tee-Object -FilePath $logFile -Append
    } finally {
      Pop-Location
    }
  }
}

try {
  Write-Step "Iniciando build Android local sem usar creditos EAS/Expo."
  Write-Step "Projeto: $root"
  Write-Step "BuildRoot: $BuildRoot"
  Write-Step "Saida APK: $apkOutputDir"
  Write-Step "Saida AAB: $aabOutputDir"
  Write-Step "Logs: $logOutputDir"

  Sync-BuildRoot

  $effectiveRoot = if ([System.IO.Path]::GetFullPath("$root\") -ieq [System.IO.Path]::GetFullPath("$BuildRoot\")) { "$root" } else { Resolve-Path $BuildRoot }
  Set-Location $effectiveRoot

  if (-not $SkipTypecheck) {
    Write-Step "Rodando typecheck..."
    npm run typecheck 2>&1 | Tee-Object -FilePath $logFile -Append
  }

  if (-not $SkipPrebuild) {
    Write-Step "Regenerando Android nativo para atualizar icones e recursos..."
    npx expo prebuild --platform android --clean --no-install 2>&1 | Tee-Object -FilePath $logFile -Append
  }

  $androidDir = Join-Path $effectiveRoot "android"
  $gradlew = Join-Path $androidDir "gradlew.bat"

  if (-not (Test-Path $gradlew)) {
    throw "android\gradlew.bat nao encontrado no caminho de build. Rode primeiro: npx expo prebuild --platform android"
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
