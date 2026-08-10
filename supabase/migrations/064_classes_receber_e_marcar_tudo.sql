-- Pivo do fluxo de Classes: em vez de atividade individual por requisito,
-- o admin/secretaria so marca o requisito como concluido (checkbox). Quando a
-- classe fica 100% concluida, ela entra sozinha na aba "Receber" da ficha do
-- membro -- reaproveitando exatamente o mesmo mecanismo ja usado para
-- especialidades (atividade + resposta aprovada), sem duplicar tela nem regra.

-- Remove assinaturas antigas (3/4 argumentos) caso uma versao anterior desta
-- migration ja tenha rodado, evitando ambiguidade de overload.
DROP FUNCTION IF EXISTS public.recalcular_classe_receber(INTEGER, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.marcar_classe_completa(INTEGER, INTEGER, TEXT, BOOLEAN);

-- ---------------------------------------------------------------------------
-- Nome da classe avancada de cada classe regular (mesmo texto usado nos
-- brasoes/telas) -- usado para nomear a atividade sintetica e casar com
-- CLASSES_LABELS da ficha do membro (app/membro/[id].tsx).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.classes_nomes_avancadas (
  classe_nome TEXT PRIMARY KEY,
  nome_avancada TEXT NOT NULL
);

INSERT INTO public.classes_nomes_avancadas (classe_nome, nome_avancada) VALUES
  ('Amigo', 'Amigo da Natureza'),
  ('Companheiro', 'Companheiro de Excursionismo'),
  ('Pesquisador', 'Pesquisador de Campos e Bosques'),
  ('Pioneiro', 'Pioneiro de Novas Fronteiras'),
  ('Excursionista', 'Excursionista na Mata'),
  ('Guia', 'Guia de Exploração')
ON CONFLICT (classe_nome) DO UPDATE SET nome_avancada = EXCLUDED.nome_avancada;

ALTER TABLE public.classes_nomes_avancadas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "classes_nomes_avancadas_select" ON public.classes_nomes_avancadas;
CREATE POLICY "classes_nomes_avancadas_select"
ON public.classes_nomes_avancadas FOR SELECT TO authenticated USING (TRUE);
GRANT SELECT ON public.classes_nomes_avancadas TO authenticated;

-- ---------------------------------------------------------------------------
-- Nucleo: recalcula se a classe deve aparecer em "Receber"
-- ---------------------------------------------------------------------------
-- p_item_nome e o nome usado em atividades/investidura_itens (ex.: "Amigo da
-- Natureza" para a avancada) -- o mesmo texto que a ficha do membro (CLASSES_LABELS)
-- ja sabe converter para a coluna certa em progresso_classes.
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

  -- Ja validada pela diretoria: nao mexe mais (edicao posterior nao reabre).
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
    -- Deixou de estar completa (alguem desmarcou um requisito): some de Receber.
    DELETE FROM public.atividades
     WHERE clube_id = p_clube_id AND dbv_id = p_dbv_id AND item_formativo_tipo = 'classe'
       AND item_formativo_nome = p_item_nome AND criado_por = '__sistema_classes__';
  END IF;
END;
$$;

-- Cobre o caso comum: um requisito marcado/desmarcado de cada vez pelo checkbox.
-- item_nome = o nome da classe avancada quando avancada=true, senao o proprio nome.
CREATE OR REPLACE FUNCTION public.trg_recalcular_classe_receber()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_classe TEXT := COALESCE(NEW.classe_nome, OLD.classe_nome);
  v_avancada BOOLEAN;
  v_item_nome TEXT;
BEGIN
  SELECT c.avancada INTO v_avancada
  FROM public.classes_requisitos_catalogo c
  WHERE c.id = COALESCE(NEW.requisito_id, OLD.requisito_id);

  v_item_nome := CASE WHEN v_avancada THEN
    (SELECT nome_avancada FROM public.classes_nomes_avancadas WHERE classe_nome = v_classe)
  ELSE v_classe END;
  v_item_nome := COALESCE(v_item_nome, v_classe);

  PERFORM public.recalcular_classe_receber(
    COALESCE(NEW.clube_id, OLD.clube_id), COALESCE(NEW.dbv_id, OLD.dbv_id),
    v_classe, COALESCE(v_avancada, FALSE), v_item_nome
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

GRANT EXECUTE ON FUNCTION public.marcar_classe_completa(INTEGER, INTEGER, TEXT, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalcular_classe_receber(INTEGER, INTEGER, TEXT, BOOLEAN, TEXT) TO authenticated;
