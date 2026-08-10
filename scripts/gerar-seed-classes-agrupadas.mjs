// Gera o seed SQL do catalogo "Classes agrupadas" a partir de
// scripts/classes-dados-agrupadas.mjs. Uso: node scripts/gerar-seed-classes-agrupadas.mjs
import { writeFileSync } from 'node:fs';
import { formatoPeloTexto } from './classes-ajustes.mjs';
import { AGRUPADAS_SECOES, AGRUPADAS_AVANCADAS } from './classes-dados-agrupadas.mjs';

const CLASSE = 'Classes agrupadas';

function q(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** '11-12-13-14-15+' -> { min: 11, max: null }; '13-14-15+' -> { min: 13, max: null }; '11-12' -> { min: 11, max: 12 } */
function faixaIdade(tag) {
  const partes = tag.split('-');
  const numeros = partes.map((p) => parseInt(p, 10));
  const temAberto = partes.some((p) => p.includes('+'));
  return { min: Math.min(...numeros), max: temAberto ? null : Math.max(...numeros) };
}

const linhas = [];
let ordemGlobal = 0;

// Cada bloco de "classes avançadas" das agrupadas (Amigo da Natureza, Companheiro
// de Excursionismo...) é uma unidade própria, não uma única "avançada" combinada
// -- por isso ganha classe_nome distinto em vez de reusar avancada=true genérico.
function processarItens(itens, classeNome, secaoNome, secaoOrdem, avancada, tagFixa) {
  for (const item of itens) {
    ordemGlobal += 1;
    const { min, max } = faixaIdade(tagFixa ?? item.tag);
    const temEscolha = !!item.grupoEscolha;
    const chaveGrupo = temEscolha ? `${classeNome}::${secaoNome}::${item.codigo}` : null;

    linhas.push({
      classe: classeNome, secao: secaoNome, secaoOrdem, ordem: ordemGlobal, codigo: item.codigo, codigoRaiz: item.codigo,
      subitem: null, texto: item.texto, tipo: item.tipo ?? 'Requisito',
      especialidadeNome: item.especialidadeNome ?? null, avancada, pontua: true,
      formato: item.especialidadeNome ? 'nenhum' : formatoPeloTexto(item.texto),
      idadeMin: min, idadeMax: max, grupoEscolha: null, escolhasNecessarias: null,
    });

    for (const sub of item.subitens ?? []) {
      ordemGlobal += 1;
      const ehEspecialidade = !!sub.especialidadeNome;
      linhas.push({
        classe: classeNome, secao: secaoNome, secaoOrdem, ordem: ordemGlobal, codigo: item.codigo, codigoRaiz: item.codigo,
        subitem: sub.sub, texto: sub.texto, tipo: ehEspecialidade ? 'Especialidade' : (temEscolha ? 'Opção' : 'Atividade'),
        especialidadeNome: sub.especialidadeNome ?? null, avancada, pontua: false,
        formato: ehEspecialidade ? 'nenhum' : formatoPeloTexto(sub.texto),
        idadeMin: min, idadeMax: max,
        grupoEscolha: temEscolha ? chaveGrupo : null,
        escolhasNecessarias: temEscolha ? item.grupoEscolha.necessarias : null,
      });
    }
  }
}

AGRUPADAS_SECOES.forEach((secao, i) => processarItens(secao.itens, CLASSE, secao.nome, i + 1, false, null));
AGRUPADAS_AVANCADAS.forEach((bloco, i) =>
  processarItens(bloco.itens, `${CLASSE} — ${bloco.nome.replace(/^[IVX]+\.\s*/, '')}`, bloco.nome, i + 1, false, bloco.tag)
);

const classesEnvolvidas = [...new Set(linhas.map((l) => l.classe))];

const valores = linhas
  .map((l) =>
    `  (${q(l.classe)}, ${q(l.secao)}, ${l.secaoOrdem}, ${l.ordem}, ${q(l.codigo)}, ${q(l.codigoRaiz)}, ${q(l.subitem)}, ` +
    `${q(l.texto)}, ${q(l.tipo)}, NULL, ${q(l.especialidadeNome)}, ${l.avancada}, ${l.pontua}, ` +
    `${q(l.formato)}, 3, NULL, NULL, ${q(l.grupoEscolha)}, ${l.escolhasNecessarias ?? 'NULL'}, NULL, NULL, ` +
    `${l.idadeMin}, ${l.idadeMax ?? 'NULL'})`
  )
  .join(',\n');

const sql = `-- Catalogo "Classes agrupadas" -- cada requisito vale so para a faixa de idade
-- indicada (idade_agrupada_min/max). Gerado por scripts/gerar-seed-classes-agrupadas.mjs
-- a partir de scripts/classes-dados-agrupadas.mjs. Total de linhas: ${linhas.length}.
--
-- Este cartao NAO entra no fluxo de "Receber"/investidura (orientacao oficial:
-- nao substitui os cartoes de classe regulares) -- ver ajuste no gatilho abaixo.

ALTER TABLE public.classes_requisitos_catalogo
  ADD COLUMN IF NOT EXISTS idade_agrupada_min INTEGER,
  ADD COLUMN IF NOT EXISTS idade_agrupada_max INTEGER;

UPDATE public.classes_requisitos_catalogo
SET ativo = FALSE
WHERE classe_nome IN (${classesEnvolvidas.map(q).join(', ')});

INSERT INTO public.classes_requisitos_catalogo
  (classe_nome, secao, secao_ordem, ordem, codigo, codigo_raiz, subitem, texto, tipo, pagina,
   especialidade_nome, avancada, pontua, formato_resposta, max_arquivos, idade_minima,
   chave_compartilhada, grupo_escolha, escolhas_necessarias, rotulo, documento_campo,
   idade_agrupada_min, idade_agrupada_max)
VALUES
${valores}
ON CONFLICT (classe_nome, secao, codigo, COALESCE(subitem, '')) DO UPDATE SET
  secao_ordem = EXCLUDED.secao_ordem,
  ordem = EXCLUDED.ordem,
  codigo_raiz = EXCLUDED.codigo_raiz,
  texto = EXCLUDED.texto,
  tipo = EXCLUDED.tipo,
  especialidade_nome = EXCLUDED.especialidade_nome,
  avancada = EXCLUDED.avancada,
  pontua = EXCLUDED.pontua,
  formato_resposta = EXCLUDED.formato_resposta,
  grupo_escolha = EXCLUDED.grupo_escolha,
  escolhas_necessarias = EXCLUDED.escolhas_necessarias,
  idade_agrupada_min = EXCLUDED.idade_agrupada_min,
  idade_agrupada_max = EXCLUDED.idade_agrupada_max,
  ativo = TRUE,
  updated_at = now();

-- "Classes agrupadas" nunca gera entrada automatica em Receber (nao substitui
-- os cartoes oficiais). Ajusta o nucleo para ignorar essa classe.
CREATE OR REPLACE FUNCTION public.recalcular_classe_receber(
  p_clube_id INTEGER, p_dbv_id INTEGER, p_classe_nome TEXT, p_avancada BOOLEAN, p_item_nome TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
  v_feitos INTEGER;
  v_atividade_id BIGINT;
  v_dbv_nome TEXT;
  v_ja_entregue BOOLEAN;
BEGIN
  IF p_classe_nome IS NULL OR p_classe_nome LIKE 'Classes agrupadas%' THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_total
  FROM public.classes_requisitos_catalogo c
  WHERE c.ativo = TRUE AND c.pontua = TRUE AND c.classe_nome = p_classe_nome AND c.avancada = p_avancada;

  IF v_total = 0 THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_feitos
  FROM public.classes_requisitos_progresso pr
  JOIN public.classes_requisitos_catalogo c ON c.id = pr.requisito_id
  WHERE pr.dbv_id = p_dbv_id
    AND pr.concluido = TRUE
    AND c.ativo = TRUE AND c.pontua = TRUE AND c.classe_nome = p_classe_nome AND c.avancada = p_avancada;

  SELECT entregue INTO v_ja_entregue
  FROM public.investidura_itens
  WHERE clube_id = p_clube_id AND dbv_id = p_dbv_id AND tipo = 'classe' AND item_nome = p_item_nome;
  IF v_ja_entregue THEN
    RETURN;
  END IF;

  SELECT nome INTO v_dbv_nome FROM public.desbravadores WHERE id = p_dbv_id;

  IF v_feitos >= v_total THEN
    SELECT id INTO v_atividade_id FROM public.atividades
     WHERE clube_id = p_clube_id AND dbv_id = p_dbv_id AND item_formativo_tipo = 'classe'
       AND item_formativo_nome = p_item_nome AND criado_por = '__sistema_classes__';

    IF v_atividade_id IS NULL THEN
      INSERT INTO public.atividades
        (clube_id, titulo, descricao, destino, dbv_id, dbv_nome, criado_por,
         item_formativo_tipo, item_formativo_nome, gera_investidura)
      VALUES (
        p_clube_id, 'Classe ' || p_item_nome || ' completa',
        'Todos os requisitos da classe foram concluidos.', 'desbravador',
        p_dbv_id, v_dbv_nome, '__sistema_classes__', 'classe', p_item_nome, TRUE
      )
      RETURNING id INTO v_atividade_id;

      INSERT INTO public.atividades_alvos (clube_id, atividade_id, tipo, membro_id)
      VALUES (p_clube_id, v_atividade_id, 'membro', p_dbv_id);
    END IF;

    INSERT INTO public.atividades_respostas
      (clube_id, atividade_id, dbv_id, dbv_nome, status, entregue_em, updated_at)
    VALUES (p_clube_id, v_atividade_id, p_dbv_id, v_dbv_nome, 'aprovada', now(), now())
    ON CONFLICT (atividade_id, dbv_id) DO UPDATE
      SET status = 'aprovada', updated_at = now();
  ELSE
    DELETE FROM public.atividades
     WHERE clube_id = p_clube_id AND dbv_id = p_dbv_id AND item_formativo_tipo = 'classe'
       AND item_formativo_nome = p_item_nome AND criado_por = '__sistema_classes__';
  END IF;
END;
$$;

-- Marcar/desmarcar em massa tambem respeita a faixa de idade do membro quando
-- a classe for "Classes agrupadas" (para as demais classes, min/max sao NULL
-- e a condicao AND fica sempre verdadeira).
CREATE OR REPLACE FUNCTION public.marcar_classe_completa(
  p_clube_id INTEGER, p_dbv_id INTEGER, p_classe_nome TEXT, p_avancada BOOLEAN, p_concluir BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_item_nome TEXT;
  v_idade INTEGER;
BEGIN
  IF NOT (
    public.current_user_is_admin_ti()
    OR EXISTS (
      SELECT 1 FROM public.usuario_clubes uc
      WHERE uc.usuario_id = auth.uid()
        AND uc.clube_id = p_clube_id
        AND uc.ativo = TRUE
        AND uc.perfil IN ('admin_clube', 'admin_geral', 'admin_total', 'usuario_secretaria')
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissao para marcar ou desmarcar esta classe.' USING ERRCODE = '42501';
  END IF;

  v_idade := public.idade_membro(p_dbv_id);

  IF p_concluir THEN
    INSERT INTO public.classes_requisitos_progresso
      (clube_id, dbv_id, requisito_id, classe_nome, concluido, origem, concluido_por, concluido_em, updated_at)
    SELECT p_clube_id, p_dbv_id, c.id, c.classe_nome, TRUE, 'manual', auth.uid(), now(), now()
    FROM public.classes_requisitos_catalogo c
    WHERE c.ativo = TRUE AND c.classe_nome = p_classe_nome AND c.avancada = p_avancada
      AND (c.idade_agrupada_min IS NULL OR (
        v_idade IS NOT NULL AND v_idade >= c.idade_agrupada_min
        AND (c.idade_agrupada_max IS NULL OR v_idade <= c.idade_agrupada_max)
      ))
    ON CONFLICT (clube_id, dbv_id, requisito_id) DO UPDATE
      SET concluido = TRUE, updated_at = now();
  ELSE
    DELETE FROM public.classes_requisitos_progresso pr
    USING public.classes_requisitos_catalogo c
    WHERE pr.requisito_id = c.id
      AND pr.clube_id = p_clube_id
      AND pr.dbv_id = p_dbv_id
      AND c.classe_nome = p_classe_nome
      AND c.avancada = p_avancada;
  END IF;

  IF p_avancada THEN
    SELECT nome_avancada INTO v_item_nome FROM public.classes_nomes_avancadas WHERE classe_nome = p_classe_nome;
  END IF;
  v_item_nome := COALESCE(v_item_nome, p_classe_nome);

  PERFORM public.recalcular_classe_receber(p_clube_id, p_dbv_id, p_classe_nome, p_avancada, v_item_nome);
END;
$$;
`;

writeFileSync('supabase/migrations/067_seed_classes_agrupadas.sql', sql, 'utf8');
console.log(`OK: ${linhas.length} linhas em "Classes agrupadas"`);
console.log('Raizes pontuaveis:', linhas.filter((l) => l.pontua).length);
const porBloco = {};
linhas.forEach((l) => { porBloco[l.secao] = (porBloco[l.secao] ?? 0) + 1; });
console.log('Por seção:', JSON.stringify(porBloco, null, 1));
