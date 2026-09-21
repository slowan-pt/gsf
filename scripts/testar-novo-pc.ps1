$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

function Assert-Command([string]$Name, [string]$InstallHint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name nao foi encontrado. $InstallHint"
  }
}

Write-Host "Verificando ferramentas..."
Assert-Command "node" "Instale Node.js 22 ou superior."
Assert-Command "npm" "Instale Node.js 22 ou superior."
Assert-Command "git" "Instale Git para Windows."

$nodeMajor = [int]((node --version).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 22) {
  throw "Node.js muito antigo: $(node --version). Instale a versao 22 ou superior."
}

$obrigatorios = @(
  ".env",
  "package.json",
  "package-lock.json",
  ".git",
  "google-services.json",
  "android\app\release.keystore",
  "supabase\migrations"
)
foreach ($item in $obrigatorios) {
  if (-not (Test-Path -LiteralPath (Join-Path $root $item))) {
    throw "Item obrigatorio ausente: $item"
  }
}

if (-not (Test-Path -LiteralPath (Join-Path $root "node_modules"))) {
  Write-Host "Dependencias ainda nao instaladas. Executando npm install..."
  npm install --legacy-peer-deps
  if ($LASTEXITCODE -ne 0) { throw "npm install falhou." }
}

Write-Host "Executando testes do projeto..."
npm test
if ($LASTEXITCODE -ne 0) { throw "Os testes falharam." }

Write-Host ""
Write-Host "OK: projeto restaurado e testes aprovados." -ForegroundColor Green
Write-Host "Web local: npm run web"
Write-Host "Build Android: npm run android:local"
