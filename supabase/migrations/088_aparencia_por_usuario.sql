-- Corrige o design da aparência: em vez de um tema por CLUBE (que qualquer
-- membro alterando afetava todo mundo — migração 087, revertida aqui), cada
-- USUÁRIO guarda sua própria preferência de paleta/fonte das atividades.
-- Escolher uma cor só muda a própria visualização, em qualquer aparelho em
-- que a pessoa fizer login; não reflete pra ninguém mais.

CREATE TABLE IF NOT EXISTS public.configuracoes_visuais_usuario (
  usuario_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  paleta_atividades TEXT NOT NULL DEFAULT 'viva',
  cores_atividades JSONB,
  fonte_atividades TEXT NOT NULL DEFAULT 'padrao',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.configuracoes_visuais_usuario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "config_visual_usuario_proprio" ON public.configuracoes_visuais_usuario;
CREATE POLICY "config_visual_usuario_proprio"
ON public.configuracoes_visuais_usuario FOR ALL TO authenticated
USING (usuario_id = auth.uid())
WITH CHECK (usuario_id = auth.uid());

-- Reverte a liberação por clube da migração 087 — a política de SELECT
-- "config_visual_select_contexto" (039) continua valendo; só a escrita
-- volta a ser restrita a admin. A tabela de clube deixa de ser usada pelo
-- app (fica no banco por segurança, sem DROP).
DROP POLICY IF EXISTS "config_visual_membros_all" ON public.configuracoes_visuais_clube;
CREATE POLICY "config_visual_admin_all"
ON public.configuracoes_visuais_clube FOR ALL TO authenticated
USING (public.current_user_can_admin_clube(clube_id))
WITH CHECK (public.current_user_can_admin_clube(clube_id));
