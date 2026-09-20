#!/usr/bin/env node
/**
 * Guarda de paginação: falha (exit 1) se alguém ler uma tabela que cresce sem
 * limite usando `supabase.from(...).select(...)` direto, sem paginar.
 *
 * Por que isso existe: o PostgREST devolve no máximo 1000 linhas por
 * requisição, SEM erro e SEM aviso — quem lê acha que recebeu tudo. Foi
 * exatamente assim que o ranking passou a mostrar menos pontos que o extrato
 * do próprio membro: ele varria o clube inteiro num select simples, o clube
 * passou de mil lançamentos e a soma ficou parcial, em silêncio.
 *
 * A correção não pode depender de lembrar: toda leitura dessas tabelas tem
 * que passar por `buscarPaginado` (src/lib/supabasePaginado.ts) ou declarar
 * explicitamente que quer poucas linhas (.single/.maybeSingle/.limit/.range).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const ALVOS = ['app', 'src'];

/**
 * Tabelas que crescem sem teto: acumulam uma linha por membro POR lançamento,
 * por requisito, por dia. Passar de mil é questão de tempo — ler sem paginar
 * aqui é bug garantido, então falha o build.
 */
const TABELAS_QUE_CRESCEM = [
  'pontuacoes',
  'pontuacoes_custom',
  'pontuacoes_extras_itens',
  'pontuacoes_unidades',
  'progresso_classes',
  'classes_requisitos_progresso',
  'especialidades',
  'atividades_respostas',
  'ano_biblico_progresso',
  'auditoria_eventos',
];

/**
 * Tabelas limitadas pelo tamanho do clube (uma linha por pessoa): só passam de
 * mil num clube gigante ou numa visão regional somando clubes. Risco menor, e
 * corrigir tudo de uma vez daria muito ruído — então aqui é aviso, não erro.
 */
const TABELAS_LIMITADAS_POR_CLUBE = ['desbravadores'];

/** Se o trecho da consulta tiver um destes, o autor já limitou de propósito. */
const MARCAS_DE_LIMITE_EXPLICITO = [
  '.range(',
  '.single(',
  '.maybeSingle(',
  '.limit(',
  'count:',
  'head:',
];

/** Arquivos que podem usar select direto (o próprio helper e afins). */
const ISENTOS = [
  'src/lib/supabasePaginado.ts',
];

function listarArquivos(dir) {
  let resultado = [];
  let entradas;
  try {
    entradas = readdirSync(dir);
  } catch {
    return resultado;
  }
  for (const nome of entradas) {
    if (nome === 'node_modules' || nome === '__tests__') continue;
    const caminho = join(dir, nome);
    const info = statSync(caminho);
    if (info.isDirectory()) resultado = resultado.concat(listarArquivos(caminho));
    else if (/\.(ts|tsx)$/.test(nome)) resultado.push(caminho);
  }
  return resultado;
}

/**
 * Devolve o trecho da cadeia de chamadas que começa num `.from('x')` — até o
 * `;` que fecha o statement, ou até a próxima chamada `.from(`, o que vier
 * primeiro. É o suficiente pra ver se a consulta paginou ou limitou.
 */
function trechoDaConsulta(conteudo, inicio) {
  const restante = conteudo.slice(inicio);
  const fimPontoVirgula = restante.indexOf(';');
  const proximoFrom = restante.indexOf('.from(', 6);
  const candidatos = [fimPontoVirgula, proximoFrom].filter((i) => i > 0);
  const fim = candidatos.length ? Math.min(...candidatos) : Math.min(restante.length, 800);
  return restante.slice(0, fim);
}

const falhas = [];
const avisos = [];
let totalArquivos = 0;

for (const alvo of ALVOS) {
  for (const caminho of listarArquivos(join(ROOT, alvo))) {
    const relativo = relative(ROOT, caminho).replace(/\\/g, '/');
    if (ISENTOS.includes(relativo)) continue;
    totalArquivos++;
    const conteudo = readFileSync(caminho, 'utf8');

    const verificar = (tabela, destino) => {
      const alvoFrom = `.from('${tabela}')`;
      let idx = conteudo.indexOf(alvoFrom);
      while (idx !== -1) {
        const trecho = trechoDaConsulta(conteudo, idx);
        const posSelect = trecho.indexOf('.select(');
        // `.update(...).select()` devolve só as linhas alteradas — é escrita,
        // não varredura, então não precisa paginar.
        const ehEscrita = ['.update(', '.insert(', '.delete(', '.upsert(']
          .some((op) => {
            const pos = trecho.indexOf(op);
            return pos !== -1 && (posSelect === -1 || pos < posSelect);
          });
        const ehLeitura = posSelect !== -1 && !ehEscrita;
        const temLimite = MARCAS_DE_LIMITE_EXPLICITO.some((m) => trecho.includes(m));
        if (ehLeitura && !temLimite) {
          const linha = conteudo.slice(0, idx).split('\n').length;
          destino.push({ arquivo: relativo, linha, tabela });
        }
        idx = conteudo.indexOf(alvoFrom, idx + alvoFrom.length);
      }
    };

    for (const tabela of TABELAS_QUE_CRESCEM) verificar(tabela, falhas);
    for (const tabela of TABELAS_LIMITADAS_POR_CLUBE) verificar(tabela, avisos);
  }
}

if (avisos.length) {
  console.warn(`AVISO: ${avisos.length} leitura(s) sem paginação em tabela limitada pelo tamanho do clube (${TABELAS_LIMITADAS_POR_CLUBE.join(', ')}).`);
  console.warn('       Só vira problema num clube com mais de mil pessoas ou numa visão que some vários clubes.\n');
}

if (falhas.length) {
  console.error(`FALHA: ${falhas.length} consulta(s) sem paginação em tabela que cresce.\n`);
  for (const f of falhas) {
    console.error(`  ${f.arquivo}:${f.linha}  →  .from('${f.tabela}').select(...) sem paginar`);
  }
  console.error(`
O PostgREST corta em 1000 linhas sem avisar, então esse select devolve um
resultado PARCIAL assim que a tabela crescer — e ninguém percebe, porque não
dá erro: os totais só ficam menores que a realidade.

Corrija de uma destas formas:
  1. Use buscarPaginado() de src/lib/supabasePaginado.ts (preferido para
     qualquer leitura que varra o clube inteiro):
       const linhas = await buscarPaginado((q) => q.eq('clube_id', clubeId), 'pontuacoes', '*');
  2. Se a consulta REALMENTE devolve poucas linhas, torne isso explícito com
     .single(), .maybeSingle(), .limit(n) ou .range(a, b).
`);
  process.exit(1);
}

console.log(`OK: ${totalArquivos} arquivo(s) verificados, nenhuma leitura sem paginação nas ${TABELAS_QUE_CRESCEM.length} tabelas que crescem sem teto.`);
