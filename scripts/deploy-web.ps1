param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("dev", "prod")]
  [string]$Environment
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$settings = @{
  dev = @{
    Label = "DESENVOLVIMENTO"
    Branch = "develop"
    Project = "gsf-clubes"
    EnvFile = ".env.development.local"
  }
  prod = @{
    Label = "PRODUCAO"
    Branch = "main"
    Project = "gsf-clubes"
    EnvFile = ".env.production.local"
  }
}

$cfg = $settings[$Environment]
$currentBranch = (git branch --show-current).Trim()

if ($currentBranch -ne $cfg.Branch) {
  throw "Deploy de $($cfg.Label) deve ser feito a partir da branch $($cfg.Branch). Branch atual: $currentBranch"
}

$envFile = Join-Path $root $cfg.EnvFile
$mainEnv = Join-Path $root ".env"
$backupEnv = Join-Path $env:TEMP ("fonseca-env-backup-" + [guid]::NewGuid() + ".tmp")
$hadMainEnv = Test-Path $mainEnv

try {
  if ($hadMainEnv) {
    Copy-Item -LiteralPath $mainEnv -Destination $backupEnv -Force
  }

  if (Test-Path $envFile) {
    Copy-Item -LiteralPath $envFile -Destination $mainEnv -Force
    Get-Content $envFile | ForEach-Object {
      $line = $_.Trim()
      if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
        $key, $value = $line.Split("=", 2)
        [Environment]::SetEnvironmentVariable($key.Trim(), $value.Trim(), "Process")
      }
    }
    Write-Host "Usando variaveis de ambiente: $($cfg.EnvFile)"
  } else {
    Write-Host "Arquivo $($cfg.EnvFile) nao encontrado. Usando .env atual."
  }

  Write-Host "Publicando ambiente: $($cfg.Label)"
  Write-Host "Cloudflare Pages project: $($cfg.Project)"
  Write-Host "Branch de deploy: $($cfg.Branch)"

  npm run typecheck
  npm run web:export
  npx wrangler pages deploy dist --project-name $cfg.Project --branch $cfg.Branch --commit-dirty=true

  if ($Environment -eq "prod" -and $env:SKIP_ANDROID_LOCAL_BUILD -ne "1") {
    Write-Host "Iniciando build Android local em segundo plano para economizar creditos EAS/Expo..."
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-android-local-build.ps1 -Environment prod -SkipTypecheck
  }
} finally {
  if ($hadMainEnv -and (Test-Path $backupEnv)) {
    Copy-Item -LiteralPath $backupEnv -Destination $mainEnv -Force
    Remove-Item -LiteralPath $backupEnv -Force
  } elseif (-not $hadMainEnv -and (Test-Path $mainEnv)) {
    Remove-Item -LiteralPath $mainEnv -Force
  }
}
