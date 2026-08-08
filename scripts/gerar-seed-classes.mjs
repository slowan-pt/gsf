// Gera o seed SQL do catalogo de requisitos das classes a partir dos checklists XLSX,
// aplicando os ajustes editoriais de scripts/classes-ajustes.mjs.
// Uso: node scripts/gerar-seed-classes.mjs <arquivo1.xlsx> <arquivo2.xlsx> ...
import XLSX from 'xlsx';
import { writeFileSync } from 'node:fs';
import { AJUSTES, NOVOS, TIPOS_REMOVIDOS, formatoPeloTexto } from './classes-ajustes.mjs';

const TIPOS_SEM_PONTUACAO = new Set(['Texto de referência', 'Conteúdo', 'Formulário']);

function q(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && String(v).trim() !== '' ? String(n) : 'NULL';
}

function tituloClasse(bruto) {
  const s = String(bruto || '').trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Deduz a especialidade referenciada por uma linha do checklist. */
function especialidadeDe(tipo, subitem, texto) {
  const sub = String(subitem || '').trim();
  if (tipo === 'Especialidade' && sub && !/^\d+$/.test(sub)) return sub;
  const m = String(texto || '').match(/especialidade\s+de\s+([^.;]+)/i);
  if (m) {
    const nome = m[1].trim().replace(/\s+/g, ' ');
    if (nome && nome.length <= 60 && !/^uma\b/i.test(nome)) return nome;
  }
  return null;
}

/** Procura o ajuste cuja seção casa pelo início do nome. */
function acharAjuste(classe, secao, codigo, subitem) {
  const sufixo = `::${codigo}::${subitem ?? ''}`;
  for (const [chave, patch] of Object.entries(AJUSTES)) {
    if (!chave.endsWith(sufixo)) continue;
    const [c, prefixoSecao] = chave.split('::');
    if (c === classe && secao.startsWith(prefixoSecao)) return patch;
  }
  return null;
}

const arquivos = process.argv.slice(2);
if (arquivos.length === 0) {
  console.error('Informe ao menos um arquivo .xlsx');
  process.exit(1);
}

const linhas = [];
let removidas = 0;

for (const arquivo of arquivos) {
  const wb = XLSX.readFile(arquivo);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
  const hdr = rows[0].map((h) => String(h).trim());
  // Os dois checklists usam nomes de coluna levemente diferentes.
  const col = (...nomes) => {
    for (const n of nomes) {
      const i = hdr.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const iClasse = col('Classe');
  const iPagina = col('Página');
  const iSecao = col('Seção');
  const iReq = col('Requisito', 'Item');
  const iSub = col('Subitem');
  const iTexto = col('Texto impresso', 'Texto impresso / requisito');
  const iTipo = col('Tipo');
  if ([iClasse, iSecao, iReq, iTexto].some((i) => i < 0)) {
    throw new Error(`Colunas obrigatorias ausentes em ${arquivo}: ${hdr.join(', ')}`);
  }

  const ordemSecao = new Map();
  let ordem = 0;

  for (const r of rows.slice(1)) {
    let texto = String(r[iTexto] ?? '').trim();
    const codigo = String(r[iReq] ?? '').trim();
    if (!texto || !codigo) continue;

    const tipo = String(r[iTipo] ?? '').trim() || 'Requisito';
    // Os itens internos de uma especialidade nao aparecem na classe.
    if (TIPOS_REMOVIDOS.has(tipo)) { removidas += 1; continue; }

    const secao = String(r[iSecao] ?? '').trim() || 'Geral';
    if (!ordemSecao.has(secao)) ordemSecao.set(secao, ordemSecao.size + 1);

    const classe = tituloClasse(r[iClasse]);
    const subitem = iSub >= 0 ? String(r[iSub] ?? '').trim() : '';
    const ajuste = acharAjuste(classe, secao, codigo, subitem) ?? {};
    if (ajuste.remover) { removidas += 1; continue; }
    if (ajuste.texto) texto = ajuste.texto;

    // "2.1" e filho de "2"; letras a/b/c na coluna Subitem tambem sao filhos.
    const codigoRaiz = codigo.split('.')[0].trim() || codigo;
    const ehRaiz = !subitem && codigo === codigoRaiz;
    ordem += 1;

    linhas.push({
      classe,
      secao,
      secaoOrdem: ordemSecao.get(secao),
      ordem,
      codigo,
      codigoRaiz,
      subitem: subitem || null,
      texto,
      tipo,
      pagina: iPagina >= 0 ? r[iPagina] : '',
      especialidade: especialidadeDe(tipo, subitem, texto),
      avancada: /classe\s+avan/i.test(secao),
      pontua: ehRaiz && !TIPOS_SEM_PONTUACAO.has(tipo),
      formato: ajuste.formato ?? formatoPeloTexto(texto),
      maxArquivos: ajuste.maxArquivos ?? 3,
      idadeMinima: ajuste.idadeMinima ?? null,
      chaveCompartilhada: ajuste.chaveCompartilhada ?? null,
      grupoEscolha: ajuste.grupoEscolha ?? null,
      escolhasNecessarias: ajuste.escolhasNecessarias ?? null,
      rotulo: ajuste.rotulo ?? null,
      documentoCampo: ajuste.documentoCampo ?? null,
      chaveAncora: `${classe}::${secao}::${codigo}::${subitem}`,
    });
  }
}

// Insere as linhas novas logo apos a linha-ancora, mantendo a ordem do grupo.
let inseridas = 0;
const gruposNovos = new Map();
for (const novo of NOVOS) {
  if (!gruposNovos.has(novo.depoisDe)) gruposNovos.set(novo.depoisDe, []);
  gruposNovos.get(novo.depoisDe).push(novo);
}

for (const [ancora, grupo] of gruposNovos) {
  const [c, prefixoSecao, codigoAnc, subAnc] = ancora.split('::');
  const idx = linhas.findLastIndex(
    (l) =>
      l.classe === c &&
      l.secao.startsWith(prefixoSecao) &&
      l.codigo === codigoAnc &&
      (l.subitem ?? '') === (subAnc ?? '')
  );
  if (idx < 0) {
    console.warn(`AVISO: ancora nao encontrada para ${ancora}`);
    continue;
  }
  const base = linhas[idx];
  const novasLinhas = grupo.map((novo) => ({
    ...base,
    codigo: novo.codigo,
    codigoRaiz: novo.codigo.split('.')[0],
    subitem: novo.subitem,
    texto: novo.texto,
    tipo: novo.tipo,
    especialidade: null,
    pontua: false,
    formato: novo.formato ?? 'nenhum',
    maxArquivos: novo.maxArquivos ?? 3,
    idadeMinima: null,
    chaveCompartilhada: null,
    grupoEscolha: null,
    escolhasNecessarias: null,
    rotulo: novo.rotulo ?? null,
    documentoCampo: null,
  }));
  linhas.splice(idx + 1, 0, ...novasLinhas);
  inseridas += novasLinhas.length;
}

// Reordena para manter a sequencia visual apos as insercoes.
const contadorPorClasse = new Map();
for (const l of linhas) {
  const n = (contadorPorClasse.get(l.classe) ?? 0) + 1;
  contadorPorClasse.set(l.classe, n);
  l.ordem = n;
}

// Remove duplicatas na chave unica (classe, secao, codigo, subitem)
const vistos = new Set();
const unicas = linhas.filter((l) => {
  const chave = `${l.classe}|${l.secao}|${l.codigo}|${l.subitem ?? ''}`;
  if (vistos.has(chave)) return false;
  vistos.add(chave);
  return true;
});

const classes = [...new Set(unicas.map((l) => l.classe))];

const valores = unicas
  .map((l) =>
    `  (${q(l.classe)}, ${q(l.secao)}, ${l.secaoOrdem}, ${l.ordem}, ${q(l.codigo)}, ${q(l.codigoRaiz)}, ${q(l.subitem)}, ` +
    `${q(l.texto)}, ${q(l.tipo)}, ${num(l.pagina)}, ${q(l.especialidade)}, ${l.avancada}, ${l.pontua}, ` +
    `${q(l.formato)}, ${l.maxArquivos}, ${l.idadeMinima ?? 'NULL'}, ${q(l.chaveCompartilhada)}, ` +
    `${q(l.grupoEscolha)}, ${l.escolhasNecessarias ?? 'NULL'}, ${q(l.rotulo)}, ${q(l.documentoCampo)})`
  )
  .join(',\n');

const sql = `-- Catalogo oficial de requisitos das classes (gerado por scripts/gerar-seed-classes.mjs).
-- Classes incluidas: ${classes.join(', ')}. Total de linhas: ${unicas.length}.
-- Regenerar com: node scripts/gerar-seed-classes.mjs <checklists .xlsx>
--
-- Idempotente: faz UPSERT pela chave (classe, secao, codigo, subitem) preservando os
-- ids e, com eles, todo o progresso/respostas/anexos ja registrados dos membros.
-- Linhas que sairam da versao nova ficam apenas inativas, nunca sao apagadas.

UPDATE public.classes_requisitos_catalogo
SET ativo = FALSE
WHERE classe_nome IN (${classes.map(q).join(', ')});

INSERT INTO public.classes_requisitos_catalogo
  (classe_nome, secao, secao_ordem, ordem, codigo, codigo_raiz, subitem, texto, tipo, pagina,
   especialidade_nome, avancada, pontua, formato_resposta, max_arquivos, idade_minima,
   chave_compartilhada, grupo_escolha, escolhas_necessarias, rotulo, documento_campo)
VALUES
${valores}
ON CONFLICT (classe_nome, secao, codigo, COALESCE(subitem, '')) DO UPDATE SET
  secao_ordem = EXCLUDED.secao_ordem,
  ordem = EXCLUDED.ordem,
  codigo_raiz = EXCLUDED.codigo_raiz,
  texto = EXCLUDED.texto,
  tipo = EXCLUDED.tipo,
  pagina = EXCLUDED.pagina,
  especialidade_nome = EXCLUDED.especialidade_nome,
  avancada = EXCLUDED.avancada,
  pontua = EXCLUDED.pontua,
  formato_resposta = EXCLUDED.formato_resposta,
  max_arquivos = EXCLUDED.max_arquivos,
  idade_minima = EXCLUDED.idade_minima,
  chave_compartilhada = EXCLUDED.chave_compartilhada,
  grupo_escolha = EXCLUDED.grupo_escolha,
  escolhas_necessarias = EXCLUDED.escolhas_necessarias,
  rotulo = EXCLUDED.rotulo,
  documento_campo = EXCLUDED.documento_campo,
  ativo = TRUE,
  updated_at = now();
`;

writeFileSync(process.env.SAIDA || 'supabase/migrations/062_seed_classes_requisitos_v2.sql', sql, 'utf8');
console.log(`OK: ${unicas.length} requisitos (${classes.join(', ')})`);
console.log('Pontuaveis:', unicas.filter((l) => l.pontua).length);
console.log('Removidas (subitens de especialidade + ajustes):', removidas);
console.log('Novas linhas inseridas:', inseridas);
const porFormato = {};
unicas.forEach((l) => { porFormato[l.formato] = (porFormato[l.formato] ?? 0) + 1; });
console.log('Formatos:', JSON.stringify(porFormato));
console.log('Com especialidade:', unicas.filter((l) => l.especialidade).length);
