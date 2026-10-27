-- 153_config_ler_hoje.sql
-- Configuração por clube do botão "Ler hoje": som das batidas da bolinha e lembrete diário de estudo.
-- Quem edita é definido em Permissões -> Administrar clube -> "Ler hoje" (admin_clube.ler_hoje);
-- o Admin TI sempre pode. Todos os usuários do clube leem a configuração.
-- Requer a migration 149 (perfil_tem_acao).

CREATE TABLE IF NOT EXISTS public.config_ler_hoje (
  clube_id INTEGER PRIMARY KEY REFERENCES public.clubes(id) ON DELETE CASCADE,
  som_ativo BOOLEAN NOT NULL DEFAULT true,
  som_url TEXT,
  lembrete_ativo BOOLEAN NOT NULL DEFAULT true,
  lembrete_hora SMALLINT NOT NULL DEFAULT 19 CHECK (lembrete_hora BETWEEN 0 AND 23),
  lembrete_minuto SMALLINT NOT NULL DEFAULT 0 CHECK (lembrete_minuto BETWEEN 0 AND 59),
  lembrete_titulo TEXT NOT NULL DEFAULT 'Hora do estudo 📖',
  lembrete_texto TEXT NOT NULL DEFAULT 'Sua leitura de hoje está esperando. Toque para ler agora.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.config_ler_hoje ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "config_ler_hoje_select_clube" ON public.config_ler_hoje;
CREATE POLICY "config_ler_hoje_select_clube"
ON public.config_ler_hoje FOR SELECT
USING (public.current_user_has_clube(clube_id));

DROP POLICY IF EXISTS "config_ler_hoje_editar" ON public.config_ler_hoje;
CREATE POLICY "config_ler_hoje_editar"
ON public.config_ler_hoje FOR ALL
USING (public.perfil_tem_acao(clube_id, 'admin_clube', 'ler_hoje'))
WITH CHECK (public.perfil_tem_acao(clube_id, 'admin_clube', 'ler_hoje'));

GRANT SELECT, INSERT, UPDATE ON public.config_ler_hoje TO authenticated;
