param(
  [switch]$ApplyMigrations,
  [switch]$CloneData
)

$ErrorActionPreference = "Stop"

if ($ApplyMigrations) {
  if ($env:DATABASE_URL) {
    node scripts/supabase-apply-migrations-postgres.mjs
  } else {
    node scripts/supabase-apply-migrations.mjs
  }
}

if ($CloneData) {
  node scripts/supabase-clone-public-data.mjs
}

if (-not $ApplyMigrations -and -not $CloneData) {
  Write-Host "Use -ApplyMigrations e/ou -CloneData."
  Write-Host "Exemplo: powershell -File scripts/setup-supabase-dev.ps1 -ApplyMigrations -CloneData"
}
