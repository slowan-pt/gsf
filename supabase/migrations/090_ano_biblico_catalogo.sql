-- Catalogo global do plano de leitura "Ano Biblico": 1 linha por dia do
-- calendario (mes/dia), com o livro/capitulo/versiculos daquele dia. E
-- global (nao por clube) mas EDITAVEL por admin_ti/admin_clube.
--
-- 28/fev tem DUAS linhas (ano_bissexto=false com o capitulo inteiro,
-- ano_bissexto=true com a primeira metade) e 29/fev tem UMA linha (so
-- existe com ano_bissexto=true, com a segunda metade) - dividido assim
-- porque o plano original (fonte: PDF do usuario) nao previa 29/fev.

CREATE TABLE IF NOT EXISTS public.ano_biblico_catalogo (
  id BIGSERIAL PRIMARY KEY,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  dia INTEGER NOT NULL CHECK (dia BETWEEN 1 AND 31),
  ano_bissexto BOOLEAN NOT NULL DEFAULT FALSE,
  ordem_no_ano INTEGER NOT NULL,
  livro_abrev TEXT NOT NULL,
  livro_nome TEXT NOT NULL,
  referencia TEXT NOT NULL,
  passagens JSONB NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  editado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ano_biblico_catalogo_dia
  ON public.ano_biblico_catalogo (mes, dia, ano_bissexto);

CREATE INDEX IF NOT EXISTS idx_ano_biblico_catalogo_ordem
  ON public.ano_biblico_catalogo (ordem_no_ano) WHERE ativo = TRUE;

ALTER TABLE public.ano_biblico_catalogo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ano_biblico_catalogo_select" ON public.ano_biblico_catalogo;
CREATE POLICY "ano_biblico_catalogo_select"
ON public.ano_biblico_catalogo FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "ano_biblico_catalogo_admin" ON public.ano_biblico_catalogo;
CREATE POLICY "ano_biblico_catalogo_admin"
ON public.ano_biblico_catalogo FOR ALL TO authenticated
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ano_biblico_catalogo TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.ano_biblico_catalogo_id_seq TO authenticated;
