-- Pivo do fluxo de Classes: em vez de atividade individual por requisito,
-- o admin/secretaria so marca o requisito como concluido (checkbox). Quando a
-- classe fica 100% concluida, ela entra sozinha na aba "Receber" da ficha do
-- membro -- reaproveitando exatamente o mesmo mecanismo ja usado para
-- especialidades (atividade + resposta aprovada), sem duplicar tela nem regra.

-- ---------------------------------------------------------------------------
-- Nucleo: recalcula se a classe deve aparecer em "Receber"
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalcular_classe_receber(
  p_clube_id INTEGER, p_dbv_id INTEGER, p_classe_nome TEXT
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
  WHERE c.ativo = TRUE AND c.pontua = TRUE AND c.classe_nome = p_classe_nome;

  IF v_total = 0 THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_feitos
  FROM public.classes_requisitos_progresso pr
  JOIN public.classes_requisitos_catalogo c ON c.id = pr.requisito_id
  WHERE pr.dbv_id = p_dbv_id
    AND pr.concluido = TRUE
    AND c.ativo = TRUE AND c.pontua = TRUE AND c.classe_nome = p_classe_nome;

  -- Ja validada pela diretoria: nao mexe mais (edicao posterior nao reabre).
  SELECT entregue INTO v_ja_entregue
  FROM public.investidura_itens
  WHERE clube_id = p_clube_id AND dbv_id = p_dbv_id AND tipo = 'classe' AND item_nome = p_classe_nome;
  IF v_ja_entregue THEN
    RETURN;
  END IF;

  SELECT nome INTO v_dbv_nome FROM public.desbravadores WHERE id = p_dbv_id;

  IF v_feitos >= v_total THEN
    SELECT id INTO v_atividade_id FROM public.atividades
     WHERE clube_id = p_clube_id AND dbv_id = p_dbv_id AND item_formativo_tipo = 'classe'
       AND item_formativo_nome = p_classe_nome AND criado_por = '__sistema_classes__';

    IF v_atividade_id IS NULL THEN
      INSERT INTO public.atividades
        (clube_id, titulo, descricao, destino, dbv_id, dbv_nome, criado_por,
         item_formativo_tipo, item_formativo_nome, gera_investidura)
      VALUES (
        p_clube_id, 'Classe ' || p_classe_nome || ' completa',
        'Todos os requisitos da classe foram concluidos.', 'desbravador',
        p_dbv_id, v_dbv_nome, '__sistema_classes__', 'classe', p_classe_nome, TRUE
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
    -- Deixou de estar completa (alguem desmarcou um requisito): some de Receber.
    DELETE FROM public.atividades
     WHERE clube_id = p_clube_id AND dbv_id = p_dbv_id AND item_formativo_tipo = 'classe'
       AND item_formativo_nome = p_classe_nome AND criado_por = '__sistema_classes__';
  END IF;
END;
$$;

-- Cobre o caso comum: um requisito marcado/desmarcado de cada vez pelo checkbox.
CREATE OR REPLACE FUNCTION public.trg_recalcular_classe_receber()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalcular_classe_receber(
    COALESCE(NEW.clube_id, OLD.clube_id),
    COALESCE(NEW.dbv_id, OLD.dbv_id),
    COALESCE(NEW.classe_nome, OLD.classe_nome)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_classes_req_progresso_receber ON public.classes_requisitos_progresso;
CREATE TRIGGER trg_classes_req_progresso_receber
AFTER INSERT OR UPDATE OF concluido OR DELETE ON public.classes_requisitos_progresso
FOR EACH ROW
EXECUTE FUNCTION public.trg_recalcular_classe_receber();

-- ---------------------------------------------------------------------------
-- RPC: checkbox mestre "marcar/desmarcar toda a classe" (hub e tela do membro).
-- Atomico -- recalcula uma unica vez no final, sem depender da ordem de disparo
-- dos gatilhos linha a linha durante a marcacao em massa.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.marcar_classe_completa(
  p_clube_id INTEGER, p_dbv_id INTEGER, p_classe_nome TEXT, p_concluir BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
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
    WHERE c.ativo = TRUE AND c.classe_nome = p_classe_nome
    ON CONFLICT (clube_id, dbv_id, requisito_id) DO UPDATE
      SET concluido = TRUE, updated_at = now();
  ELSE
    DELETE FROM public.classes_requisitos_progresso pr
    USING public.classes_requisitos_catalogo c
    WHERE pr.requisito_id = c.id
      AND pr.clube_id = p_clube_id
      AND pr.dbv_id = p_dbv_id
      AND c.classe_nome = p_classe_nome;
  END IF;

  PERFORM public.recalcular_classe_receber(p_clube_id, p_dbv_id, p_classe_nome);
END;
$$;

GRANT EXECUTE ON FUNCTION public.marcar_classe_completa(INTEGER, INTEGER, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalcular_classe_receber(INTEGER, INTEGER, TEXT) TO authenticated;
