// Gera o seed SQL do catalogo "Classes agrupadas" a partir de
// scripts/classes-dados-agrupadas.mjs. Uso: node scripts/gerar-seed-classes-agrupadas.mjs
//
// Cada faixa de idade vira uma classe de verdade ("Amigo - Agrupadas",
// "Companheiro - Agrupadas"...), que passa pelo MESMO pipeline de conclusao/
// Receber/investidura das classes regulares -- concluir via Agrupadas conta
// como ter a insignia da classe correspondente.
import { writeFileSync } from 'node:fs';
import { formatoPeloTexto } from './classes-ajustes.mjs';
import { AGRUPADAS_SECOES, AGRUPADAS_AVANCADAS } from './classes-dados-agrupadas.mjs';

function q(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

// Faixa da agrupada -> classe oficial que ela regulariza (a classe de um ano
// antes: quem chega com 11 anos sem ter feito Amigo usa a faixa "11").
const BRACKETS = [
  { token: '11', classe: 'Amigo - Agrupadas' },
  { token: '12', classe: 'Companheiro - Agrupadas' },
  { token: '13', classe: 'Pesquisador - Agrupadas' },
  { token: '14', classe: 'Pioneiro - Agrupadas' },
  { token: '15+', classe: 'Guia - Agrupadas' },
];

const linhas = [];
const ordemPorClasse = {};

function proximaOrdem(classe) {
  ordemPorClasse[classe] = (ordemPorClasse[classe] ?? 0) + 1;
  return ordemPorClasse[classe];
}

function empurrarItem(classeNome, secaoNome, secaoOrdem, item) {
  const ordem = proximaOrdem(classeNome);
  const temEscolha = !!item.grupoEscolha;
  const chaveGrupo = temEscolha ? `${classeNome}::${secaoNome}::${item.codigo}` : null;

  linhas.push({
    classe: classeNome, secao: secaoNome, secaoOrdem, ordem, codigo: item.codigo, codigoRaiz: item.codigo,
    subitem: null, texto: item.texto, tipo: item.tipo ?? 'Requisito',
    especialidadeNome: item.especialidadeNome ?? null, avancada: false, pontua: true,
    formato: item.especialidadeNome ? 'nenhum' : formatoPeloTexto(item.texto),
    grupoEscolha: null, escolhasNecessarias: null,
  });

  for (const sub of item.subitens ?? []) {
    const ordemSub = proximaOrdem(classeNome);
    const ehEspecialidade = !!sub.especialidadeNome;
    linhas.push({
      classe: classeNome, secao: secaoNome, secaoOrdem, ordem: ordemSub, codigo: item.codigo, codigoRaiz: item.codigo,
      subitem: sub.sub, texto: sub.texto, tipo: ehEspecialidade ? 'Especialidade' : (temEscolha ? 'Opção' : 'Atividade'),
      especialidadeNome: sub.especialidadeNome ?? null, avancada: false, pontua: false,
      formato: ehEspecialidade ? 'nenhum' : formatoPeloTexto(sub.texto),
      grupoEscolha: temEscolha ? chaveGrupo : null,
      escolhasNecessarias: temEscolha ? item.grupoEscolha.necessarias : null,
    });
  }
}

// Itens regulares: cada item entra em toda faixa cujo token aparece na sua tag
// (ex.: tag "11-12-13-14-15+" cai nas 5 classes; tag "13" so em Pesquisador).
AGRUPADAS_SECOES.forEach((secao, i) => {
  for (const item of secao.itens) {
    const tokens = item.tag.split('-');
    for (const bracket of BRACKETS) {
      if (tokens.includes(bracket.token)) empurrarItem(bracket.classe, secao.nome, i + 1, item);
    }
  }
});

// Blocos avançados: cada bloco vira sua propria classe "<Nome> - Agrupadas"
// (nao se limita a uma unica faixa -- fica disponivel para quem catalogar).
AGRUPADAS_AVANCADAS.forEach((bloco, i) => {
  const nomeLimpo = bloco.nome.replace(/^[IVX]+\.\s*/, '');
  const classeNome = `${nomeLimpo} - Agrupadas`;
  for (const item of bloco.itens) empurrarItem(classeNome, bloco.nome, i + 1, item);
});

const classesEnvolvidas = [...new Set(linhas.map((l) => l.classe))];

const valores = linhas
  .map((l) =>
    `  (${q(l.classe)}, ${q(l.secao)}, ${l.secaoOrdem}, ${l.ordem}, ${q(l.codigo)}, ${q(l.codigoRaiz)}, ${q(l.subitem)}, ` +
    `${q(l.texto)}, ${q(l.tipo)}, NULL, ${q(l.especialidadeNome)}, ${l.avancada}, ${l.pontua}, ` +
    `${q(l.formato)}, 3, NULL, NULL, ${q(l.grupoEscolha)}, ${l.escolhasNecessarias ?? 'NULL'}, NULL, NULL)`
  )
  .join(',\n');

const sql = `-- Classes agrupadas, tomada 2: cada faixa de idade vira uma classe de verdade
-- ("Amigo - Agrupadas", "Companheiro - Agrupadas"...), que passa pelo MESMO
-- pipeline de Receber/investidura das classes regulares. Substitui o catalogo
-- da migration 067 (que usava filtro de idade em runtime numa classe unica).
-- Gerado por scripts/gerar-seed-classes-agrupadas.mjs. Total: ${linhas.length} linhas.

-- Desativa o catalogo antigo da tentativa anterior (067).
UPDATE public.classes_requisitos_catalogo
SET ativo = FALSE
WHERE classe_nome LIKE 'Classes agrupadas%';

UPDATE public.classes_requisitos_catalogo
SET ativo = FALSE
WHERE classe_nome IN (${classesEnvolvidas.map(q).join(', ')});

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
  especialidade_nome = EXCLUDED.especialidade_nome,
  avancada = EXCLUDED.avancada,
  pontua = EXCLUDED.pontua,
  formato_resposta = EXCLUDED.formato_resposta,
  grupo_escolha = EXCLUDED.grupo_escolha,
  escolhas_necessarias = EXCLUDED.escolhas_necessarias,
  ativo = TRUE,
  updated_at = now();

-- Restaura o comportamento padrao: "Classes agrupadas" tambem entra em Receber/
-- investidura normalmente (nao ha mais excecao para essa classe).
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
  IF p_classe_nome IS NULL THEN
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

-- Restaura marcar_classe_completa sem filtro de idade (faixa agora e estrutural,
-- cada uma e uma classe propria -- nao precisa mais checar idade em runtime).
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

  IF p_concluir THEN
    INSERT INTO public.classes_requisitos_progresso
      (clube_id, dbv_id, requisito_id, classe_nome, concluido, origem, concluido_por, concluido_em, updated_at)
    SELECT p_clube_id, p_dbv_id, c.id, c.classe_nome, TRUE, 'manual', auth.uid(), now(), now()
    FROM public.classes_requisitos_catalogo c
    WHERE c.ativo = TRUE AND c.classe_nome = p_classe_nome AND c.avancada = p_avancada
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

writeFileSync('supabase/migrations/068_classes_agrupadas_por_faixa.sql', sql, 'utf8');
console.log(`OK: ${linhas.length} linhas em ${classesEnvolvidas.length} classes`);
console.log('Classes:', classesEnvolvidas.join(' | '));
console.log('Raizes pontuaveis:', linhas.filter((l) => l.pontua).length);
