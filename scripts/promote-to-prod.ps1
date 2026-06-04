$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$dirty = git status --porcelain
if ($dirty) {
  throw "A arvore de trabalho tem alteracoes pendentes. Faça commit ou descarte antes de promover para producao."
}

git checkout master
git merge develop --ff-only
npm run web:deploy:prod
