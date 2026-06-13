-- Pontuação lançada diretamente para unidades.
-- O ranking de unidades soma esta tabela com a soma dos membros vinculados à unidade.

CREATE TABLE IF NOT EXISTS public.pontuacoes_unidades (
  id BIGSERIAL PRIMARY KEY,
  clube_id INTEGER NOT NULL REFERENCES public.clubes(id) ON DELETE CASCADE,
  programa_id INTEGER REFERENCES public.programas(id) ON DELETE SET NULL,
  unidade_id INTEGER REFERENCES public.unidades(id) ON DELETE SET NULL,
  unidade_nome TEXT NOT NULL,
  data DATE NOT NULL,
  pontos INTEGER NOT NULL DEFAULT 0,
  descricao TEXT NOT NULL,
  lancado_por TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pontuacoes_unidades_clube_data_idx
  ON public.pontuacoes_unidades (clube_id, data DESC);

CREATE INDEX IF NOT EXISTS pontuacoes_unidades_unidade_idx
  ON public.pontuacoes_unidades (clube_id, unidade_id, unidade_nome);

ALTER TABLE public.pontuacoes_unidades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pontuacoes_unidades_select_clube" ON public.pontuacoes_unidades;
DROP POLICY IF EXISTS "pontuacoes_unidades_admin_all" ON public.pontuacoes_unidades;

CREATE POLICY "pontuacoes_unidades_select_clube"
ON public.pontuacoes_unidades
FOR SELECT
TO authenticated
USING (public.current_user_has_clube(clube_id));

CREATE POLICY "pontuacoes_unidades_admin_all"
ON public.pontuacoes_unidades
FOR ALL
TO authenticated
USING (public.current_user_has_clube(clube_id) AND public.is_admin())
WITH CHECK (public.current_user_has_clube(clube_id) AND public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pontuacoes_unidades TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.pontuacoes_unidades_id_seq TO authenticated;
