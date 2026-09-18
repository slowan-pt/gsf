-- Configuração por clube de visibilidade do ranking: quem pode ver a lista
-- completa (diretoria e/ou membros em geral) e quais tipos de ranking
-- (DBV, Diretoria, Conselheiros, Unidades) ficam disponíveis.
--
-- Quando "visivel_membros" está desligado, membros comuns (desbravadores,
-- aventureiros, pais/responsáveis) continuam vendo a própria posição e
-- pontos, e podem abrir o próprio extrato — só a lista completa fica
-- escondida. Isso é decidido no app (app/(tabs)/ranking.tsx), não aqui.

CREATE TABLE IF NOT EXISTS public.config_ranking (
  clube_id INTEGER PRIMARY KEY REFERENCES public.clubes(id) ON DELETE CASCADE,
  visivel_diretoria BOOLEAN NOT NULL DEFAULT true,
  visivel_membros BOOLEAN NOT NULL DEFAULT true,
  tipo_dbv BOOLEAN NOT NULL DEFAULT true,
  tipo_diretoria BOOLEAN NOT NULL DEFAULT true,
  tipo_conselheiros BOOLEAN NOT NULL DEFAULT true,
  tipo_unidades BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.config_ranking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "config_ranking_select_clube" ON public.config_ranking;
CREATE POLICY "config_ranking_select_clube"
ON public.config_ranking FOR SELECT
USING (public.current_user_has_clube(clube_id));

DROP POLICY IF EXISTS "config_ranking_admin_all" ON public.config_ranking;
CREATE POLICY "config_ranking_admin_all"
ON public.config_ranking FOR ALL
USING (public.current_user_can_admin_clube(clube_id))
WITH CHECK (public.current_user_can_admin_clube(clube_id));

GRANT SELECT, INSERT, UPDATE ON public.config_ranking TO authenticated;
