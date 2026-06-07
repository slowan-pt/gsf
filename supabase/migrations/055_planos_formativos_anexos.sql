-- Anexos reutilizaveis em modelos formativos.
-- Podem ficar ligados ao modelo inteiro ou a um item/requisito especifico.

CREATE TABLE IF NOT EXISTS public.planos_formativos_anexos (
  id BIGSERIAL PRIMARY KEY,
  plano_formativo_id BIGINT NOT NULL REFERENCES public.planos_formativos(id) ON DELETE CASCADE,
  plano_formativo_item_id BIGINT REFERENCES public.planos_formativos_itens(id) ON DELETE CASCADE,
  clube_id INTEGER NOT NULL REFERENCES public.clubes(id) ON DELETE CASCADE,
  escopo TEXT NOT NULL DEFAULT 'item' CHECK (escopo IN ('modelo', 'item')),
  item_ordem INTEGER,
  nome TEXT NOT NULL,
  url TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'outro',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planos_formativos_anexos_plano
  ON public.planos_formativos_anexos (plano_formativo_id, escopo, item_ordem);

ALTER TABLE public.planos_formativos_anexos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planos_formativos_anexos_select_contexto" ON public.planos_formativos_anexos;
CREATE POLICY "planos_formativos_anexos_select_contexto"
ON public.planos_formativos_anexos
FOR SELECT
TO authenticated
USING (
  public.current_user_has_clube(clube_id)
);

DROP POLICY IF EXISTS "planos_formativos_anexos_manage_contexto" ON public.planos_formativos_anexos;
CREATE POLICY "planos_formativos_anexos_manage_contexto"
ON public.planos_formativos_anexos
FOR ALL
TO authenticated
USING (
  public.current_user_is_admin_ti()
  OR EXISTS (
    SELECT 1
    FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid()
      AND uc.clube_id = planos_formativos_anexos.clube_id
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
      AND uc.clube_id = planos_formativos_anexos.clube_id
      AND uc.ativo = TRUE
      AND uc.perfil IN ('admin_clube', 'usuario_secretaria', 'admin_total', 'admin_geral')
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planos_formativos_anexos TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.planos_formativos_anexos_id_seq TO authenticated;
