// Gera o seed SQL do catalogo para Pesquisador, Pioneiro, Excursionista, Guia
// (regular + avancada) e Lider/Lider Master a partir de scripts/classes-dados-extra.mjs.
// Uso: node scripts/gerar-seed-classes-extra.mjs
import { writeFileSync } from 'node:fs';
import { formatoPeloTexto } from './classes-ajustes.mjs';
import { CLASSES_EXTRA, CLASSES_LIDERANCA } from './classes-dados-extra.mjs';

function q(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

const linhas = [];

function processarClasse(classeDef, idadeMinima) {
  let secaoOrdem = 0;
  let ordemGlobal = 0;
  const grupoUsados = new Set();

  for (const secao of classeDef.secoes) {
    secaoOrdem += 1;
    const avancada = /classe\s+avan/i.test(secao.nome);

    for (const item of secao.itens) {
      ordemGlobal += 1;
      const tipo = item.tipo ?? 'Requisito';
      const temEscolha = !!item.grupoEscolha;
      const chaveGrupo = temEscolha ? `${classeDef.classe}::${secao.nome}::${item.codigo}` : null;

      linhas.push({
        classe: classeDef.classe, secao: secao.nome, secaoOrdem, ordem: ordemGlobal,
        codigo: item.codigo, codigoRaiz: item.codigo, subitem: null,
        texto: item.texto, tipo, pagina: null,
        especialidadeNome: item.especialidadeNome ?? null,
        avancada, pontua: true,
        formato: item.especialidadeNome ? 'nenhum' : formatoPeloTexto(item.texto),
        maxArquivos: 3, idadeMinima: null, chaveCompartilhada: null,
        grupoEscolha: null, escolhasNecessarias: null, rotulo: null, documentoCampo: null,
      });

      for (const sub of item.subitens ?? []) {
        ordemGlobal += 1;
        const ehEspecialidade = !!sub.especialidadeNome;
        linhas.push({
          classe: classeDef.classe, secao: secao.nome, secaoOrdem, ordem: ordemGlobal,
          codigo: item.codigo, codigoRaiz: item.codigo, subitem: sub.sub,
          texto: sub.texto, tipo: ehEspecialidade ? 'Especialidade' : (temEscolha ? 'Opção' : 'Atividade'),
          pagina: null,
          especialidadeNome: sub.especialidadeNome ?? null,
          avancada,
          // Subitens nunca pontuam sozinhos: opções de escolha só contam via o
          // item-raiz, e linhas de especialidade concluem o raiz pelo gatilho
          // de sincronização (mesmo padrão usado em Amigo/Companheiro).
          pontua: false,
          formato: ehEspecialidade ? 'nenhum' : formatoPeloTexto(sub.texto),
          maxArquivos: 3, idadeMinima: null, chaveCompartilhada: null,
          grupoEscolha: temEscolha ? chaveGrupo : null,
          escolhasNecessarias: temEscolha ? item.grupoEscolha.necessarias : null,
          rotulo: null, documentoCampo: null,
        });
      }
    }
  }

  // Requisito "1. Ter no mínimo X anos" quando existir na seção Gerais recebe
  // idade mínima + chave compartilhada, no mesmo padrão de Amigo/Companheiro.
  if (idadeMinima) {
    const raiz = linhas.find(
      (l) => l.classe === classeDef.classe && /ter,?\s+no\s+m[íi]nimo,?\s+\d+\s+anos/i.test(l.texto) && !l.subitem
    );
    if (raiz) {
      raiz.formato = 'upload';
      raiz.idadeMinima = idadeMinima;
      raiz.chaveCompartilhada = 'documento_identidade';
      raiz.documentoCampo = 'rg';
      raiz.rotulo = 'Documento de identidade';
      raiz.maxArquivos = 2;
    }
  }
}

for (const classeDef of CLASSES_EXTRA) processarClasse(classeDef, classeDef.idadeMinima);
for (const classeDef of CLASSES_LIDERANCA) processarClasse(classeDef, null);

const classes = [...new Set(linhas.map((l) => l.classe))];

const valores = linhas
  .map((l) =>
    `  (${q(l.classe)}, ${q(l.secao)}, ${l.secaoOrdem}, ${l.ordem}, ${q(l.codigo)}, ${q(l.codigoRaiz)}, ${q(l.subitem)}, ` +
    `${q(l.texto)}, ${q(l.tipo)}, NULL, ${q(l.especialidadeNome)}, ${l.avancada}, ${l.pontua}, ` +
    `${q(l.formato)}, ${l.maxArquivos}, ${l.idadeMinima ?? 'NULL'}, ${q(l.chaveCompartilhada)}, ` +
    `${q(l.grupoEscolha)}, ${l.escolhasNecessarias ?? 'NULL'}, ${q(l.rotulo)}, ${q(l.documentoCampo)})`
  )
  .join(',\n');

const sql = `-- Catalogo de Pesquisador, Pioneiro, Excursionista, Guia (regular + avancada) e
-- Lider/Lider Master. Gerado por scripts/gerar-seed-classes-extra.mjs a partir de
-- scripts/classes-dados-extra.mjs. Idempotente (upsert), mesmo padrao do seed 062.
-- Classes: ${classes.join(', ')}. Total de linhas: ${linhas.length}.

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

writeFileSync('supabase/migrations/065_seed_classes_pesquisador_a_lider.sql', sql, 'utf8');
console.log(`OK: ${linhas.length} linhas (${classes.join(', ')})`);
const porClasse = {};
linhas.forEach((l) => { porClasse[l.classe] = (porClasse[l.classe] ?? 0) + 1; });
console.log('Por classe:', JSON.stringify(porClasse, null, 1));
console.log('Raizes pontuaveis:', linhas.filter((l) => l.pontua).length);
console.log('Com idade minima (identidade):', linhas.filter((l) => l.idadeMinima).length);
