-- Alertas direcionados do Ranking do Campo e inativacao anual controlada.

CREATE TABLE IF NOT EXISTS public.alertas_usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clube_id INTEGER NOT NULL REFERENCES public.clubes(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requisito_id UUID REFERENCES public.ranking_clubes_requisitos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  corpo TEXT NOT NULL,
  rota TEXT,
  chave TEXT NOT NULL,
  lido_em TIMESTAMPTZ,
  oculto_em TIMESTAMPTZ,
  push_enviado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, chave)
);

CREATE INDEX IF NOT EXISTS alertas_usuarios_pendentes_idx
  ON public.alertas_usuarios (push_enviado_em, created_at);
CREATE INDEX IF NOT EXISTS alertas_usuarios_usuario_idx
  ON public.alertas_usuarios (usuario_id, created_at DESC);

ALTER TABLE public.alertas_usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alertas_usuario_select" ON public.alertas_usuarios;
CREATE POLICY "alertas_usuario_select" ON public.alertas_usuarios
  FOR SELECT TO authenticated USING (usuario_id = auth.uid());
DROP POLICY IF EXISTS "alertas_usuario_update" ON public.alertas_usuarios;
CREATE POLICY "alertas_usuario_update" ON public.alertas_usuarios
  FOR UPDATE TO authenticated USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

GRANT SELECT, UPDATE ON public.alertas_usuarios TO authenticated;
GRANT ALL ON public.alertas_usuarios TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'alertas_usuarios'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.alertas_usuarios;
  END IF;
END $$;

ALTER TABLE public.desbravadores
  ADD COLUMN IF NOT EXISTS inativado_fim_ano BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.usuario_clubes
  ADD COLUMN IF NOT EXISTS inativado_fim_ano BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.responsavel_membros
  ADD COLUMN IF NOT EXISTS inativado_fim_ano BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.inserir_alerta_diretoria(
  p_clube_id INTEGER,
  p_tipo TEXT,
  p_titulo TEXT,
  p_corpo TEXT,
  p_rota TEXT,
  p_chave TEXT,
  p_requisito_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_total INTEGER;
BEGIN
  INSERT INTO public.alertas_usuarios (
    clube_id, usuario_id, requisito_id, tipo, titulo, corpo, rota, chave
  )
  SELECT DISTINCT p_clube_id, uc.usuario_id, p_requisito_id,
    p_tipo, p_titulo, p_corpo, p_rota, p_chave
  FROM public.usuario_clubes uc
  WHERE uc.clube_id = p_clube_id
    AND uc.ativo = true
    AND uc.perfil IN ('admin_clube', 'usuario_diretoria', 'usuario_secretaria')
  ON CONFLICT (usuario_id, chave) DO NOTHING;
  GET DIAGNOSTICS v_total = ROW_COUNT;
  RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.alertar_requisito_ranking_concluido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.ranking_clubes_requisitos%ROWTYPE;
  v_antes_concluido BOOLEAN := false;
  v_depois_concluido BOOLEAN := false;
BEGIN
  SELECT * INTO v_req FROM public.ranking_clubes_requisitos WHERE id = NEW.requisito_id;
  IF NOT FOUND OR v_req.pontuacao_maxima <= 0 THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' THEN
    v_antes_concluido := COALESCE(OLD.pontos_atuais, 0) >= v_req.pontuacao_maxima;
  END IF;
  v_depois_concluido := COALESCE(NEW.pontos_atuais, 0) >= v_req.pontuacao_maxima;

  IF v_depois_concluido AND NOT v_antes_concluido THEN
    PERFORM public.inserir_alerta_diretoria(
      NEW.clube_id,
      'ranking_campo_concluido',
      'Requisito do Ranking do Campo concluido',
      COALESCE(v_req.item_codigo || ' - ', '') || v_req.requisito,
      '/admin/ranking-clubes',
      'ranking-concluido-' || NEW.clube_id || '-' || NEW.requisito_id || '-' || NEW.updated_at::text,
      NEW.requisito_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alertar_requisito_ranking_concluido ON public.ranking_clubes_pontuacoes;
CREATE TRIGGER trg_alertar_requisito_ranking_concluido
AFTER INSERT OR UPDATE OF pontos_atuais ON public.ranking_clubes_pontuacoes
FOR EACH ROW EXECUTE FUNCTION public.alertar_requisito_ranking_concluido();

CREATE OR REPLACE FUNCTION public.processar_automacoes_diarias(p_data DATE DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data DATE := COALESCE(p_data, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  v_req RECORD;
  v_clube RECORD;
  v_dias INTEGER;
  v_alertas INTEGER := 0;
  v_inativados INTEGER := 0;
BEGIN
  -- Lembretes de 30, 15 e 7 dias, apenas enquanto o requisito estiver pendente.
  FOR v_req IN
    SELECT r.*, c.id AS clube_id
    FROM public.ranking_clubes_requisitos r
    JOIN public.clubes c ON c.programa_id = r.programa_id AND c.ativo = true
    LEFT JOIN public.ranking_clubes_pontuacoes p
      ON p.clube_id = c.id AND p.requisito_id = r.id
    WHERE r.ativo = true
      AND r.prazo IS NOT NULL
      AND (r.prazo - v_data) IN (30, 15, 7)
      AND COALESCE(p.pontos_atuais, 0) < r.pontuacao_maxima
  LOOP
    v_dias := v_req.prazo - v_data;
    v_alertas := v_alertas + public.inserir_alerta_diretoria(
      v_req.clube_id,
      'ranking_campo_prazo',
      'Ranking do Campo: prazo em ' || v_dias || ' dias',
      COALESCE(v_req.item_codigo || ' - ', '') || v_req.requisito ||
        '. Prazo: ' || to_char(v_req.prazo, 'DD/MM/YYYY') || '.',
      '/admin/ranking-clubes',
      'ranking-prazo-' || v_req.clube_id || '-' || v_req.id || '-' || v_dias,
      v_req.id
    );
  END LOOP;

  -- Penultimo dia do ano: lembra diretor e secretaria se ainda nao houve backup/zeragem.
  IF v_data = make_date(EXTRACT(YEAR FROM v_data)::integer, 12, 30) THEN
    FOR v_clube IN
      SELECT c.id
      FROM public.clubes c
      WHERE c.ativo = true
        AND NOT EXISTS (
          SELECT 1 FROM public.ranking_backups b
          WHERE b.clube_id = c.id AND b.ano = EXTRACT(YEAR FROM v_data)::integer
        )
    LOOP
      v_alertas := v_alertas + public.inserir_alerta_diretoria(
        v_clube.id,
        'zerar_pontuacao',
        'Zerar a pontuacao anual',
        'A pontuacao ainda nao foi zerada. Gere o backup e zere os pontos em Modelos do Clube > Ranking.',
        '/admin/modelos?aba=ranking',
        'zerar-pontuacao-' || v_clube.id || '-' || EXTRACT(YEAR FROM v_data)::integer,
        NULL
      );
    END LOOP;
  END IF;

  -- Ultimo dia do ano: suspende membro e seus acessos, preservando diretor e secretaria.
  IF v_data = make_date(EXTRACT(YEAR FROM v_data)::integer, 12, 31) THEN
    UPDATE public.desbravadores d
       SET ativo = false, inativado_fim_ano = true, updated_at = now()
     WHERE COALESCE(d.ativo, true) = true
       AND NOT EXISTS (
         SELECT 1 FROM public.usuario_clubes uc
         WHERE uc.membro_id = d.id AND uc.clube_id = d.clube_id AND uc.ativo = true
           AND uc.perfil IN ('admin_clube', 'usuario_diretoria', 'usuario_secretaria')
       );
    GET DIAGNOSTICS v_inativados = ROW_COUNT;

    UPDATE public.usuario_clubes uc
       SET ativo = false, inativado_fim_ano = true, updated_at = now()
     WHERE uc.ativo = true
       AND uc.perfil NOT IN ('admin_ti', 'admin_clube', 'usuario_diretoria', 'usuario_secretaria')
       AND (uc.membro_id IS NULL OR EXISTS (
         SELECT 1 FROM public.desbravadores d WHERE d.id = uc.membro_id AND d.inativado_fim_ano = true
       ));

    UPDATE public.responsavel_membros rm
       SET ativo = false, inativado_fim_ano = true, updated_at = now()
     WHERE rm.ativo = true
       AND EXISTS (
         SELECT 1 FROM public.desbravadores d WHERE d.id = rm.membro_id AND d.inativado_fim_ano = true
       );
  END IF;

  RETURN jsonb_build_object('data', v_data, 'alertas_criados', v_alertas, 'membros_inativados', v_inativados);
END;
$$;

REVOKE ALL ON FUNCTION public.processar_automacoes_diarias(DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.processar_automacoes_diarias(DATE) TO service_role;

CREATE OR REPLACE FUNCTION public.reativar_membro_e_acessos(p_clube_id INTEGER, p_membro_id INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.current_user_is_admin_ti()
    OR EXISTS (
      SELECT 1 FROM public.usuario_clubes uc
      WHERE uc.usuario_id = auth.uid() AND uc.clube_id = p_clube_id AND uc.ativo = true
        AND uc.perfil IN ('admin_clube', 'usuario_diretoria')
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissao para reativar este membro.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.desbravadores
     SET ativo = true, inativado_fim_ano = false, updated_at = now()
   WHERE id = p_membro_id AND clube_id = p_clube_id;

  UPDATE public.usuario_clubes
     SET ativo = true, inativado_fim_ano = false, updated_at = now()
   WHERE clube_id = p_clube_id AND membro_id = p_membro_id AND inativado_fim_ano = true;

  UPDATE public.responsavel_membros
     SET ativo = true, inativado_fim_ano = false, updated_at = now()
   WHERE clube_id = p_clube_id AND membro_id = p_membro_id AND inativado_fim_ano = true;
END;
$$;

REVOKE ALL ON FUNCTION public.reativar_membro_e_acessos(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reativar_membro_e_acessos(INTEGER, INTEGER) TO authenticated;
