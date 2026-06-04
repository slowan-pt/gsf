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

if ($Environment -eq "prod" -and $currentBranch -ne "master") {
  throw "Deploy de producao deve ser feito a partir da branch master. Branch atual: $currentBranch"
}

if ($Environment -eq "dev" -and $currentBranch -ne "develop") {
  throw "Deploy de desenvolvimento deve ser feito a partir da branch develop. Branch atual: $currentBranch"
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
} finally {
  if ($hadMainEnv -and (Test-Path $backupEnv)) {
    Copy-Item -LiteralPath $backupEnv -Destination $mainEnv -Force
    Remove-Item -LiteralPath $backupEnv -Force
  } elseif (-not $hadMainEnv -and (Test-Path $mainEnv)) {
    Remove-Item -LiteralPath $mainEnv -Force
  }
}
