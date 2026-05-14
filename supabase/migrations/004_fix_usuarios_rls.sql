-- Corrige recursão infinita nas políticas da tabela usuarios.
-- O problema acontece quando uma policy de usuarios consulta a própria tabela usuarios.

DROP POLICY IF EXISTS "usuario_le_proprio" ON public.usuarios;
DROP POLICY IF EXISTS "admin_geral_le_usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_select_self_or_admin_jwt" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update_admin_jwt" ON public.usuarios;

CREATE POLICY "usuarios_select_self_or_admin_jwt"
ON public.usuarios
FOR SELECT
USING (
  id = auth.uid()
  OR COALESCE(auth.jwt() -> 'user_metadata' ->> 'perfil', '') IN ('admin_geral', 'admin_diretoria')
  OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'perfil', '') IN ('admin_geral', 'admin_diretoria')
);

CREATE POLICY "usuarios_update_admin_jwt"
ON public.usuarios
FOR UPDATE
USING (
  COALESCE(auth.jwt() -> 'user_metadata' ->> 'perfil', '') IN ('admin_geral', 'admin_diretoria')
  OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'perfil', '') IN ('admin_geral', 'admin_diretoria')
)
WITH CHECK (
  COALESCE(auth.jwt() -> 'user_metadata' ->> 'perfil', '') IN ('admin_geral', 'admin_diretoria')
  OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'perfil', '') IN ('admin_geral', 'admin_diretoria')
);
