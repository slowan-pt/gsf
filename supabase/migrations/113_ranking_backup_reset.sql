-- Backup anual e zeragem transacional das pontuacoes do ano corrente.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ranking_backups', 'ranking_backups', false, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.ranking_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clube_id INTEGER NOT NULL REFERENCES public.clubes(id) ON DELETE CASCADE,
  ano INTEGER NOT NULL CHECK (ano >= 2000 AND ano <= 2200),
  nome_arquivo TEXT NOT NULL,
  arquivo_path TEXT NOT NULL,
  total_membros INTEGER NOT NULL DEFAULT 0,
  total_pontos NUMERIC NOT NULL DEFAULT 0,
  criado_por UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clube_id, ano),
  UNIQUE (arquivo_path)
);

ALTER TABLE public.ranking_backups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ranking_backups_admin_select" ON public.ranking_backups;
CREATE POLICY "ranking_backups_admin_select"
ON public.ranking_backups FOR SELECT TO authenticated
USING (public.current_user_can_admin_clube(clube_id));

GRANT SELECT ON public.ranking_backups TO authenticated;

DROP POLICY IF EXISTS "ranking_backup_storage_select" ON storage.objects;
CREATE POLICY "ranking_backup_storage_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ranking_backups'
  AND public.current_user_can_admin_clube(NULLIF((storage.foldername(name))[1], '')::integer)
);

DROP POLICY IF EXISTS "ranking_backup_storage_insert" ON storage.objects;
CREATE POLICY "ranking_backup_storage_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ranking_backups'
  AND public.current_user_can_admin_clube(NULLIF((storage.foldername(name))[1], '')::integer)
);

DROP POLICY IF EXISTS "ranking_backup_storage_delete" ON storage.objects;
CREATE POLICY "ranking_backup_storage_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'ranking_backups'
  AND public.current_user_can_admin_clube(NULLIF((storage.foldername(name))[1], '')::integer)
);

CREATE OR REPLACE FUNCTION public.zerar_pontuacao_clube(
  p_clube_id INTEGER,
  p_ano INTEGER,
  p_arquivo_path TEXT,
  p_nome_arquivo TEXT,
  p_total_membros INTEGER,
  p_total_pontos NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inicio DATE;
  v_fim DATE;
  v_extras INTEGER := 0;
  v_custom INTEGER := 0;
  v_unidades INTEGER := 0;
  v_base INTEGER := 0;
BEGIN
  IF NOT public.current_user_can_admin_clube(p_clube_id) THEN
    RAISE EXCEPTION 'Sem permissao para zerar a pontuacao deste clube.' USING ERRCODE = '42501';
  END IF;

  IF p_ano <> EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/Sao_Paulo')::date)::INTEGER THEN
    RAISE EXCEPTION 'A zeragem so pode ser feita para o ano corrente.' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(trim(p_arquivo_path), '') = '' OR COALESCE(trim(p_nome_arquivo), '') = '' THEN
    RAISE EXCEPTION 'O backup em PDF precisa ser enviado antes da zeragem.' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.objects
    WHERE bucket_id = 'ranking_backups' AND name = p_arquivo_path
  ) THEN
    RAISE EXCEPTION 'O arquivo PDF do backup nao foi encontrado no servidor.' USING ERRCODE = '22023';
  END IF;

  v_inicio := make_date(p_ano, 1, 1);
  v_fim := make_date(p_ano + 1, 1, 1);

  INSERT INTO public.ranking_backups (
    clube_id, ano, nome_arquivo, arquivo_path, total_membros, total_pontos, criado_por
  ) VALUES (
    p_clube_id, p_ano, p_nome_arquivo, p_arquivo_path,
    COALESCE(p_total_membros, 0), COALESCE(p_total_pontos, 0), auth.uid()
  );

  DELETE FROM public.pontuacoes_extras_itens
  WHERE clube_id = p_clube_id AND data >= v_inicio AND data < v_fim;
  GET DIAGNOSTICS v_extras = ROW_COUNT;

  DELETE FROM public.pontuacoes_custom
  WHERE clube_id = p_clube_id AND data >= v_inicio AND data < v_fim;
  GET DIAGNOSTICS v_custom = ROW_COUNT;

  DELETE FROM public.pontuacoes_unidades
  WHERE clube_id = p_clube_id AND data >= v_inicio AND data < v_fim;
  GET DIAGNOSTICS v_unidades = ROW_COUNT;

  DELETE FROM public.pontuacoes
  WHERE clube_id = p_clube_id AND data >= v_inicio AND data < v_fim;
  GET DIAGNOSTICS v_base = ROW_COUNT;

  RETURN jsonb_build_object(
    'ano', p_ano,
    'pontuacoes', v_base,
    'personalizadas', v_custom,
    'extras', v_extras,
    'unidades', v_unidades
  );
END;
$$;

REVOKE ALL ON FUNCTION public.zerar_pontuacao_clube(INTEGER, INTEGER, TEXT, TEXT, INTEGER, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.zerar_pontuacao_clube(INTEGER, INTEGER, TEXT, TEXT, INTEGER, NUMERIC) TO authenticated;
