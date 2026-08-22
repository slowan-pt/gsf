param(
  [string]$OutputDir,
  [string]$BuildRoot = "C:\dev\gsfdbv",
  [ValidateSet("prod", "dev")]
  [string]$Environment = "prod",
  [switch]$SkipPrebuild,
  [switch]$SkipTypecheck
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$env:NODE_ENV = "production"
$env:EXPO_NO_GIT_STATUS = "1"

$jdkCandidatos = @(
  "C:\Users\adm.sloannascimento\Downloads\puppin\jdk17\jdk-17.0.16+8",
  "C:\Program Files\Android\Android Studio\jbr"
)
$localJdk = $jdkCandidatos | Where-Object { Test-Path (Join-Path $_ "bin\java.exe") } | Select-Object -First 1
if ($localJdk) {
  $env:JAVA_HOME = $localJdk
  $env:PATH = "$localJdk\bin;$env:PATH"
}

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

function Invoke-LoggedCommand([string]$Command, [string[]]$Arguments, [string]$ErrorMessage) {
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & $Command @Arguments 2>&1 | Tee-Object -FilePath $logFile -Append
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if ($exitCode -ne 0) {
    throw "$ErrorMessage Codigo de saida: $exitCode"
  }
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

  $dirs = @("android", "app", "assets", "credentials", "plugins", "public", "scripts", "src", "supabase", "workers")
  foreach ($dir in $dirs) {
    $from = Join-Path $source $dir
    $to = Join-Path $target $dir
    if (Test-Path $from) {
      robocopy $from $to /MIR /NFL /NDL /NJH /NJS /NP /XD "build" ".gradle" ".cxx" "node_modules" ".git" | Out-Null
      if ($LASTEXITCODE -gt 7) {
        throw "Falha ao sincronizar $dir para $target. Codigo robocopy: $LASTEXITCODE"
      }
    }
  }

  $files = @("app.json", "App.tsx", "babel.config.js", "eas.json", "google-services.json", "index.ts", "metro.config.js", "package.json", "package-lock.json", "tsconfig.json")
  foreach ($file in $files) {
    $from = Join-Path $source $file
    if (Test-Path $from) {
      Copy-Item -LiteralPath $from -Destination (Join-Path $target $file) -Force
    }
  }

  $envSourceName = if ($Environment -eq "dev") { ".env.development.local" } else { ".env.production.local" }
  $envSource = Join-Path $source $envSourceName
  if (Test-Path $envSource) {
    Copy-Item -LiteralPath $envSource -Destination (Join-Path $target ".env") -Force
    Write-Step "Usando variaveis Android de $envSourceName"
  } elseif (Test-Path (Join-Path $source ".env")) {
    Copy-Item -LiteralPath (Join-Path $source ".env") -Destination (Join-Path $target ".env") -Force
    Write-Step "$envSourceName nao encontrado. Usando .env."
  } else {
    Write-Step "Nenhum arquivo .env encontrado para o build Android."
  }

  # Reinstala quando node_modules nao existe OU quando package-lock.json mudou
  # desde a ultima instalacao (dependencia nova adicionada, por exemplo) — sem
  # isso, o build usava sempre o node_modules antigo do caminho curto e um
  # `import` de um pacote recem-instalado quebrava so aqui, mesmo com tudo
  # certo na pasta de origem.
  $lockPath = Join-Path $target "package-lock.json"
  $stampPath = Join-Path $target ".node_modules_lock_hash"
  $hashAtual = if (Test-Path $lockPath) { (Get-FileHash -LiteralPath $lockPath -Algorithm SHA256).Hash } else { $null }
  $hashInstalado = if (Test-Path $stampPath) { Get-Content -LiteralPath $stampPath -Raw } else { $null }
  $precisaInstalar = (-not (Test-Path (Join-Path $target "node_modules"))) -or ($hashAtual -ne $hashInstalado)

  if ($precisaInstalar) {
    Write-Step "Dependencias desatualizadas ou ausentes no caminho curto. Instalando..."
    Push-Location $target
    try {
      Invoke-LoggedCommand -Command "npm" -Arguments @("install", "--legacy-peer-deps") -ErrorMessage "Falha ao instalar dependencias."
      if ($hashAtual) { Set-Content -LiteralPath $stampPath -Value $hashAtual -NoNewline }
    } finally {
      Pop-Location
    }
  }
}

# SHA1 da keystore de release registrada no Google Play Console. Se o build
# sair com outra fingerprint, o upload no Play sera rejeitado.
$fingerprintEsperada = "39:70:1A:72:A3:E0:56:5C:C4:FB:DA:40:32:A8:44:FF:4E:A4:37:0E"

function Get-Fingerprint([string]$Arquivo) {
  $keytool = Get-ChildItem -Path "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -ErrorAction SilentlyContinue
  if (-not $keytool) { return $null }
  # -J-Duser.language=en como argumento na linha de comando quebra em alguns
  # PowerShell (o "." acaba separando o argumento em dois). Usando a variavel
  # de ambiente evita isso e ainda corrige o bug de formatacao do keytool em
  # locale pt-BR (java.util.MissingFormatArgumentException).
  $envAnterior = $env:JAVA_TOOL_OPTIONS
  $env:JAVA_TOOL_OPTIONS = "-Duser.language=en"
  # O java imprime "Picked up JAVA_TOOL_OPTIONS..." no stderr sempre que essa
  # variavel esta setada — inofensivo, mas com ErrorActionPreference=Stop
  # (global no script) o PowerShell trata esse stderr como erro fatal.
  $prefAnterior = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $saida = & $keytool.FullName -printcert -jarfile $Arquivo 2>&1
  } finally {
    $ErrorActionPreference = $prefAnterior
    $env:JAVA_TOOL_OPTIONS = $envAnterior
  }
  $linha = $saida | Select-String "SHA1:"
  if (-not $linha) { return $null }
  return ($linha -replace ".*SHA1:\s*", "").Trim()
}

try {
  Write-Step "Iniciando build Android local sem usar creditos EAS/Expo."
  Write-Step "Projeto: $root"
  Write-Step "BuildRoot: $BuildRoot"
  Write-Step "Ambiente Android: $Environment"
  Write-Step "Saida APK: $apkOutputDir"
  Write-Step "Saida AAB: $aabOutputDir"
  Write-Step "Logs: $logOutputDir"

  $appJsonPath = Join-Path $root "app.json"
  if (Test-Path $appJsonPath) {
    $versionCodeAtual = (Get-Content $appJsonPath -Raw | ConvertFrom-Json).expo.android.versionCode
    Write-Step "versionCode atual (app.json): $versionCodeAtual - o Play Console exige um numero maior a cada upload."
  }

  Sync-BuildRoot

  $effectiveRoot = if ([System.IO.Path]::GetFullPath("$root\") -ieq [System.IO.Path]::GetFullPath("$BuildRoot\")) { "$root" } else { Resolve-Path $BuildRoot }
  Set-Location $effectiveRoot

  if (-not $SkipTypecheck) {
    Write-Step "Rodando typecheck..."
    Invoke-LoggedCommand -Command "npm" -Arguments @("run", "typecheck") -ErrorMessage "Typecheck falhou."
  }

  if (-not $SkipPrebuild) {
    Write-Step "Regenerando Android nativo para atualizar icones e recursos..."
    Invoke-LoggedCommand -Command "npx" -Arguments @("expo", "prebuild", "--platform", "android", "--clean", "--no-install") -ErrorMessage "Prebuild Android falhou."
  }

  $androidDir = Join-Path $effectiveRoot "android"
  $gradlew = Join-Path $androidDir "gradlew.bat"

  if (-not (Test-Path $gradlew)) {
    throw "android\gradlew.bat nao encontrado no caminho de build. Rode primeiro: npx expo prebuild --platform android"
  }

  Write-Step "Gerando APK e AAB com Gradle local..."
  Push-Location $androidDir
  try {
    Invoke-LoggedCommand -Command ".\gradlew.bat" -Arguments @(":app:assembleRelease", ":app:bundleRelease", "--no-daemon") -ErrorMessage "Gradle falhou."
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

  $fpApk = Get-Fingerprint $apkOut
  $fpAab = Get-Fingerprint $aabOut
  Write-Step "Fingerprint APK: $fpApk"
  Write-Step "Fingerprint AAB: $fpAab"
  if ($fpApk -and $fpApk -ne $fingerprintEsperada) {
    Write-Step "ATENCAO: fingerprint do APK diferente da esperada ($fingerprintEsperada). O Play Console vai rejeitar o AAB."
  }
  if ($fpAab -and $fpAab -ne $fingerprintEsperada) {
    Write-Step "ATENCAO: fingerprint do AAB diferente da esperada ($fingerprintEsperada). O Play Console vai rejeitar o AAB."
  }
  if ($fpAab -eq $fingerprintEsperada) {
    Write-Step "Assinatura conferida - igual a chave registrada no Play Console."
  }

  Send-BuildNotification "GSF Clubes" "APK e AAB gerados com sucesso."
} catch {
  $erro = $_.Exception.Message
  Write-Step "ERRO: $erro"
  Send-BuildNotification "GSF Clubes" "Falha ao gerar APK/AAB. Veja o log em builds\logs."
  throw
}
