<#
  Busca na wiki (Pathfinder Wiki, paginas em portugues "AY_Honors/<nome>/pt-br") os requisitos das
  especialidades que ficaram sem texto confiavel no Word. NAO altera o banco: so baixa e organiza.

  Uso:
    powershell -ExecutionPolicy Bypass -File .\buscar_requisitos_wiki.ps1
    powershell -ExecutionPolicy Bypass -File .\buscar_requisitos_wiki.ps1 -Saida C:\temp\wiki -Pausa 2500
    powershell -ExecutionPolicy Bypass -File .\buscar_requisitos_wiki.ps1 -SoListar     # so lista as paginas pt-br

  Saida (pasta -Saida, padrao: .\wiki_requisitos):
    resultado.csv        uma linha por especialidade procurada (achou ou nao, pagina, quantidade de itens)
    <codigo>_<nome>.txt  requisitos extraidos (1., a), i)) de cada especialidade encontrada
    bruto\<pagina>.txt   wikitext original de cada pagina (para ajustar a extracao sem baixar de novo)
    paginas_pt-br.txt    lista de todas as paginas pt-br encontradas na wiki
#>
param(
  [string]$Base = 'https://wiki.pathfindersonline.org',
  [string]$Saida = (Join-Path $PSScriptRoot 'wiki_requisitos'),
  [int]$Pausa = 1500,          # milissegundos entre chamadas (seja gentil com o site)
  [int]$Tentativas = 6,
  [switch]$SoListar
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$UA = @{ 'User-Agent' = 'DBVplus-catalogo/1.0 (consulta de requisitos de especialidades; contato: sloan.nascimento@gmail.com)' }

$Alvos = @(
  @{ Codigo='AA-011'; Nome='Criação de cavalos' },
  @{ Codigo='AA-015'; Nome='Criação de cabras' },
  @{ Codigo='AR-060'; Nome='Skate' },
  @{ Codigo='AR-119'; Nome='Slackline' },
  @{ Codigo='EN-002'; Nome='Astronomia' },
  @{ Codigo='EN-003'; Nome='Aves' },
  @{ Codigo='EN-004'; Nome='Aves domésticas' },
  @{ Codigo='EN-005'; Nome='Flores' },
  @{ Codigo='EN-006'; Nome='Árvores' },
  @{ Codigo='EN-007'; Nome='Insetos' },
  @{ Codigo='EN-009'; Nome='Fungos' },
  @{ Codigo='EN-010'; Nome='Mamíferos' },
  @{ Codigo='EN-011'; Nome='Répteis' },
  @{ Codigo='EN-012'; Nome='Rochas e minerais' },
  @{ Codigo='EN-013'; Nome='Rochas e minerais - avançado' },
  @{ Codigo='EN-014'; Nome='Moluscos' },
  @{ Codigo='EN-017'; Nome='Fósseis' },
  @{ Codigo='EN-018'; Nome='Samambaias' },
  @{ Codigo='EN-019'; Nome='Arbustos' },
  @{ Codigo='EN-020'; Nome='Aves de estimação' },
  @{ Codigo='EN-021'; Nome='Gramíneas' },
  @{ Codigo='EN-022'; Nome='Peixes' },
  @{ Codigo='EN-024'; Nome='Felinos' },
  @{ Codigo='EN-025'; Nome='Rebanhos domésticos' },
  @{ Codigo='EN-026'; Nome='Astronomia - avançado' },
  @{ Codigo='EN-027'; Nome='Aves - avançado' },
  @{ Codigo='EN-029'; Nome='Flores - avançado' },
  @{ Codigo='EN-030'; Nome='Insetos - avançado' },
  @{ Codigo='EN-031'; Nome='Mamíferos - avançado' },
  @{ Codigo='EN-032'; Nome='Moluscos - avançado' },
  @{ Codigo='EN-033'; Nome='Árvores - avançado' },
  @{ Codigo='EN-035'; Nome='Areia' },
  @{ Codigo='EN-040'; Nome='Sementes' },
  @{ Codigo='EN-041'; Nome='Sementes - avançado' },
  @{ Codigo='EN-043'; Nome='Plantas silvestres comestíveis' },
  @{ Codigo='EN-047'; Nome='Geologia' },
  @{ Codigo='EN-049'; Nome='Plantas caseiras' },
  @{ Codigo='EN-050'; Nome='Rastreio de animais' },
  @{ Codigo='EN-051'; Nome='Mamíferos marinhos' },
  @{ Codigo='EN-052'; Nome='Pequenos mamíferos de estimação' },
  @{ Codigo='EN-055'; Nome='Felinos - avançado' },
  @{ Codigo='EN-056'; Nome='Rastreio de animais - avançado' },
  @{ Codigo='EN-057'; Nome='Répteis - avançado' },
  @{ Codigo='EN-059'; Nome='Morcegos' },
  @{ Codigo='EN-060'; Nome='Morcegos - avançado' },
  @{ Codigo='EN-062'; Nome='Orquídeas - avançado' },
  @{ Codigo='EN-063'; Nome='Palmeiras' },
  @{ Codigo='EN-064'; Nome='Solos' },
  @{ Codigo='EN-067'; Nome='Quedas d''água' },
  @{ Codigo='EN-072'; Nome='Arbustos - avançado' },
  @{ Codigo='EN-075'; Nome='Bactérias' },
  @{ Codigo='EN-083'; Nome='Fauna marinha' },
  @{ Codigo='EN-084'; Nome='Fisiologia vegetal' },
  @{ Codigo='EN-085'; Nome='Formigas' },
  @{ Codigo='EN-086'; Nome='Líquens' },
  @{ Codigo='EN-087'; Nome='Odonata' },
  @{ Codigo='EN-088'; Nome='Plantas carnívoras' },
  @{ Codigo='EN-089'; Nome='Preservação de recursos hídricos' },
  @{ Codigo='EN-090'; Nome='Poríferos e cnidários' },
  @{ Codigo='EN-091'; Nome='Protozoários' },
  @{ Codigo='EN-092'; Nome='Reciclagem e sustentabilidade' },
  @{ Codigo='EN-093'; Nome='Reciclagem e sustentabilidade - avançado' },
  @{ Codigo='EN-094'; Nome='Tubarões' },
  @{ Codigo='EN-098'; Nome='Aves de rapina' },
  @{ Codigo='EN-103'; Nome='Peixes ornamentais' },
  @{ Codigo='EN-104'; Nome='Primatas' },
  @{ Codigo='EN-105'; Nome='Quelônios' }
)

function Remove-Acentos([string]$s) {
  if (-not $s) { return '' }
  $n = $s.Normalize([Text.NormalizationForm]::FormD)
  $sb = New-Object Text.StringBuilder
  foreach ($c in $n.ToCharArray()) {
    if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($c) -ne [Globalization.UnicodeCategory]::NonSpacingMark) { [void]$sb.Append($c) }
  }
  return ($sb.ToString().ToLowerInvariant() -replace '[^a-z0-9]+', ' ').Trim()
}

function Chamar-Api([hashtable]$Parametros) {
  $q = ($Parametros.GetEnumerator() | ForEach-Object { '{0}={1}' -f $_.Key, [Uri]::EscapeDataString([string]$_.Value) }) -join '&'
  $url = "$Base/api.php?$q"
  for ($i = 1; $i -le $Tentativas; $i++) {
    try {
      $r = Invoke-RestMethod -Uri $url -Headers $UA -TimeoutSec 60
      if ($r -is [string] -and $r -match 'technical difficulties|Cannot access the database') { throw 'site com dificuldade tecnica' }
      Start-Sleep -Milliseconds $Pausa
      return $r
    } catch {
      $espera = [Math]::Min(60, 3 * [Math]::Pow(2, $i))
      Write-Host ("  tentativa {0}/{1} falhou ({2}); aguardando {3}s" -f $i, $Tentativas, $_.Exception.Message, $espera) -ForegroundColor Yellow
      Start-Sleep -Seconds $espera
    }
  }
  throw "A wiki nao respondeu apos $Tentativas tentativas. Tente de novo mais tarde."
}

# Converte wikitext em linhas "1. texto", "a) texto", "i) texto"
function Converter-Wikitext([string]$txt) {
  $linhas = New-Object System.Collections.Generic.List[string]
  $n = @(0, 0, 0)
  foreach ($l in ($txt -split "`n")) {
    $l = $l.TrimEnd("`r")
    if ($l -notmatch '^(#+|\*+)\s*(.*)$') { continue }
    $marca = $Matches[1]; $corpo = $Matches[2]
    $corpo = $corpo -replace "'''?", '' -replace '\[\[(?:[^\]|]*\|)?([^\]]*)\]\]', '$1' -replace '\{\{[^{}]*\}\}', '' -replace '<[^>]+>', '' -replace '\s+', ' '
    $corpo = $corpo.Trim()
    if (-not $corpo) { continue }
    $nivel = $marca.Length
    if ($nivel -gt 3) { $nivel = 3 }
    $n[$nivel - 1]++
    for ($k = $nivel; $k -lt 3; $k++) { $n[$k] = 0 }
    switch ($nivel) {
      1 { $linhas.Add(('{0}. {1}' -f $n[0], $corpo)) }
      2 { $linhas.Add(('{0}) {1}' -f ([char](96 + [Math]::Min($n[1], 26))), $corpo)) }
      3 { $linhas.Add(('{0}) {1}' -f (('i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x')[[Math]::Min($n[2], 10) - 1]), $corpo)) }
    }
  }
  return ,$linhas
}

# Titulo em portugues da pagina: DISPLAYTITLE, primeiro titulo de secao, ou o ultimo trecho do endereco
function Titulo-Pt([string]$pagina, [string]$txt) {
  if ($txt -match '(?i)\{\{\s*DISPLAYTITLE\s*:\s*([^}]+)\}\}') { return $Matches[1].Trim() }
  if ($txt -match '(?m)^=+\s*([^=\r\n]+?)\s*=+\s*$') { return $Matches[1].Trim() }
  $partes = $pagina -split '/'
  if ($partes.Count -ge 3) { return $partes[$partes.Count - 2] -replace '_', ' ' }
  return $pagina
}

if ($MyInvocation.InvocationName -eq '.') { return }   # permite carregar so as funcoes para teste

New-Item -ItemType Directory -Force -Path $Saida, (Join-Path $Saida 'bruto') | Out-Null

Write-Host '1/3 Listando paginas pt-br da wiki...' -ForegroundColor Cyan
$paginas = New-Object System.Collections.Generic.List[string]
$cont = $null
do {
  $p = @{ action = 'query'; list = 'allpages'; apprefix = 'AY_Honors/'; aplimit = '500'; format = 'json'; formatversion = '2' }
  if ($cont) { $p['apcontinue'] = $cont }
  $r = Chamar-Api $p
  foreach ($x in $r.query.allpages) { if ($x.title -like '*/pt-br') { $paginas.Add($x.title) } }
  $cont = if ($r.continue) { $r.continue.apcontinue } else { $null }
} while ($cont)
$paginas | Set-Content -Encoding UTF8 (Join-Path $Saida 'paginas_pt-br.txt')
Write-Host ("  {0} paginas pt-br" -f $paginas.Count)
if ($SoListar -or $paginas.Count -eq 0) { Write-Host 'Fim (lista salva).'; return }

Write-Host '2/3 Baixando o texto das paginas (50 por vez)...' -ForegroundColor Cyan
$texto = @{}
for ($i = 0; $i -lt $paginas.Count; $i += 50) {
  $lote = $paginas[$i..([Math]::Min($i + 49, $paginas.Count - 1))]
  $r = Chamar-Api @{ action = 'query'; prop = 'revisions'; rvprop = 'content'; rvslots = 'main'; titles = ($lote -join '|'); format = 'json'; formatversion = '2' }
  foreach ($pg in $r.query.pages) {
    if ($pg.missing -or -not $pg.revisions) { continue }
    $t = $pg.revisions[0].slots.main.content
    $texto[$pg.title] = $t
    $arq = ($pg.title -replace '[\\/:*?"<>|]', '_') + '.txt'
    [IO.File]::WriteAllText((Join-Path (Join-Path $Saida 'bruto') $arq), $t, (New-Object Text.UTF8Encoding($true)))
  }
  Write-Host ("  {0}/{1}" -f [Math]::Min($i + 50, $paginas.Count), $paginas.Count)
}

Write-Host '3/3 Procurando as especialidades pendentes...' -ForegroundColor Cyan
$indice = foreach ($k in $texto.Keys) {
  [pscustomobject]@{ Pagina = $k; Titulo = (Titulo-Pt $k $texto[$k]); Chave = (Remove-Acentos (Titulo-Pt $k $texto[$k])) }
}
$resultado = New-Object System.Collections.Generic.List[object]
foreach ($a in $Alvos) {
  $nome = Remove-Acentos $a.Nome
  # aceita "Especialidade de X", "Especialidades JA/X" e o proprio X; evita que "Aves" case com "Aves de rapina"
  $achados = @($indice | Where-Object { $_.Chave -eq $nome -or $_.Chave -eq "especialidade de $nome" -or $_.Chave -eq "especialidades ja $nome" -or $_.Chave -eq "especialidades $nome" })
  if (-not $achados.Count) { $achados = @($indice | Where-Object { $_.Chave -match "(^| )$([regex]::Escape($nome))$" }) }
  if ($achados.Count -eq 1) {
    $pg = $achados[0].Pagina
    $linhas = Converter-Wikitext $texto[$pg]
    $arq = '{0}_{1}.txt' -f $a.Codigo, ($a.Nome -replace '[^\p{L}\p{N}]+', '_')
    $linhas | Set-Content -Encoding UTF8 (Join-Path $Saida $arq)
    $qtd = @($linhas | Where-Object { $_ -match '^\d+\.' }).Count
    $resultado.Add([pscustomobject]@{ Codigo = $a.Codigo; Nome = $a.Nome; Achou = 'sim'; TituloWiki = $achados[0].Titulo; Pagina = $pg; Url = "$Base/w/$($pg -replace ' ', '_')"; Requisitos = $qtd; Linhas = $linhas.Count; Arquivo = $arq })
  } else {
    $motivo = if ($achados.Count -gt 1) { 'varias paginas (' + (($achados | ForEach-Object { $_.Pagina }) -join ' ; ') + ')' } else { 'nao encontrada' }
    $resultado.Add([pscustomobject]@{ Codigo = $a.Codigo; Nome = $a.Nome; Achou = $motivo; TituloWiki = ''; Pagina = ''; Url = ''; Requisitos = 0; Linhas = 0; Arquivo = '' })
  }
}
$resultado | Export-Csv -NoTypeInformation -Encoding UTF8 -Path (Join-Path $Saida 'resultado.csv')
$sim = @($resultado | Where-Object { $_.Achou -eq 'sim' }).Count
Write-Host ''
Write-Host ("Concluido: {0} de {1} especialidades encontradas." -f $sim, $resultado.Count) -ForegroundColor Green
Write-Host ("Veja {0}" -f (Join-Path $Saida 'resultado.csv'))
$resultado | Where-Object { $_.Achou -ne 'sim' } | ForEach-Object { Write-Host ("  - {0} {1}: {2}" -f $_.Codigo, $_.Nome, $_.Achou) -ForegroundColor Yellow }
