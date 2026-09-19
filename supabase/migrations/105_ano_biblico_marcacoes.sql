-- Marcação de versos do Ano Bíblico: pessoal por USUÁRIO (login), não por
-- dbv_id — sincroniza sozinho em qualquer aparelho em que a pessoa entrar,
-- mesmo raciocínio de configuracoes_visuais_usuario (088).

CREATE TABLE IF NOT EXISTS public.ano_biblico_marcacoes (
  id BIGSERIAL PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  livro_abrev TEXT NOT NULL,
  livro_nome TEXT NOT NULL,
  capitulo INTEGER NOT NULL,
  verso INTEGER NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ano_biblico_marcacoes_unico
  ON public.ano_biblico_marcacoes (usuario_id, livro_abrev, capitulo, verso);

CREATE INDEX IF NOT EXISTS idx_ano_biblico_marcacoes_usuario
  ON public.ano_biblico_marcacoes (usuario_id);

ALTER TABLE public.ano_biblico_marcacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ano_biblico_marcacoes_proprio" ON public.ano_biblico_marcacoes;
CREATE POLICY "ano_biblico_marcacoes_proprio"
ON public.ano_biblico_marcacoes FOR ALL TO authenticated
USING (usuario_id = auth.uid())
WITH CHECK (usuario_id = auth.uid());
