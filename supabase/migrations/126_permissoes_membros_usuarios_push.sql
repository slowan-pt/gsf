-- 126_permissoes_membros_usuarios_push.sql
-- Regras por perfil DENTRO do clube (a 124/125 isolaram um clube do outro):
--  * Membros (desbravadores): cadastrar, inativar, excluir e editar tudo =
--    admin_ti, admin_clube e secretaria do clube. Diretoria, instrutor e
--    conselheiro só leem. O conselheiro edita apenas nome, contato, e-mail,
--    camisa, calça e anexos de documentos dos membros da PRÓPRIA unidade
--    (política ficha_update_responsavel_ou_conselheiro, já existente); unidade,
--    cargo, situação (ativo), ID SGC e dados do responsável ficam protegidos por
--    trigger para quem não é gestor.
--  * usuarios: cada gestor só lê/altera contas ligadas ao seu clube e ninguém,
--    exceto o Admin TI, concede perfil admin_ti/admin_total/admin_geral.
--  * push_tokens: só o dono altera; leitura e exclusão em massa só de gestor no
--    clube do dono do token; qualquer um apaga o próprio.
-- Rollback em 126_rollback.sql (não versionado).

-- ─── Gestor de membros do clube ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_manage_members_clube(target_clube_id integer)
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
      AND uc.perfil IN ('admin_ti', 'admin_clube', 'admin_total', 'admin_geral', 'usuario_secretaria')
  )
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_members_clube(integer) TO authenticated;

-- Documentos: a versão anterior também aceitava o perfil global de usuarios.perfil
-- (valia em QUALQUER clube). Passa a valer só para o gestor do clube da linha.
CREATE OR REPLACE FUNCTION public.current_user_can_manage_docs_clube(target_clube_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_manage_members_clube(target_clube_id)
$$;

-- ─── desbravadores ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "desbravadores_staff_clube_all" ON public.desbravadores;
DROP POLICY IF EXISTS "desbravadores_gestao_all" ON public.desbravadores;
CREATE POLICY "desbravadores_gestao_all" ON public.desbravadores
  FOR ALL TO authenticated
  USING (public.can_manage_members_clube(clube_id::integer))
  WITH CHECK (public.can_manage_members_clube(clube_id::integer));

CREATE OR REPLACE FUNCTION public.desbravadores_protege_campos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sem usuário no JWT (service role / SQL Editor): não interfere.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.can_manage_members_clube(OLD.clube_id::integer) THEN
    RETURN NEW;
  END IF;

  IF NEW.clube_id IS DISTINCT FROM OLD.clube_id
     OR NEW.unidade_id IS DISTINCT FROM OLD.unidade_id
     OR NEW.unidade_nome IS DISTINCT FROM OLD.unidade_nome
     OR NEW.cargo IS DISTINCT FROM OLD.cargo
     OR NEW.cargo_adicional IS DISTINCT FROM OLD.cargo_adicional
     OR NEW.ativo IS DISTINCT FROM OLD.ativo
     OR NEW.id_sgc IS DISTINCT FROM OLD.id_sgc THEN
    RAISE EXCEPTION 'Sem permissão para alterar unidade, cargo, situação ou ID SGC do membro.'
      USING ERRCODE = '42501';
  END IF;

  -- Dados do responsável: só o próprio membro ou o responsável vinculado (não o conselheiro).
  IF (NEW.nome_responsavel IS DISTINCT FROM OLD.nome_responsavel
      OR NEW.contato_responsavel IS DISTINCT FROM OLD.contato_responsavel)
     AND OLD.id IS DISTINCT FROM public.current_user_dbv_id()
     AND NOT public.current_user_is_responsavel_membro(OLD.id) THEN
    RAISE EXCEPTION 'Sem permissão para alterar os dados do responsável.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_desbravadores_protege_campos ON public.desbravadores;
CREATE TRIGGER trg_desbravadores_protege_campos
  BEFORE UPDATE ON public.desbravadores
  FOR EACH ROW EXECUTE FUNCTION public.desbravadores_protege_campos();

-- ─── documentos (tabela de status legada) ───────────────────────────────────
DROP POLICY IF EXISTS "documentos_staff_clube_all" ON public.documentos;
DROP POLICY IF EXISTS "documentos_gestao_all" ON public.documentos;
CREATE POLICY "documentos_gestao_all" ON public.documentos
  FOR ALL TO authenticated
  USING (public.can_manage_members_clube(clube_id::integer))
  WITH CHECK (public.can_manage_members_clube(clube_id::integer));

-- ─── usuarios ───────────────────────────────────────────────────────────────
-- Conta sem nenhum vínculo ainda (recém-criada pelo cadastro de acesso) pode ser
-- completada por qualquer gestor; depois do vínculo, só o gestor do clube dela.
DROP POLICY IF EXISTS "usuarios_select_self_or_admin" ON public.usuarios;
CREATE POLICY "usuarios_select_self_or_admin" ON public.usuarios
  FOR SELECT
  USING (
    id = auth.uid()
    OR public.current_user_is_admin_ti()
    OR EXISTS (
      SELECT 1 FROM public.usuario_clubes t
      WHERE t.usuario_id = usuarios.id AND t.ativo = TRUE
        AND public.can_manage_members_clube(t.clube_id::integer)
    )
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'perfil', '') IN ('admin_geral', 'admin_total')
  );

DROP POLICY IF EXISTS "usuarios_update_admin" ON public.usuarios;
CREATE POLICY "usuarios_update_admin" ON public.usuarios
  FOR UPDATE
  USING (
    public.current_user_is_admin_ti()
    OR EXISTS (
      SELECT 1 FROM public.usuario_clubes t
      WHERE t.usuario_id = usuarios.id AND t.ativo = TRUE
        AND public.can_manage_members_clube(t.clube_id::integer)
    )
    OR (
      NOT EXISTS (SELECT 1 FROM public.usuario_clubes t WHERE t.usuario_id = usuarios.id)
      AND EXISTS (
        SELECT 1 FROM public.usuario_clubes g
        WHERE g.usuario_id = auth.uid() AND g.ativo = TRUE
          AND g.perfil IN ('admin_ti', 'admin_clube', 'admin_total', 'admin_geral', 'usuario_secretaria')
      )
    )
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'perfil', '') IN ('admin_geral', 'admin_total')
  )
  WITH CHECK (
    public.current_user_is_admin_ti()
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'perfil', '') IN ('admin_geral', 'admin_total')
    OR COALESCE(perfil, '') NOT IN ('admin_ti', 'admin_total', 'admin_geral')
  );

DROP POLICY IF EXISTS "usuarios_insert_admin" ON public.usuarios;
CREATE POLICY "usuarios_insert_admin" ON public.usuarios
  FOR INSERT
  WITH CHECK (
    public.current_user_is_admin_ti()
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'perfil', '') IN ('admin_geral', 'admin_total')
    OR (
      COALESCE(perfil, '') NOT IN ('admin_ti', 'admin_total', 'admin_geral')
      AND EXISTS (
        SELECT 1 FROM public.usuario_clubes g
        WHERE g.usuario_id = auth.uid() AND g.ativo = TRUE
          AND g.perfil IN ('admin_ti', 'admin_clube', 'admin_total', 'admin_geral', 'usuario_secretaria')
      )
    )
  );

-- ─── push_tokens ────────────────────────────────────────────────────────────
-- O token não tem coluna de clube; o clube vem do vínculo do dono (usuario_clubes
-- ou, para pais, responsavel_membros).
CREATE OR REPLACE FUNCTION public.push_token_gestao(dono uuid, apenas_gestor boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_is_admin_ti()
  OR EXISTS (
    SELECT 1 FROM public.usuario_clubes t
    WHERE t.usuario_id = dono AND t.ativo = TRUE
      AND CASE WHEN apenas_gestor THEN public.can_manage_members_clube(t.clube_id::integer)
               ELSE public.is_staff_clube(t.clube_id::integer) END
  )
  OR EXISTS (
    SELECT 1 FROM public.responsavel_membros r
    WHERE r.usuario_id = dono AND r.ativo = TRUE
      AND CASE WHEN apenas_gestor THEN public.can_manage_members_clube(r.clube_id::integer)
               ELSE public.is_staff_clube(r.clube_id::integer) END
  )
$$;

GRANT EXECUTE ON FUNCTION public.push_token_gestao(uuid, boolean) TO authenticated;

DROP POLICY IF EXISTS "push_tokens_admin_select" ON public.push_tokens;
CREATE POLICY "push_tokens_admin_select" ON public.push_tokens
  FOR SELECT
  USING (user_id = auth.uid() OR public.push_token_gestao(user_id, FALSE));

DROP POLICY IF EXISTS "push_tokens_owner_update" ON public.push_tokens;
CREATE POLICY "push_tokens_owner_update" ON public.push_tokens
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "push_tokens_owner_delete" ON public.push_tokens;
CREATE POLICY "push_tokens_owner_delete" ON public.push_tokens
  FOR DELETE
  USING (user_id = auth.uid() OR public.push_token_gestao(user_id, TRUE));
