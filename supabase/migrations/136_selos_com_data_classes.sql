-- Selos com data no fluxo de classes: cada etapa guarda quando aconteceu.
--   concluida_em           : a classe ficou completa e entrou na fila da diretoria
--   aprovada_diretoria_em  : a diretoria aprovou (passa para o regional)
--   aprovada_regional_em   : o regional aprovou (vai para aguardando investidura)
-- Uma recusa e a nova conclusao reiniciam a linha do tempo.

ALTER TABLE public.classe_aprovacoes
  ADD COLUMN IF NOT EXISTS concluida_em timestamptz,
  ADD COLUMN IF NOT EXISTS aprovada_diretoria_em timestamptz,
  ADD COLUMN IF NOT EXISTS aprovada_regional_em timestamptz;

-- Linhas que ja existem: aproximacao com as datas conhecidas.
UPDATE public.classe_aprovacoes SET concluida_em = created_at WHERE concluida_em IS NULL;
UPDATE public.classe_aprovacoes SET aprovada_diretoria_em = decidido_em
 WHERE aprovada_diretoria_em IS NULL AND etapa IN ('regional', 'concluida') AND decidido_em IS NOT NULL;
UPDATE public.classe_aprovacoes SET aprovada_regional_em = decidido_em
 WHERE aprovada_regional_em IS NULL AND etapa = 'concluida' AND decidido_em IS NOT NULL;

-- Entrada na fila da diretoria: marca quando a classe ficou completa.
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

    INSERT INTO public.classe_aprovacoes (clube_id, dbv_id, item_nome, etapa, classe_catalogo, avancada, concluida_em)
    VALUES (p_clube_id, p_dbv_id, public.fluxo_chave_item(p_item_nome), 'diretoria', p_classe_nome, p_avancada, now())
    ON CONFLICT (clube_id, dbv_id, item_nome) DO UPDATE
      SET etapa = CASE WHEN classe_aprovacoes.etapa = 'correcao' THEN 'diretoria' ELSE classe_aprovacoes.etapa END,
          reenviada = CASE WHEN classe_aprovacoes.etapa = 'correcao' THEN TRUE ELSE classe_aprovacoes.reenviada END,
          avisado_em = CASE WHEN classe_aprovacoes.etapa = 'correcao' THEN NULL ELSE classe_aprovacoes.avisado_em END,
          classe_catalogo = CASE WHEN classe_aprovacoes.etapa = 'correcao' THEN p_classe_nome ELSE classe_aprovacoes.classe_catalogo END,
          avancada = CASE WHEN classe_aprovacoes.etapa = 'correcao' THEN p_avancada ELSE classe_aprovacoes.avancada END,
          -- volta de uma correcao: a linha do tempo recomeca
          concluida_em = CASE WHEN classe_aprovacoes.etapa = 'correcao' THEN now() ELSE COALESCE(classe_aprovacoes.concluida_em, now()) END,
          aprovada_diretoria_em = CASE WHEN classe_aprovacoes.etapa = 'correcao' THEN NULL ELSE classe_aprovacoes.aprovada_diretoria_em END,
          aprovada_regional_em = CASE WHEN classe_aprovacoes.etapa = 'correcao' THEN NULL ELSE classe_aprovacoes.aprovada_regional_em END,
          updated_at = now();
  ELSE
    DELETE FROM public.atividades
     WHERE clube_id = p_clube_id AND dbv_id = p_dbv_id AND item_formativo_tipo = 'classe'
       AND item_formativo_nome = p_item_nome AND criado_por = '__sistema_classes__';
    DELETE FROM public.classe_aprovacoes
     WHERE clube_id = p_clube_id AND dbv_id = p_dbv_id AND item_nome = public.fluxo_chave_item(p_item_nome)
       AND etapa <> 'correcao' AND classe_catalogo = p_classe_nome AND avancada = p_avancada;
  END IF;
END;
$$;

-- Aprovar: grava a data da etapa que acabou de ser aprovada.
CREATE OR REPLACE FUNCTION public.classe_aprovar(p_clube_id integer, p_dbv_id integer, p_item_nome text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.classe_aprovacoes%ROWTYPE;
  v_nome text;
  v_tem_regional boolean;
  v_avisos jsonb := '[]'::jsonb;
  v_concluiu boolean := FALSE;
BEGIN
  SELECT * INTO v_row FROM public.classe_aprovacoes
   WHERE clube_id = p_clube_id AND dbv_id = p_dbv_id AND item_nome = p_item_nome FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Esta classe nao esta na fila de aprovacao.'; END IF;
  SELECT nome INTO v_nome FROM public.desbravadores WHERE id = p_dbv_id;

  IF v_row.etapa = 'diretoria' THEN
    IF NOT public.fluxo_pode_diretoria(p_clube_id) THEN
      RAISE EXCEPTION 'Sem permissao para aprovar pela diretoria.' USING ERRCODE = '42501';
    END IF;
    SELECT EXISTS (SELECT 1 FROM public.usuario_clubes WHERE clube_id = p_clube_id AND ativo = TRUE AND perfil = 'usuario_regional')
      INTO v_tem_regional;
    UPDATE public.classe_aprovacoes SET aprovada_diretoria_em = now() WHERE id = v_row.id;
    IF v_tem_regional THEN
      UPDATE public.classe_aprovacoes
         SET etapa = 'regional', decidido_por = auth.uid(), decidido_em = now(), updated_at = now()
       WHERE id = v_row.id;
      v_avisos := jsonb_build_array(jsonb_build_object(
        'tokens', public.fluxo_tokens(p_clube_id, p_dbv_id, 'regional'),
        'titulo', 'Classe para aprovar',
        'corpo', COALESCE(v_nome, 'Membro') || ' - ' || p_item_nome || ' foi aprovada pela diretoria e aguarda a sua analise.',
        'dados', jsonb_build_object('tela', 'rota', 'rota', '/admin/aprovacoes')
      ));
    ELSE
      v_concluiu := TRUE;
    END IF;
  ELSIF v_row.etapa = 'regional' THEN
    IF NOT public.fluxo_pode_regional(p_clube_id) THEN
      RAISE EXCEPTION 'Sem permissao para aprovar pelo regional.' USING ERRCODE = '42501';
    END IF;
    UPDATE public.classe_aprovacoes SET aprovada_regional_em = now() WHERE id = v_row.id;
    v_concluiu := TRUE;
  ELSE
    RAISE EXCEPTION 'Esta classe nao esta aguardando aprovacao (etapa: %).', v_row.etapa;
  END IF;

  IF v_concluiu THEN
    UPDATE public.classe_aprovacoes
       SET etapa = 'concluida', decidido_por = auth.uid(), decidido_em = now(), updated_at = now()
     WHERE id = v_row.id;
    INSERT INTO public.investidura_itens
      (clube_id, dbv_id, tipo, item_nome, aguardando, entregue, marcado, aprovado_em, entregue_em, entregue_por, origem, updated_at)
    VALUES (p_clube_id, p_dbv_id, 'classe', p_item_nome, TRUE, FALSE, FALSE, now(), NULL, NULL, 'classe', now())
    ON CONFLICT (clube_id, dbv_id, tipo, item_nome) DO UPDATE
      SET aguardando = TRUE, entregue = FALSE, marcado = FALSE, aprovado_em = now(),
          entregue_em = NULL, entregue_por = NULL, origem = 'classe', updated_at = now();
    v_avisos := jsonb_build_array(
      jsonb_build_object(
        'tokens', public.fluxo_tokens(p_clube_id, p_dbv_id, 'membro'),
        'titulo', 'Classe aprovada!',
        'corpo', p_item_nome || ' foi aprovada. Agora aguarda a investidura.',
        'dados', jsonb_build_object('tela', 'rota', 'rota', '/')
      ),
      jsonb_build_object(
        'tokens', public.fluxo_tokens(p_clube_id, p_dbv_id, 'diretoria'),
        'titulo', 'Classe aprovada',
        'corpo', COALESCE(v_nome, 'Membro') || ' - ' || p_item_nome || ' foi aprovada e aguarda a investidura.',
        'dados', jsonb_build_object('tela', 'rota', 'rota', '/admin/aprovacoes')
      )
    );
  END IF;

  RETURN jsonb_build_object('avisos', v_avisos, 'concluida', v_concluiu);
END;
$$;

-- A lista da fila passa a trazer as datas.
DROP FUNCTION IF EXISTS public.classe_fila(integer);
CREATE FUNCTION public.classe_fila(p_clube_id integer)
RETURNS TABLE (
  id bigint, dbv_id integer, dbv_nome text, unidade_nome text, item_nome text, etapa text,
  recusado_por text, motivo text, requisitos_recusados jsonb, reenviada boolean, updated_at timestamptz,
  classe_catalogo text, avancada boolean,
  concluida_em timestamptz, aprovada_diretoria_em timestamptz, aprovada_regional_em timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.fluxo_pode_diretoria(p_clube_id) OR public.fluxo_pode_regional(p_clube_id)) THEN
    RAISE EXCEPTION 'Sem permissao para ver as aprovacoes.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT a.id, a.dbv_id, d.nome::text, COALESCE(d.unidade_nome, 'Sem unidade')::text, a.item_nome, a.etapa,
         a.recusado_por, a.motivo, a.requisitos_recusados, a.reenviada, a.updated_at,
         a.classe_catalogo, a.avancada,
         a.concluida_em, a.aprovada_diretoria_em, a.aprovada_regional_em
  FROM public.classe_aprovacoes a
  LEFT JOIN public.desbravadores d ON d.id = a.dbv_id
  WHERE a.clube_id = p_clube_id AND a.etapa IN ('diretoria', 'regional', 'correcao')
  ORDER BY d.nome, a.item_nome;
END;
$$;
GRANT EXECUTE ON FUNCTION public.classe_fila(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.classe_aprovar(integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalcular_classe_receber(INTEGER, INTEGER, TEXT, BOOLEAN, TEXT) TO authenticated;
