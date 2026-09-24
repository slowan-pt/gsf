-- Notificacao diaria do Ano Biblico por clube.

ALTER TABLE public.clubes
  ADD COLUMN IF NOT EXISTS ano_biblico_push_ativo BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS ano_biblico_push_hora TIME NOT NULL DEFAULT TIME '06:00';

CREATE OR REPLACE FUNCTION public.current_user_can_configurar_clube(target_clube_id INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_is_admin_ti()
  OR EXISTS (
    SELECT 1
    FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid()
      AND uc.clube_id = target_clube_id
      AND uc.ativo = TRUE
      AND uc.perfil IN ('admin_clube', 'usuario_diretoria')
  )
$$;

DROP POLICY IF EXISTS "clubes_config_clube_update" ON public.clubes;
CREATE POLICY "clubes_config_clube_update"
ON public.clubes FOR UPDATE TO authenticated
USING (public.current_user_can_configurar_clube(id))
WITH CHECK (public.current_user_can_configurar_clube(id));

CREATE OR REPLACE FUNCTION public.processar_push_ano_biblico(p_momento TIMESTAMPTZ DEFAULT now())
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agora_local TIMESTAMP := p_momento AT TIME ZONE 'America/Sao_Paulo';
  v_data DATE := (p_momento AT TIME ZONE 'America/Sao_Paulo')::date;
  v_hora TIME := (p_momento AT TIME ZONE 'America/Sao_Paulo')::time;
  v_bissexto BOOLEAN;
  v_dia RECORD;
  v_clube RECORD;
  v_total INTEGER := 0;
  v_linhas INTEGER := 0;
BEGIN
  v_bissexto := (
    (EXTRACT(YEAR FROM v_data)::integer % 4 = 0 AND EXTRACT(YEAR FROM v_data)::integer % 100 <> 0)
    OR EXTRACT(YEAR FROM v_data)::integer % 400 = 0
  );

  SELECT id, livro_nome, referencia
    INTO v_dia
  FROM public.ano_biblico_catalogo
  WHERE ativo = TRUE
    AND mes = EXTRACT(MONTH FROM v_data)::integer
    AND dia = EXTRACT(DAY FROM v_data)::integer
    AND ano_bissexto = v_bissexto
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('data', v_data, 'criados', 0, 'motivo', 'dia-nao-cadastrado');
  END IF;

  FOR v_clube IN
    SELECT id
    FROM public.clubes
    WHERE ativo = TRUE
      AND COALESCE(ano_biblico_push_ativo, TRUE) = TRUE
      AND v_hora >= COALESCE(ano_biblico_push_hora, TIME '06:00')
      AND v_agora_local < (v_data::timestamp + INTERVAL '1 day')
  LOOP
    INSERT INTO public.alertas_usuarios (
      clube_id, usuario_id, tipo, titulo, corpo, rota, chave
    )
    SELECT DISTINCT
      v_clube.id,
      alvo.usuario_id,
      'ano_biblico_diario',
      'Ano Bíblico de hoje',
      COALESCE(v_dia.livro_nome || ' ', '') || v_dia.referencia,
      '/ano-biblico/hoje',
      'ano-biblico-' || v_clube.id || '-' || alvo.usuario_id || '-' || v_data::text
    FROM (
      SELECT uc.usuario_id
      FROM public.usuario_clubes uc
      WHERE uc.clube_id = v_clube.id
        AND uc.ativo = TRUE
      UNION
      SELECT rm.usuario_id
      FROM public.responsavel_membros rm
      WHERE rm.clube_id = v_clube.id
        AND rm.ativo = TRUE
    ) alvo
    WHERE alvo.usuario_id IS NOT NULL
    ON CONFLICT (usuario_id, chave) DO NOTHING;

    GET DIAGNOSTICS v_linhas = ROW_COUNT;
    v_total := v_total + v_linhas;
  END LOOP;

  RETURN jsonb_build_object('data', v_data, 'catalogo_id', v_dia.id, 'criados', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.processar_push_ano_biblico(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.processar_push_ano_biblico(TIMESTAMPTZ) TO service_role;
REVOKE ALL ON FUNCTION public.current_user_can_configurar_clube(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_configurar_clube(INTEGER) TO authenticated;
