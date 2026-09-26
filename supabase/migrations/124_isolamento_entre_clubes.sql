-- 124_isolamento_entre_clubes.sql
-- Fecha o acesso entre clubes nas tabelas de dados:
--  * escrita: as políticas admin_all_* usavam is_admin(), que vale para qualquer
--    equipe (admin/diretoria/secretaria/conselheiro/instrutor) de QUALQUER clube.
--    Passam a exigir a equipe do clube da própria linha (is_staff_clube).
--  * leitura: authenticated_select_* liberava tudo para qualquer usuário logado.
--    Passa a valer só para quem tem vínculo com o clube da linha (inclui pais/
--    responsáveis), via current_user_has_clube.
-- Não mexe em eventos (SELECT): public_select_eventos é público de propósito
-- (menus sem login) e fica como está. Rollback em 124_rollback.sql (não versionado).

CREATE OR REPLACE FUNCTION public.is_staff_clube(target_clube_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_is_admin_ti()
  OR EXISTS (
    SELECT 1
    FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid()
      AND uc.clube_id = target_clube_id
      AND uc.ativo = TRUE
      AND uc.perfil IN (
        'admin_ti', 'admin_clube', 'usuario_diretoria',
        'usuario_secretaria', 'usuario_conselheiro', 'usuario_instrutor'
      )
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_staff_clube(integer) TO authenticated;

-- ─── desbravadores ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_desbravadores" ON public.desbravadores;
DROP POLICY IF EXISTS "authenticated_select_desbravadores" ON public.desbravadores;
CREATE POLICY "desbravadores_staff_clube_all" ON public.desbravadores
  FOR ALL TO authenticated
  USING (public.is_staff_clube(clube_id::integer))
  WITH CHECK (public.is_staff_clube(clube_id::integer));
CREATE POLICY "desbravadores_select_clube" ON public.desbravadores
  FOR SELECT TO authenticated
  USING (public.current_user_has_clube(clube_id::integer));

-- ─── pontuacoes ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_pontuacoes" ON public.pontuacoes;
DROP POLICY IF EXISTS "authenticated_select_pontuacoes" ON public.pontuacoes;
CREATE POLICY "pontuacoes_staff_clube_all" ON public.pontuacoes
  FOR ALL TO authenticated
  USING (public.is_staff_clube(clube_id::integer))
  WITH CHECK (public.is_staff_clube(clube_id::integer));
CREATE POLICY "pontuacoes_select_clube" ON public.pontuacoes
  FOR SELECT TO authenticated
  USING (public.current_user_has_clube(clube_id::integer));

-- ─── progresso_classes ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_progresso_classes" ON public.progresso_classes;
DROP POLICY IF EXISTS "authenticated_select_progresso_classes" ON public.progresso_classes;
CREATE POLICY "progresso_classes_staff_clube_all" ON public.progresso_classes
  FOR ALL TO authenticated
  USING (public.is_staff_clube(clube_id::integer))
  WITH CHECK (public.is_staff_clube(clube_id::integer));
CREATE POLICY "progresso_classes_select_clube" ON public.progresso_classes
  FOR SELECT TO authenticated
  USING (public.current_user_has_clube(clube_id::integer));

-- ─── eventos (só escrita; a leitura pública continua) ────────────────────────
DROP POLICY IF EXISTS "admin_all_eventos" ON public.eventos;
CREATE POLICY "eventos_staff_clube_all" ON public.eventos
  FOR ALL TO authenticated
  USING (public.is_staff_clube(clube_id::integer))
  WITH CHECK (public.is_staff_clube(clube_id::integer));

-- ─── documentos ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_documentos" ON public.documentos;
DROP POLICY IF EXISTS "admin_or_owner_select_documentos" ON public.documentos;
CREATE POLICY "documentos_staff_clube_all" ON public.documentos
  FOR ALL TO authenticated
  USING (public.is_staff_clube(clube_id::integer))
  WITH CHECK (public.is_staff_clube(clube_id::integer));
CREATE POLICY "documentos_select_clube_ou_proprio" ON public.documentos
  FOR SELECT TO authenticated
  USING (public.is_staff_clube(clube_id::integer) OR dbv_id = public.current_user_dbv_id());
