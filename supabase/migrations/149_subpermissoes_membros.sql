-- 149_subpermissoes_membros.sql
-- Permissões por ação (Permissões → Gerenciar membros → cadastrar, editar, inativar, excluir...).
-- O app grava, em perfil_permissoes, uma linha por ação marcada (`gerenciar_membros.excluir`), a linha do grupo
-- (`gerenciar_membros`, quando há ao menos uma ação) e a marca `gerenciar_membros#sub` (grupo detalhado).
-- Perfil com o grupo marcado e SEM a marca (configuração antiga) continua com todas as ações.
-- Requer as migrations 126 e 127.

-- Admin do clube passa a ter 'gerenciar_documentos' na matriz (antes valia por ser administrador do clube).
INSERT INTO public.perfil_permissoes (perfil, permissao) VALUES ('admin_clube', 'gerenciar_documentos')
ON CONFLICT DO NOTHING;

-- O perfil do usuário tem esta ação no clube?
CREATE OR REPLACE FUNCTION public.perfil_tem_acao(target_clube_id integer, grupo text, acao text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_is_admin_ti()
  OR EXISTS (
    SELECT 1 FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid() AND uc.clube_id = target_clube_id AND uc.ativo = TRUE
      AND uc.perfil IN ('admin_ti', 'admin_total', 'admin_geral')
  )
  OR EXISTS (
    SELECT 1
    FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid()
      AND uc.clube_id = target_clube_id
      AND uc.ativo = TRUE
      AND (
        -- ação marcada explicitamente
        EXISTS (SELECT 1 FROM public.perfil_permissoes pp WHERE pp.perfil = uc.perfil AND pp.permissao = grupo || '.' || acao)
        -- grupo marcado e nunca detalhado (configuração antiga): vale tudo do grupo
        OR (
          EXISTS (SELECT 1 FROM public.perfil_permissoes pp WHERE pp.perfil = uc.perfil AND pp.permissao = grupo)
          AND NOT EXISTS (SELECT 1 FROM public.perfil_permissoes pp WHERE pp.perfil = uc.perfil AND pp.permissao = grupo || '#sub')
        )
        -- tabela sem nenhuma linha para o perfil: padrão de fábrica de membros/documentos
        OR (
          NOT EXISTS (SELECT 1 FROM public.perfil_permissoes pp WHERE pp.perfil = uc.perfil)
          AND grupo IN ('gerenciar_membros', 'gerenciar_documentos')
          AND uc.perfil IN ('admin_clube', 'usuario_secretaria')
        )
      )
  )
$$;

GRANT EXECUTE ON FUNCTION public.perfil_tem_acao(integer, text, text) TO authenticated;

-- ─── desbravadores: uma política por comando ────────────────────────────────
DROP POLICY IF EXISTS "desbravadores_gestao_all" ON public.desbravadores;
DROP POLICY IF EXISTS "desbravadores_gestao_select" ON public.desbravadores;
DROP POLICY IF EXISTS "desbravadores_gestao_insert" ON public.desbravadores;
DROP POLICY IF EXISTS "desbravadores_gestao_update" ON public.desbravadores;
DROP POLICY IF EXISTS "desbravadores_gestao_delete" ON public.desbravadores;

CREATE POLICY "desbravadores_gestao_select" ON public.desbravadores
  FOR SELECT TO authenticated
  USING (public.can_manage_members_clube(clube_id::integer));

CREATE POLICY "desbravadores_gestao_insert" ON public.desbravadores
  FOR INSERT TO authenticated
  WITH CHECK (public.perfil_tem_acao(clube_id::integer, 'gerenciar_membros', 'cadastrar'));

CREATE POLICY "desbravadores_gestao_update" ON public.desbravadores
  FOR UPDATE TO authenticated
  USING (public.can_manage_members_clube(clube_id::integer))
  WITH CHECK (public.can_manage_members_clube(clube_id::integer));

CREATE POLICY "desbravadores_gestao_delete" ON public.desbravadores
  FOR DELETE TO authenticated
  USING (public.perfil_tem_acao(clube_id::integer, 'gerenciar_membros', 'excluir'));

-- Inativar/reativar (coluna ativo) exige a ação própria; o resto da edição segue como antes.
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

  IF NEW.ativo IS DISTINCT FROM OLD.ativo
     AND public.can_manage_members_clube(OLD.clube_id::integer)
     AND NOT public.perfil_tem_acao(OLD.clube_id::integer, 'gerenciar_membros', 'inativar') THEN
    RAISE EXCEPTION 'Sem permissão para inativar ou reativar membros.'
      USING ERRCODE = '42501';
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
