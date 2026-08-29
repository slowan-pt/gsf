-- Cache de texto biblico, 1 linha por (capitulo do livro, idioma). So os
-- capitulos referenciados no plano do Ano Biblico (ou que um admin passou a
-- referenciar) precisam existir aqui - isto NAO e a Biblia inteira.
-- Traducoes de dominio publico apenas: Almeida (pt), KJV (en),
-- Louis Segond 1910 (fr), Reina-Valera 1909 (es).

CREATE TABLE IF NOT EXISTS public.ano_biblico_textos (
  id BIGSERIAL PRIMARY KEY,
  livro_abrev TEXT NOT NULL,
  capitulo INTEGER NOT NULL,
  idioma TEXT NOT NULL CHECK (idioma IN ('pt', 'en', 'fr', 'es')),
  versiculos JSONB NOT NULL,
  fonte TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ano_biblico_textos_unico
  ON public.ano_biblico_textos (livro_abrev, capitulo, idioma);

ALTER TABLE public.ano_biblico_textos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ano_biblico_textos_select" ON public.ano_biblico_textos;
CREATE POLICY "ano_biblico_textos_select"
ON public.ano_biblico_textos FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "ano_biblico_textos_admin" ON public.ano_biblico_textos;
CREATE POLICY "ano_biblico_textos_admin"
ON public.ano_biblico_textos FOR ALL TO authenticated
USING (
  public.current_user_is_admin_ti()
  OR EXISTS (
    SELECT 1 FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid() AND uc.ativo = TRUE
      AND uc.perfil IN ('admin_clube', 'admin_geral', 'admin_total')
  )
)
WITH CHECK (
  public.current_user_is_admin_ti()
  OR EXISTS (
    SELECT 1 FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid() AND uc.ativo = TRUE
      AND uc.perfil IN ('admin_clube', 'admin_geral', 'admin_total')
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ano_biblico_textos TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.ano_biblico_textos_id_seq TO authenticated;
