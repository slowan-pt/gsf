-- Progresso de leitura do Ano Biblico por membro/dia. Segue o mesmo padrao
-- de classes_requisitos_progresso: por clube+dbv, com UNIQUE para permitir
-- upsert idempotente do offline sync. "ano" existe para o mesmo plano poder
-- ser reusado em anos seguintes sem misturar o progresso de um ano com outro.

CREATE TABLE IF NOT EXISTS public.ano_biblico_progresso (
  id BIGSERIAL PRIMARY KEY,
  clube_id INTEGER NOT NULL REFERENCES public.clubes(id) ON DELETE CASCADE,
  dbv_id INTEGER NOT NULL REFERENCES public.desbravadores(id) ON DELETE CASCADE,
  ano_biblico_catalogo_id BIGINT NOT NULL REFERENCES public.ano_biblico_catalogo(id) ON DELETE CASCADE,
  ano INTEGER NOT NULL,
  lido BOOLEAN NOT NULL DEFAULT TRUE,
  tempo_tela_segundos INTEGER,
  chegou_ao_fim BOOLEAN NOT NULL DEFAULT FALSE,
  lido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clube_id, dbv_id, ano_biblico_catalogo_id, ano)
);

CREATE INDEX IF NOT EXISTS idx_ano_biblico_progresso_dbv
  ON public.ano_biblico_progresso (clube_id, dbv_id, ano);

ALTER TABLE public.ano_biblico_progresso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ano_biblico_progresso_select" ON public.ano_biblico_progresso;
CREATE POLICY "ano_biblico_progresso_select"
ON public.ano_biblico_progresso FOR SELECT TO authenticated
USING (
  public.current_user_has_clube(clube_id)
  OR public.current_user_dbv_id() = dbv_id
  OR public.current_user_is_responsavel_membro(dbv_id)
);

-- Grava: o proprio membro/responsavel (marcando a propria leitura), ou quem
-- administra o clube (correcao manual/relatorios).
DROP POLICY IF EXISTS "ano_biblico_progresso_manage" ON public.ano_biblico_progresso;
CREATE POLICY "ano_biblico_progresso_manage"
ON public.ano_biblico_progresso FOR ALL TO authenticated
USING (
  public.current_user_dbv_id() = dbv_id
  OR public.current_user_is_responsavel_membro(dbv_id)
  OR public.current_user_is_admin_ti()
  OR EXISTS (
    SELECT 1 FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid() AND uc.clube_id = ano_biblico_progresso.clube_id
      AND uc.ativo = TRUE AND uc.perfil IN ('admin_clube', 'admin_geral', 'admin_total', 'usuario_secretaria')
  )
)
WITH CHECK (
  public.current_user_dbv_id() = dbv_id
  OR public.current_user_is_responsavel_membro(dbv_id)
  OR public.current_user_is_admin_ti()
  OR EXISTS (
    SELECT 1 FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid() AND uc.clube_id = ano_biblico_progresso.clube_id
      AND uc.ativo = TRUE AND uc.perfil IN ('admin_clube', 'admin_geral', 'admin_total', 'usuario_secretaria')
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ano_biblico_progresso TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.ano_biblico_progresso_id_seq TO authenticated;
