// Gera o seed SQL do catalogo de requisitos das classes a partir dos checklists XLSX.
// Uso: node scripts/gerar-seed-classes.mjs <arquivo1.xlsx> <arquivo2.xlsx> ...
import XLSX from 'xlsx';
import { writeFileSync } from 'node:fs';

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
    // Ignora frases genericas ("uma area", "Artes e habilidades manuais")
    if (nome && nome.length <= 60 && !/^uma\b/i.test(nome)) return nome;
  }
  return null;
}

const arquivos = process.argv.slice(2);
if (arquivos.length === 0) {
  console.error('Informe ao menos um arquivo .xlsx');
  process.exit(1);
}

const linhas = [];

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
    const texto = String(r[iTexto] ?? '').trim();
    const codigo = String(r[iReq] ?? '').trim();
    if (!texto || !codigo) continue;

    const secao = String(r[iSecao] ?? '').trim() || 'Geral';
    if (!ordemSecao.has(secao)) ordemSecao.set(secao, ordemSecao.size + 1);

    const tipo = String(r[iTipo] ?? '').trim() || 'Requisito';
    const subitem = iSub >= 0 ? String(r[iSub] ?? '').trim() : '';
    // "2.1" e filho de "2"; letras a/b/c na coluna Subitem tambem sao filhos.
    const codigoRaiz = codigo.split('.')[0].trim() || codigo;
    const ehRaiz = !subitem && codigo === codigoRaiz;
    ordem += 1;

    linhas.push({
      classe: tituloClasse(r[iClasse]),
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
    });
  }
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
    `${q(l.texto)}, ${q(l.tipo)}, ${num(l.pagina)}, ${q(l.especialidade)}, ${l.avancada}, ${l.pontua})`
  )
  .join(',\n');

const sql = `-- Catalogo oficial de requisitos das classes (gerado por scripts/gerar-seed-classes.mjs).
-- Classes incluidas: ${classes.join(', ')}. Total de linhas: ${unicas.length}.

DELETE FROM public.classes_requisitos_catalogo
WHERE classe_nome IN (${classes.map(q).join(', ')});

INSERT INTO public.classes_requisitos_catalogo
  (classe_nome, secao, secao_ordem, ordem, codigo, codigo_raiz, subitem, texto, tipo, pagina, especialidade_nome, avancada, pontua)
VALUES
${valores};
`;

writeFileSync(process.env.SAIDA || 'supabase/migrations/060_seed_classes_requisitos.sql', sql, 'utf8');
console.log(`OK: ${unicas.length} requisitos (${classes.join(', ')})`);
console.log('Pontuaveis:', unicas.filter((l) => l.pontua).length);
console.log('Com especialidade:', unicas.filter((l) => l.especialidade).length);
console.log('Especialidades distintas:', [...new Set(unicas.filter((l) => l.especialidade).map((l) => l.especialidade))].join(' | '));
