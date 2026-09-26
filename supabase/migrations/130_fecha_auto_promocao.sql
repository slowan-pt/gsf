-- 130_fecha_auto_promocao.sql
-- Fecha os caminhos de auto-promoção que sobraram depois da 128:
--  1. usuario_clubes_admin_insert / _update (políticas antigas, somem só quando
--     removidas): deixavam o admin_clube criar/alterar vínculo com QUALQUER perfil,
--     inclusive admin_ti. A usuario_clubes_admin_all (128) já cobre o admin do clube
--     sem perfis de plataforma.
--  2. usuarios_self_update / usuarios_self_insert: o próprio usuário podia mudar o
--     seu perfil e o seu dbv_id/unidade_id (apontar para a ficha de outro membro).
--     Um gatilho passa a bloquear isso para quem não é Admin TI.
--  3. admins_insert/update_responsavel_membros: aceitavam quem tem usuarios.perfil
--     admin_ti/admin_clube em QUALQUER clube (sem conferir o clube da linha). Trocadas
--     por regras do gestor do clube da linha.

-- 1. vínculos
DROP POLICY IF EXISTS "usuario_clubes_admin_insert" ON public.usuario_clubes;
DROP POLICY IF EXISTS "usuario_clubes_admin_update" ON public.usuario_clubes;

-- 2. usuarios: perfil e vínculo com membro só mudam por quem administra a conta
CREATE OR REPLACE FUNCTION public.usuarios_protege_perfil()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role / SQL Editor (sem usuário no JWT) e Admin TI: sem restrição.
  IF auth.uid() IS NULL OR public.current_user_is_admin_ti() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.perfil, '') IN ('admin_ti', 'admin_total', 'admin_geral') THEN
      RAISE EXCEPTION 'Somente o Admin TI cria contas de plataforma.' USING ERRCODE = '42501';
    END IF;
    IF NEW.id = auth.uid() AND (NEW.dbv_id IS NOT NULL OR NEW.unidade_id IS NOT NULL) THEN
      RAISE EXCEPTION 'O vínculo com o membro é definido pela administração do clube.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.perfil IS DISTINCT FROM OLD.perfil
     OR NEW.dbv_id IS DISTINCT FROM OLD.dbv_id
     OR NEW.unidade_id IS DISTINCT FROM OLD.unidade_id THEN
    IF COALESCE(NEW.perfil, '') IN ('admin_ti', 'admin_total', 'admin_geral') THEN
      RAISE EXCEPTION 'Somente o Admin TI concede perfis de plataforma.' USING ERRCODE = '42501';
    END IF;
    IF OLD.id = auth.uid() THEN
      RAISE EXCEPTION 'Você não pode alterar o próprio perfil ou vínculo.' USING ERRCODE = '42501';
    END IF;
    IF NOT public.gestor_da_conta(OLD.id, TRUE) THEN
      RAISE EXCEPTION 'Sem permissão para alterar o perfil ou o vínculo desta conta.' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_usuarios_protege_perfil ON public.usuarios;
CREATE TRIGGER trg_usuarios_protege_perfil
  BEFORE INSERT OR UPDATE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.usuarios_protege_perfil();

-- 3. responsavel_membros: gestor do clube da linha (admin do clube / secretaria)
DROP POLICY IF EXISTS "admins_insert_responsavel_membros" ON public.responsavel_membros;
DROP POLICY IF EXISTS "admins_update_responsavel_membros" ON public.responsavel_membros;
DROP POLICY IF EXISTS "responsavel_membros_gestao_insert" ON public.responsavel_membros;
DROP POLICY IF EXISTS "responsavel_membros_gestao_update" ON public.responsavel_membros;

CREATE POLICY "responsavel_membros_gestao_insert" ON public.responsavel_membros
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_members_clube(clube_id::integer));

CREATE POLICY "responsavel_membros_gestao_update" ON public.responsavel_membros
  FOR UPDATE TO authenticated
  USING (public.can_manage_members_clube(clube_id::integer))
  WITH CHECK (public.can_manage_members_clube(clube_id::integer));
