-- 128_bloqueia_auto_promocao.sql
-- usuario_clubes_admin_all deixava o admin_clube do clube criar/alterar vínculos
-- com QUALQUER perfil, inclusive 'admin_ti' (que dá acesso total à plataforma via
-- current_user_is_admin_ti). Basta o admin_clube inserir/atualizar uma linha dele
-- mesmo com perfil admin_ti para virar Admin TI. Agora só o Admin TI cria, altera
-- ou apaga vínculos de perfil de plataforma (admin_ti, admin_total, admin_geral).
-- O admin do clube segue gerenciando os demais perfis do próprio clube.

DROP POLICY IF EXISTS "usuario_clubes_admin_all" ON public.usuario_clubes;
CREATE POLICY "usuario_clubes_admin_all" ON public.usuario_clubes
  FOR ALL TO authenticated
  USING (
    public.current_user_is_admin_ti()
    OR (
      public.current_user_can_admin_clube(clube_id)
      AND COALESCE(perfil, '') NOT IN ('admin_ti', 'admin_total', 'admin_geral')
    )
  )
  WITH CHECK (
    public.current_user_is_admin_ti()
    OR (
      public.current_user_can_admin_clube(clube_id)
      AND COALESCE(perfil, '') NOT IN ('admin_ti', 'admin_total', 'admin_geral')
    )
  );
