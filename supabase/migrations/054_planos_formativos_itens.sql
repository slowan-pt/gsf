-- Itens/requisitos reutilizaveis dentro de um plano formativo.
-- O plano continua sendo a regra que libera classe/especialidade; os itens
-- alimentam os blocos de atividades quando o avaliador usa um modelo pronto.

ALTER TABLE public.planos_formativos
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS modelo_padrao BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS public.planos_formativos_itens (
  id BIGSERIAL PRIMARY KEY,
  plano_formativo_id BIGINT NOT NULL REFERENCES public.planos_formativos(id) ON DELETE CASCADE,
  clube_id INTEGER NOT NULL REFERENCES public.clubes(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 1,
  titulo TEXT NOT NULL,
  descricao TEXT,
  obrigatorio BOOLEAN NOT NULL DEFAULT TRUE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planos_formativos_itens_plano
  ON public.planos_formativos_itens (plano_formativo_id, ordem)
  WHERE ativo = TRUE;

ALTER TABLE public.planos_formativos_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planos_formativos_select_contexto" ON public.planos_formativos;
CREATE POLICY "planos_formativos_select_contexto"
ON public.planos_formativos
FOR SELECT
TO authenticated
USING (
  public.current_user_has_clube(clube_id)
);

DROP POLICY IF EXISTS "planos_formativos_manage_contexto" ON public.planos_formativos;
CREATE POLICY "planos_formativos_manage_contexto"
ON public.planos_formativos
FOR ALL
TO authenticated
USING (
  public.current_user_is_admin_ti()
  OR EXISTS (
    SELECT 1
    FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid()
      AND uc.clube_id = planos_formativos.clube_id
      AND uc.ativo = TRUE
      AND uc.perfil IN ('admin_clube', 'usuario_secretaria', 'admin_total', 'admin_geral')
  )
)
WITH CHECK (
  public.current_user_is_admin_ti()
  OR EXISTS (
    SELECT 1
    FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid()
      AND uc.clube_id = planos_formativos.clube_id
      AND uc.ativo = TRUE
      AND uc.perfil IN ('admin_clube', 'usuario_secretaria', 'admin_total', 'admin_geral')
  )
);

DROP POLICY IF EXISTS "planos_formativos_itens_select_contexto" ON public.planos_formativos_itens;
CREATE POLICY "planos_formativos_itens_select_contexto"
ON public.planos_formativos_itens
FOR SELECT
TO authenticated
USING (
  public.current_user_has_clube(clube_id)
);

DROP POLICY IF EXISTS "planos_formativos_itens_manage_contexto" ON public.planos_formativos_itens;
CREATE POLICY "planos_formativos_itens_manage_contexto"
ON public.planos_formativos_itens
FOR ALL
TO authenticated
USING (
  public.current_user_is_admin_ti()
  OR EXISTS (
    SELECT 1
    FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid()
      AND uc.clube_id = planos_formativos_itens.clube_id
      AND uc.ativo = TRUE
      AND uc.perfil IN ('admin_clube', 'usuario_secretaria', 'admin_total', 'admin_geral')
  )
)
WITH CHECK (
  public.current_user_is_admin_ti()
  OR EXISTS (
    SELECT 1
    FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid()
      AND uc.clube_id = planos_formativos_itens.clube_id
      AND uc.ativo = TRUE
      AND uc.perfil IN ('admin_clube', 'usuario_secretaria', 'admin_total', 'admin_geral')
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planos_formativos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planos_formativos_itens TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.planos_formativos_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.planos_formativos_itens_id_seq TO authenticated;
