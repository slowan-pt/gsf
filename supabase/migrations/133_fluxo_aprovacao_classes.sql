-- Fluxo de aprovacao de classes: membro conclui -> diretoria -> regional -> aguardando investidura.
--
-- classe_aprovacoes guarda a etapa de cada classe concluida por membro:
--   diretoria  : concluida, esperando a analise da diretoria (admin_clube, secretaria, admin_ti...)
--   regional   : aprovada pela diretoria, esperando o regional
--   correcao   : recusada (por quem esta em recusado_por); itens recusados voltam desmarcados
--   concluida  : aprovada por todos; o item entra em "Aguardando Investidura"
-- Se o clube nao tem nenhum regional vinculado, a aprovacao da diretoria conclui direto.
--
-- Toda escrita passa por funcoes SECURITY DEFINER que conferem o perfil do usuario;
-- ninguem altera a tabela diretamente. As funcoes devolvem os tokens de push dos
-- destinatarios para o app enviar a notificacao.

CREATE TABLE IF NOT EXISTS public.classe_aprovacoes (
  id bigserial PRIMARY KEY,
  clube_id integer NOT NULL,
  dbv_id integer NOT NULL,
  item_nome text NOT NULL,
  etapa text NOT NULL DEFAULT 'diretoria' CHECK (etapa IN ('diretoria', 'regional', 'correcao', 'concluida')),
  recusado_por text CHECK (recusado_por IN ('diretoria', 'regional')),
  motivo text,
  requisitos_recusados jsonb NOT NULL DEFAULT '[]'::jsonb,
  reenviada boolean NOT NULL DEFAULT false,
  -- Classe do catalogo que originou a linha (regular ou agrupada) e se e avancada:
  -- e a partir dela que se listam e desmarcam os requisitos recusados.
  classe_catalogo text NOT NULL DEFAULT '',
  avancada boolean NOT NULL DEFAULT false,
  avisado_em timestamptz,
  decidido_por uuid,
  decidido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clube_id, dbv_id, item_nome)
);

CREATE INDEX IF NOT EXISTS classe_aprovacoes_etapa_idx ON public.classe_aprovacoes (clube_id, etapa);

ALTER TABLE public.classe_aprovacoes ENABLE ROW LEVEL SECURITY;

-- ─── Quem pode o que ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fluxo_pode_diretoria(p_clube_id integer)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.current_user_is_admin_ti()
  OR EXISTS (
    SELECT 1 FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid() AND uc.clube_id = p_clube_id AND uc.ativo = TRUE
      AND uc.perfil IN ('admin_ti', 'admin_clube', 'admin_geral', 'admin_total', 'usuario_secretaria')
  )
$$;

CREATE OR REPLACE FUNCTION public.fluxo_pode_regional(p_clube_id integer)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.current_user_is_admin_ti()
  OR EXISTS (
    SELECT 1 FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid() AND uc.clube_id = p_clube_id AND uc.ativo = TRUE
      AND uc.perfil IN ('usuario_regional', 'admin_total')
  )
$$;

GRANT EXECUTE ON FUNCTION public.fluxo_pode_diretoria(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fluxo_pode_regional(integer) TO authenticated;

-- Leitura: diretoria, regional e o proprio membro (a tarja vermelha na Inicio).
DROP POLICY IF EXISTS "classe_aprovacoes_select" ON public.classe_aprovacoes;
CREATE POLICY "classe_aprovacoes_select" ON public.classe_aprovacoes
  FOR SELECT TO authenticated
  USING (
    public.fluxo_pode_diretoria(clube_id)
    OR public.fluxo_pode_regional(clube_id)
    OR EXISTS (
      SELECT 1 FROM public.usuario_clubes uc
      WHERE uc.usuario_id = auth.uid() AND uc.clube_id = classe_aprovacoes.clube_id
        AND uc.ativo = TRUE AND uc.membro_id = classe_aprovacoes.dbv_id
    )
  );
GRANT SELECT ON public.classe_aprovacoes TO authenticated;

-- Regular e agrupadas sao alternativas: "Amigo" e "Amigo - Agrupadas" viram o mesmo item.
CREATE OR REPLACE FUNCTION public.fluxo_chave_item(p_nome text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN btrim(regexp_replace(p_nome, '\s*-\s*Agrupadas\s*$', '', 'i')) ILIKE 'Pesquisador de Campo%'
      THEN 'Pesquisador de Campos e Bosques'
    ELSE btrim(regexp_replace(p_nome, '\s*-\s*Agrupadas\s*$', '', 'i'))
  END
$$;

-- ─── Entrada no fluxo: o recalculo da classe cria/atualiza a linha ───────────
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

  -- Ja recebida: nao mexe mais (edicao posterior nao reabre).
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

    -- Fluxo de aprovacao: entra na fila da diretoria. Se vinha de uma correcao,
    -- volta para a diretoria marcada como reenviada (e avisa de novo).
    INSERT INTO public.classe_aprovacoes (clube_id, dbv_id, item_nome, etapa, classe_catalogo, avancada)
    VALUES (p_clube_id, p_dbv_id, public.fluxo_chave_item(p_item_nome), 'diretoria', p_classe_nome, p_avancada)
    ON CONFLICT (clube_id, dbv_id, item_nome) DO UPDATE
      SET etapa = CASE WHEN classe_aprovacoes.etapa = 'correcao' THEN 'diretoria' ELSE classe_aprovacoes.etapa END,
          reenviada = CASE WHEN classe_aprovacoes.etapa = 'correcao' THEN TRUE ELSE classe_aprovacoes.reenviada END,
          avisado_em = CASE WHEN classe_aprovacoes.etapa = 'correcao' THEN NULL ELSE classe_aprovacoes.avisado_em END,
          classe_catalogo = CASE WHEN classe_aprovacoes.etapa = 'correcao' THEN p_classe_nome ELSE classe_aprovacoes.classe_catalogo END,
          avancada = CASE WHEN classe_aprovacoes.etapa = 'correcao' THEN p_avancada ELSE classe_aprovacoes.avancada END,
          updated_at = now();
  ELSE
    -- Deixou de estar completa: some de Receber e da fila (menos se esta em correcao).
    DELETE FROM public.atividades
     WHERE clube_id = p_clube_id AND dbv_id = p_dbv_id AND item_formativo_tipo = 'classe'
       AND item_formativo_nome = p_item_nome AND criado_por = '__sistema_classes__';
    -- So apaga se foi ESTA versao (regular ou agrupada) que originou a linha.
    DELETE FROM public.classe_aprovacoes
     WHERE clube_id = p_clube_id AND dbv_id = p_dbv_id AND item_nome = public.fluxo_chave_item(p_item_nome)
       AND etapa <> 'correcao' AND classe_catalogo = p_classe_nome AND avancada = p_avancada;
  END IF;
END;
$$;

-- Classes que ja estavam completas antes desta migration continuam como estavam (tratadas como
-- ja recebidas); o fluxo vale a partir de agora, para classes concluidas ou reabertas depois.

-- ─── Destinatarios de push ──────────────────────────────────────────────────
-- p_papel: 'diretoria' | 'regional' | 'membro'. So devolve tokens de quem participa do fluxo.
CREATE OR REPLACE FUNCTION public.fluxo_tokens(p_clube_id integer, p_dbv_id integer, p_papel text)
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT t.token), ARRAY[]::text[])
  FROM public.push_tokens t
  WHERE t.user_id IN (
    SELECT uc.usuario_id FROM public.usuario_clubes uc
    WHERE uc.clube_id = p_clube_id AND uc.ativo = TRUE
      AND (
        (p_papel = 'diretoria' AND uc.perfil IN ('admin_clube', 'admin_geral', 'admin_total', 'usuario_secretaria'))
        OR (p_papel = 'regional' AND uc.perfil = 'usuario_regional')
        OR (p_papel = 'membro' AND uc.membro_id = p_dbv_id)
      )
  )
$$;

-- ─── Listagem para a tela Aprovacoes ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.classe_fila(p_clube_id integer)
RETURNS TABLE (
  id bigint, dbv_id integer, dbv_nome text, unidade_nome text, item_nome text, etapa text,
  recusado_por text, motivo text, requisitos_recusados jsonb, reenviada boolean, updated_at timestamptz,
  classe_catalogo text, avancada boolean
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
         a.classe_catalogo, a.avancada
  FROM public.classe_aprovacoes a
  LEFT JOIN public.desbravadores d ON d.id = a.dbv_id
  WHERE a.clube_id = p_clube_id AND a.etapa IN ('diretoria', 'regional', 'correcao')
  ORDER BY d.nome, a.item_nome;
END;
$$;

-- Requisitos da classe de uma linha da fila (para escolher o que recusar).
CREATE OR REPLACE FUNCTION public.classe_requisitos_do_item(p_clube_id integer, p_dbv_id integer, p_item_nome text)
RETURNS TABLE (id integer, codigo text, subitem text, texto text, secao text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_classe text;
  v_avancada boolean;
BEGIN
  IF NOT (public.fluxo_pode_diretoria(p_clube_id) OR public.fluxo_pode_regional(p_clube_id)) THEN
    RAISE EXCEPTION 'Sem permissao.' USING ERRCODE = '42501';
  END IF;
  SELECT a.classe_catalogo, a.avancada INTO v_classe, v_avancada
  FROM public.classe_aprovacoes a
  WHERE a.clube_id = p_clube_id AND a.dbv_id = p_dbv_id AND a.item_nome = p_item_nome;
  IF v_classe IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT c.id::integer, c.codigo::text, c.subitem::text, c.texto::text, c.secao::text
  FROM public.classes_requisitos_catalogo c
  WHERE c.ativo = TRUE AND c.pontua = TRUE AND c.classe_nome = v_classe AND c.avancada = v_avancada
  ORDER BY c.secao_ordem, c.ordem;
END;
$$;

-- ─── Decisoes ───────────────────────────────────────────────────────────────
-- Aprovar: diretoria -> regional (ou direto para investidura se o clube nao tem regional);
-- regional -> investidura. Devolve {avisos:[{tokens,titulo,corpo,dados}]} para o app enviar.
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

-- Recusar: marca a classe para correcao, desmarca os requisitos recusados e avisa o membro e a diretoria.
CREATE OR REPLACE FUNCTION public.classe_recusar(
  p_clube_id integer, p_dbv_id integer, p_item_nome text, p_requisito_ids integer[], p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.classe_aprovacoes%ROWTYPE;
  v_nome text;
  v_classe text;
  v_avancada boolean;
  v_ids integer[];
  v_lista jsonb;
  v_quem text;
  v_avisos jsonb := '[]'::jsonb;
BEGIN
  IF p_requisito_ids IS NULL OR array_length(p_requisito_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Escolha ao menos um requisito para recusar.';
  END IF;
  IF p_motivo IS NULL OR length(btrim(p_motivo)) = 0 THEN
    RAISE EXCEPTION 'Informe o motivo da recusa.';
  END IF;

  SELECT * INTO v_row FROM public.classe_aprovacoes
   WHERE clube_id = p_clube_id AND dbv_id = p_dbv_id AND item_nome = p_item_nome FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Esta classe nao esta na fila de aprovacao.'; END IF;

  IF v_row.etapa = 'diretoria' THEN
    IF NOT public.fluxo_pode_diretoria(p_clube_id) THEN
      RAISE EXCEPTION 'Sem permissao.' USING ERRCODE = '42501';
    END IF;
    v_quem := 'diretoria';
  ELSIF v_row.etapa = 'regional' THEN
    IF NOT public.fluxo_pode_regional(p_clube_id) THEN
      RAISE EXCEPTION 'Sem permissao.' USING ERRCODE = '42501';
    END IF;
    v_quem := 'regional';
  ELSE
    RAISE EXCEPTION 'Esta classe nao esta aguardando aprovacao (etapa: %).', v_row.etapa;
  END IF;

  v_classe := v_row.classe_catalogo;
  v_avancada := v_row.avancada;

  -- Recusar um subitem desmarca tambem a raiz (marcada a partir dos filhos);
  -- recusar uma raiz desmarca os filhos. Os irmaos do subitem continuam marcados.
  SELECT COALESCE(array_agg(DISTINCT x.id), ARRAY[]::integer[]) INTO v_ids FROM (
    SELECT c.id::integer AS id FROM public.classes_requisitos_catalogo c
     WHERE c.id = ANY (p_requisito_ids) AND c.classe_nome = v_classe AND c.avancada = v_avancada
    UNION
    SELECT r.id::integer FROM public.classes_requisitos_catalogo c
     JOIN public.classes_requisitos_catalogo r
       ON r.classe_nome = c.classe_nome AND r.avancada = c.avancada AND r.codigo_raiz = c.codigo_raiz
      AND r.subitem IS NULL
     WHERE c.id = ANY (p_requisito_ids) AND c.classe_nome = v_classe AND c.avancada = v_avancada AND c.subitem IS NOT NULL
    UNION
    SELECT r.id::integer FROM public.classes_requisitos_catalogo c
     JOIN public.classes_requisitos_catalogo r
       ON r.classe_nome = c.classe_nome AND r.avancada = c.avancada AND r.codigo_raiz = c.codigo_raiz
      AND r.subitem IS NOT NULL
     WHERE c.id = ANY (p_requisito_ids) AND c.classe_nome = v_classe AND c.avancada = v_avancada AND c.subitem IS NULL
  ) x;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', c.id, 'codigo', c.codigo, 'subitem', c.subitem, 'texto', c.texto) ORDER BY c.secao_ordem, c.ordem), '[]'::jsonb)
    INTO v_lista
  FROM public.classes_requisitos_catalogo c
  WHERE c.id = ANY (p_requisito_ids) AND c.classe_nome = v_classe AND c.avancada = v_avancada;

  IF jsonb_array_length(v_lista) = 0 THEN
    RAISE EXCEPTION 'Os requisitos escolhidos nao pertencem a esta classe.';
  END IF;

  -- Primeiro a etapa (para o recalculo nao apagar a linha), depois desmarca os requisitos.
  UPDATE public.classe_aprovacoes
     SET etapa = 'correcao', recusado_por = v_quem, motivo = btrim(p_motivo),
         requisitos_recusados = v_lista, decidido_por = auth.uid(), decidido_em = now(), updated_at = now()
   WHERE id = v_row.id;

  DELETE FROM public.classes_requisitos_progresso pr
   WHERE pr.clube_id = p_clube_id AND pr.dbv_id = p_dbv_id
     AND pr.requisito_id = ANY (v_ids);

  SELECT nome INTO v_nome FROM public.desbravadores WHERE id = p_dbv_id;
  v_avisos := jsonb_build_array(
    jsonb_build_object(
      'tokens', public.fluxo_tokens(p_clube_id, p_dbv_id, 'membro'),
      'titulo', 'Classe com correcoes',
      'corpo', p_item_nome || ' foi recusada ' || CASE WHEN v_quem = 'regional' THEN 'pelo regional' ELSE 'pela diretoria' END || '. Veja o que corrigir.',
      'dados', jsonb_build_object('tela', 'rota', 'rota', '/')
    ),
    jsonb_build_object(
      'tokens', public.fluxo_tokens(p_clube_id, p_dbv_id, 'diretoria'),
      'titulo', 'Classe recusada',
      'corpo', COALESCE(v_nome, 'Membro') || ' - ' || p_item_nome || ' foi recusada ' || CASE WHEN v_quem = 'regional' THEN 'pelo regional' ELSE 'pela diretoria' END || ' e volta para correcao.',
      'dados', jsonb_build_object('tela', 'rota', 'rota', '/admin/aprovacoes')
    )
  );
  RETURN jsonb_build_object('avisos', v_avisos);
END;
$$;

-- Aviso a diretoria quando a classe entra (ou volta, corrigida) na fila. Idempotente via avisado_em.
CREATE OR REPLACE FUNCTION public.classe_avisar_diretoria(p_clube_id integer, p_dbv_id integer, p_item_nome text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.classe_aprovacoes%ROWTYPE;
  v_nome text;
BEGIN
  SELECT * INTO v_row FROM public.classe_aprovacoes
   WHERE clube_id = p_clube_id AND dbv_id = p_dbv_id AND item_nome = p_item_nome FOR UPDATE;
  IF NOT FOUND OR v_row.etapa <> 'diretoria' OR v_row.avisado_em IS NOT NULL THEN
    RETURN jsonb_build_object('avisos', '[]'::jsonb);
  END IF;
  IF NOT (public.fluxo_pode_diretoria(p_clube_id) OR public.fluxo_pode_regional(p_clube_id)) THEN
    RETURN jsonb_build_object('avisos', '[]'::jsonb);
  END IF;
  UPDATE public.classe_aprovacoes SET avisado_em = now() WHERE id = v_row.id;
  SELECT nome INTO v_nome FROM public.desbravadores WHERE id = p_dbv_id;
  RETURN jsonb_build_object('avisos', jsonb_build_array(jsonb_build_object(
    'tokens', public.fluxo_tokens(p_clube_id, p_dbv_id, 'diretoria'),
    'titulo', CASE WHEN v_row.reenviada THEN 'Correcoes concluidas' ELSE 'Classe concluida' END,
    'corpo', COALESCE(v_nome, 'Membro') || ' - ' || p_item_nome ||
             CASE WHEN v_row.reenviada THEN ': correcoes feitas, aguarda nova analise.' ELSE ' foi concluida e aguarda a sua aprovacao.' END,
    'dados', jsonb_build_object('tela', 'rota', 'rota', '/admin/aprovacoes')
  )));
END;
$$;

-- Devolver para a diretoria: tira a classe de "aguardando investidura"/"recebida" e a recoloca
-- na fila da diretoria (os requisitos concluidos continuam como estao).
CREATE OR REPLACE FUNCTION public.classe_devolver_diretoria(p_clube_id integer, p_dbv_id integer, p_item_nome text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_classe text;
  v_avancada boolean;
BEGIN
  IF NOT (public.fluxo_pode_diretoria(p_clube_id) OR public.fluxo_pode_regional(p_clube_id)) THEN
    RAISE EXCEPTION 'Sem permissao.' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.investidura_itens
   WHERE clube_id = p_clube_id AND dbv_id = p_dbv_id AND tipo = 'classe' AND item_nome = p_item_nome;

  SELECT n.classe_nome INTO v_classe FROM public.classes_nomes_avancadas n WHERE n.nome_avancada = p_item_nome;
  v_avancada := v_classe IS NOT NULL;
  IF v_classe IS NULL THEN v_classe := p_item_nome; END IF;

  INSERT INTO public.classe_aprovacoes (clube_id, dbv_id, item_nome, etapa, classe_catalogo, avancada)
  VALUES (p_clube_id, p_dbv_id, public.fluxo_chave_item(p_item_nome), 'diretoria', v_classe, v_avancada)
  ON CONFLICT (clube_id, dbv_id, item_nome) DO UPDATE
    SET etapa = 'diretoria', avisado_em = NULL, decidido_por = NULL, decidido_em = NULL, updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.fluxo_tokens(integer, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.classe_fila(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.classe_requisitos_do_item(integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.classe_aprovar(integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.classe_recusar(integer, integer, text, integer[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.classe_avisar_diretoria(integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalcular_classe_receber(INTEGER, INTEGER, TEXT, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.classe_devolver_diretoria(integer, integer, text) TO authenticated;
