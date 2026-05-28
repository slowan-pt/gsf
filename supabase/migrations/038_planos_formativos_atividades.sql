-- Planos formativos permitem que uma classe/especialidade exija varias
-- atividades, cadastradas em dias diferentes, antes da investidura.
CREATE TABLE IF NOT EXISTS public.planos_formativos (
  id BIGSERIAL PRIMARY KEY,
  clube_id INTEGER NOT NULL REFERENCES public.clubes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('classe', 'especialidade')),
  item_nome TEXT NOT NULL,
  titulo TEXT NOT NULL,
  avaliacoes_necessarias INTEGER NOT NULL DEFAULT 1 CHECK (avaliacoes_necessarias > 0),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planos_formativos_clube_item
  ON public.planos_formativos (clube_id, tipo, item_nome, ativo);

ALTER TABLE public.atividades
  ADD COLUMN IF NOT EXISTS plano_formativo_id BIGINT REFERENCES public.planos_formativos(id) ON DELETE SET NULL;

ALTER TABLE public.especialidades
  ADD COLUMN IF NOT EXISTS plano_formativo_id BIGINT REFERENCES public.planos_formativos(id) ON DELETE SET NULL;

ALTER TABLE public.investidura_itens
  ADD COLUMN IF NOT EXISTS plano_formativo_id BIGINT REFERENCES public.planos_formativos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_atividades_plano_formativo
  ON public.atividades (clube_id, plano_formativo_id)
  WHERE plano_formativo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_especialidades_plano_formativo
  ON public.especialidades (clube_id, plano_formativo_id)
  WHERE plano_formativo_id IS NOT NULL;

ALTER TABLE public.planos_formativos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planos_formativos_select_contexto" ON public.planos_formativos;
CREATE POLICY "planos_formativos_select_contexto"
ON public.planos_formativos
FOR SELECT
TO authenticated
USING (
  public.current_user_can_manage_atividades(clube_id)
  OR EXISTS (
    SELECT 1
    FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid()
      AND uc.clube_id = planos_formativos.clube_id
      AND uc.ativo = TRUE
  )
);

DROP POLICY IF EXISTS "planos_formativos_manage_contexto" ON public.planos_formativos;
CREATE POLICY "planos_formativos_manage_contexto"
ON public.planos_formativos
FOR ALL
TO authenticated
USING (public.current_user_can_manage_atividades(clube_id))
WITH CHECK (public.current_user_can_manage_atividades(clube_id));
