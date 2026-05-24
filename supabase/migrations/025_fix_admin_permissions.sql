-- 025_fix_admin_permissions.sql
-- Corrige permissoes para perfis novos (admin_ti, admin_clube):
-- 1. resetar_mfa_usuario aceitava apenas nomes antigos de perfil
-- 2. RLS SELECT/UPDATE em usuarios bloqueava admins com perfis novos no JWT

-- ─── 1. Atualiza resetar_mfa_usuario ─────────────────────────────────────────
-- Antes: verificava apenas usuarios.perfil IN ('admin_total','admin_geral')
-- Agora: aceita admin_ti e admin_clube via usuario_clubes (robusto) + legado
CREATE OR REPLACE FUNCTION public.resetar_mfa_usuario(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  pode_admin boolean;
BEGIN
  SELECT
    public.current_user_is_admin_ti()
    OR EXISTS (
      SELECT 1 FROM public.usuario_clubes uc
      WHERE uc.usuario_id = auth.uid()
        AND uc.ativo = TRUE
        AND uc.perfil IN ('admin_clube', 'admin_geral')
    )
    OR EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid()
        AND u.perfil IN ('admin_total', 'admin_geral', 'admin_ti', 'admin_clube')
    )
  INTO pode_admin;

  IF NOT COALESCE(pode_admin, false) THEN
    RAISE EXCEPTION 'Apenas admin_ti ou admin_clube pode resetar MFA.';
  END IF;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário inválido.';
  END IF;

  DELETE FROM auth.mfa_factors
   WHERE user_id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resetar_mfa_usuario(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resetar_mfa_usuario(uuid) TO authenticated;


-- ─── 2. Atualiza RLS SELECT em usuarios ──────────────────────────────────────
-- Antes: só via JWT com perfil antigo (admin_geral, admin_diretoria)
-- Agora: inclui current_user_is_admin_ti() e admin_clube via usuario_clubes
DROP POLICY IF EXISTS "usuarios_select_self_or_admin_jwt" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_select_self_or_admin"     ON public.usuarios;

CREATE POLICY "usuarios_select_self_or_admin"
ON public.usuarios
FOR SELECT
USING (
  id = auth.uid()
  OR public.current_user_is_admin_ti()
  OR EXISTS (
    SELECT 1 FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid()
      AND uc.ativo = TRUE
      AND uc.perfil = 'admin_clube'
  )
  OR COALESCE(auth.jwt() -> 'user_metadata' ->> 'perfil', '') IN (
    'admin_geral', 'admin_total', 'admin_diretoria'
  )
  OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'perfil', '') IN (
    'admin_geral', 'admin_total', 'admin_diretoria'
  )
);


-- ─── 3. Atualiza RLS UPDATE em usuarios ──────────────────────────────────────
-- Antes: só via JWT com perfil antigo (admin_geral, admin_diretoria)
-- Agora: inclui admin_ti e admin_clube via usuario_clubes
DROP POLICY IF EXISTS "usuarios_update_admin_jwt" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update_admin"     ON public.usuarios;

CREATE POLICY "usuarios_update_admin"
ON public.usuarios
FOR UPDATE
USING (
  public.current_user_is_admin_ti()
  OR EXISTS (
    SELECT 1 FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid()
      AND uc.ativo = TRUE
      AND uc.perfil = 'admin_clube'
  )
  OR COALESCE(auth.jwt() -> 'user_metadata' ->> 'perfil', '') IN (
    'admin_geral', 'admin_total', 'admin_diretoria'
  )
  OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'perfil', '') IN (
    'admin_geral', 'admin_total', 'admin_diretoria'
  )
)
WITH CHECK (
  public.current_user_is_admin_ti()
  OR EXISTS (
    SELECT 1 FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid()
      AND uc.ativo = TRUE
      AND uc.perfil = 'admin_clube'
  )
  OR COALESCE(auth.jwt() -> 'user_metadata' ->> 'perfil', '') IN (
    'admin_geral', 'admin_total', 'admin_diretoria'
  )
  OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'perfil', '') IN (
    'admin_geral', 'admin_total', 'admin_diretoria'
  )
);
