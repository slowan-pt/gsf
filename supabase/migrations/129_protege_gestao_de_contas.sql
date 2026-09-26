-- 129_protege_gestao_de_contas.sql
-- Funções SECURITY DEFINER que mexem em contas de login aceitavam como
-- autorizado o admin_clube/secretaria de QUALQUER clube, sem conferir de quem é a
-- conta-alvo, e gerenciar_acesso_usuario aceitava 'admin_ti' como novo perfil:
--   * admin de um clube podia trocar e-mail/senha/perfil de contas de OUTROS
--     clubes e até da conta do Admin TI (tomada de conta);
--   * podia se dar (ou dar a alguém) o perfil admin_ti.
-- Cada função original é renomeada para *_interno (sem acesso para os usuários)
-- e recriada com o mesmo nome/assinatura como invólucro que confere:
--   1. o chamador é gestor (admin_clube; secretaria só em atualizar_login_membro)
--      de um clube onde a conta-alvo está vinculada — conta sem nenhum vínculo
--      (recém-criada) pode ser tratada por qualquer gestor;
--   2. conta de plataforma (admin_ti/admin_total/admin_geral) só o Admin TI mexe;
--   3. perfis de plataforma só o Admin TI concede.
-- O caminho "só senha" do próprio usuário, do responsável e do conselheiro da
-- unidade continua igual. O app não muda.

-- ─── Quem gere a conta-alvo ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.gestor_da_conta(target uuid, incluir_secretaria boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.current_user_is_admin_ti() THEN TRUE
    WHEN EXISTS (
      SELECT 1 FROM public.usuario_clubes p
      WHERE p.usuario_id = target AND p.perfil IN ('admin_ti', 'admin_total', 'admin_geral')
    ) THEN FALSE
    WHEN EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = target AND u.perfil IN ('admin_ti', 'admin_total', 'admin_geral')
    ) THEN FALSE
    WHEN EXISTS (SELECT 1 FROM public.usuario_clubes t WHERE t.usuario_id = target) THEN EXISTS (
      SELECT 1
      FROM public.usuario_clubes t
      JOIN public.usuario_clubes g ON g.clube_id = t.clube_id
      WHERE t.usuario_id = target
        AND g.usuario_id = auth.uid()
        AND g.ativo = TRUE
        AND g.perfil = ANY (CASE WHEN incluir_secretaria
              THEN ARRAY['admin_clube', 'usuario_secretaria']
              ELSE ARRAY['admin_clube'] END)
    )
    ELSE EXISTS (
      SELECT 1 FROM public.usuario_clubes g
      WHERE g.usuario_id = auth.uid() AND g.ativo = TRUE
        AND g.perfil = ANY (CASE WHEN incluir_secretaria
              THEN ARRAY['admin_clube', 'usuario_secretaria']
              ELSE ARRAY['admin_clube'] END)
    )
  END
$$;

GRANT EXECUTE ON FUNCTION public.gestor_da_conta(uuid, boolean) TO authenticated;

-- ─── Renomeia as originais (uma vez) e fecha o acesso direto a elas ─────────
DO $$
BEGIN
  IF to_regprocedure('public.gerenciar_acesso_usuario_interno(uuid,text,integer,boolean)') IS NULL THEN
    ALTER FUNCTION public.gerenciar_acesso_usuario(uuid, text, integer, boolean)
      RENAME TO gerenciar_acesso_usuario_interno;
  END IF;
  IF to_regprocedure('public.atualizar_login_membro_interno(uuid,text,text,text,text,integer,integer)') IS NULL THEN
    ALTER FUNCTION public.atualizar_login_membro(uuid, text, text, text, text, integer, integer)
      RENAME TO atualizar_login_membro_interno;
  END IF;
  IF to_regprocedure('public.resetar_mfa_usuario_interno(uuid)') IS NULL THEN
    ALTER FUNCTION public.resetar_mfa_usuario(uuid) RENAME TO resetar_mfa_usuario_interno;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.gerenciar_acesso_usuario_interno(uuid, text, integer, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.atualizar_login_membro_interno(uuid, text, text, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resetar_mfa_usuario_interno(uuid) FROM PUBLIC, anon, authenticated;

-- ─── gerenciar_acesso_usuario ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.gerenciar_acesso_usuario(
  target_user_id uuid,
  novo_perfil text,
  novo_dbv_id integer DEFAULT NULL,
  remover_acesso boolean DEFAULT FALSE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário inválido.';
  END IF;
  IF NOT public.gestor_da_conta(target_user_id, FALSE) THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar o acesso desta conta.' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(novo_perfil, '') IN ('admin_ti', 'admin_total', 'admin_geral')
     AND NOT public.current_user_is_admin_ti() THEN
    RAISE EXCEPTION 'Somente o Admin TI concede perfis de plataforma.' USING ERRCODE = '42501';
  END IF;
  PERFORM public.gerenciar_acesso_usuario_interno(target_user_id, novo_perfil, novo_dbv_id, remover_acesso);
END
$$;

REVOKE ALL ON FUNCTION public.gerenciar_acesso_usuario(uuid, text, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerenciar_acesso_usuario(uuid, text, integer, boolean) TO authenticated;

-- ─── atualizar_login_membro ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.atualizar_login_membro(
  target_user_id uuid,
  novo_email text DEFAULT NULL,
  nova_senha text DEFAULT NULL,
  novo_nome text DEFAULT NULL,
  novo_perfil text DEFAULT NULL,
  novo_dbv_id integer DEFAULT NULL,
  novo_unidade_id integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  so_senha boolean;
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário inválido.';
  END IF;

  IF NOT public.gestor_da_conta(target_user_id, TRUE) THEN
    -- Fora da gestão do clube: só a senha, e só do próprio usuário, do
    -- responsável com permissão ou do conselheiro da unidade do membro.
    IF novo_email IS NOT NULL OR novo_nome IS NOT NULL OR novo_perfil IS NOT NULL
       OR novo_dbv_id IS NOT NULL OR novo_unidade_id IS NOT NULL THEN
      RAISE EXCEPTION 'Sem permissão para alterar esta conta.' USING ERRCODE = '42501';
    END IF;

    SELECT target_user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.usuarios u_alvo
        JOIN public.responsavel_membros rm ON rm.membro_id = u_alvo.dbv_id
        WHERE u_alvo.id = target_user_id
          AND rm.usuario_id = auth.uid()
          AND rm.ativo = TRUE
          AND rm.pode_enviar_documentos = TRUE
      )
      OR EXISTS (
        SELECT 1
        FROM public.usuarios u_alvo
        JOIN public.desbravadores d ON d.id = u_alvo.dbv_id
        JOIN public.usuario_clubes uc ON uc.clube_id = d.clube_id
        WHERE u_alvo.id = target_user_id
          AND uc.usuario_id = auth.uid()
          AND uc.ativo = TRUE
          AND uc.perfil = 'usuario_conselheiro'
          AND uc.unidade_id IS NOT NULL
          AND uc.unidade_id = d.unidade_id
      )
    INTO so_senha;

    IF NOT COALESCE(so_senha, FALSE) THEN
      RAISE EXCEPTION 'Sem permissão para alterar esta conta.' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF COALESCE(novo_perfil, '') IN ('admin_ti', 'admin_total', 'admin_geral')
     AND NOT public.current_user_is_admin_ti() THEN
    RAISE EXCEPTION 'Somente o Admin TI concede perfis de plataforma.' USING ERRCODE = '42501';
  END IF;

  PERFORM public.atualizar_login_membro_interno(
    target_user_id, novo_email, nova_senha, novo_nome, novo_perfil, novo_dbv_id, novo_unidade_id
  );
END
$$;

REVOKE ALL ON FUNCTION public.atualizar_login_membro(uuid, text, text, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atualizar_login_membro(uuid, text, text, text, text, integer, integer) TO authenticated;

-- ─── resetar_mfa_usuario ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resetar_mfa_usuario(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário inválido.';
  END IF;
  IF NOT public.gestor_da_conta(target_user_id, FALSE) THEN
    RAISE EXCEPTION 'Sem permissão para redefinir a verificação em duas etapas desta conta.' USING ERRCODE = '42501';
  END IF;
  PERFORM public.resetar_mfa_usuario_interno(target_user_id);
END
$$;

REVOKE ALL ON FUNCTION public.resetar_mfa_usuario(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resetar_mfa_usuario(uuid) TO authenticated;
