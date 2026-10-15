-- 152_menus_ocultos_por_perfil.sql
-- Menus da tela Início que o admin do clube esconde de cada tipo de perfil.
-- Formato: {"usuario_desbravador": ["aparencia", "extras"], "usuario_pais": [...]}
-- Vale só para a interface (esconde o atalho); não mexe nas permissões do banco.
ALTER TABLE public.clubes
  ADD COLUMN IF NOT EXISTS menus_ocultos JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.clubes.menus_ocultos IS
  'Atalhos da Início ocultos por perfil: {"<perfil>": ["<id do atalho>", ...]}.';
