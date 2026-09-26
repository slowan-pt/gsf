-- 120_fix_security_advisor.sql
-- Corrige os 3 avisos criticos do Security Advisor do Supabase:
-- 1 e 2. RLS de public.usuarios confiava em user_metadata (editavel pelo proprio
--        usuario via auth.updateUser), permitindo auto-promocao a admin.
--        Mantem apenas app_metadata (so o servidor altera), admin_ti e usuario_clubes.
-- 3. View public.v_membros era SECURITY DEFINER e ignorava o RLS de membros.

-- ─── 1. SELECT em usuarios ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "usuarios_select_self_or_admin" ON public.usuarios;

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
  OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'perfil', '') IN (
    'admin_geral', 'admin_total', 'admin_diretoria'
  )
);

-- ─── 2. UPDATE em usuarios ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "usuarios_update_admin" ON public.usuarios;

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
  OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'perfil', '') IN (
    'admin_geral', 'admin_total', 'admin_diretoria'
  )
);

-- ─── 3. v_membros passa a respeitar o RLS de quem consulta ───────────────────
ALTER VIEW public.v_membros SET (security_invoker = on);
