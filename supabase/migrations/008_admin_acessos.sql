ALTER TABLE public.usuarios
  DROP CONSTRAINT IF EXISTS usuarios_perfil_check;

ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_perfil_check
  CHECK (perfil IN ('admin_total', 'admin_geral', 'admin_diretoria', 'desbravador'));

CREATE OR REPLACE FUNCTION public.is_admin_total_or_geral()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.usuarios
     WHERE id = auth.uid()
       AND perfil IN ('admin_total', 'admin_geral')
  );
$$;

CREATE OR REPLACE FUNCTION public.gerenciar_acesso_usuario(
  target_user_id uuid,
  novo_perfil text,
  novo_dbv_id integer DEFAULT NULL,
  remover_acesso boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  requester_perfil text;
  dados_usuario record;
  novo_unidade_id integer;
  novo_nome text;
BEGIN
  SELECT perfil
    INTO requester_perfil
    FROM public.usuarios
   WHERE id = auth.uid()
   LIMIT 1;

  IF COALESCE(requester_perfil, '') NOT IN ('admin_total', 'admin_geral') THEN
    RAISE EXCEPTION 'Apenas admin total/geral pode gerenciar acessos.';
  END IF;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário inválido.';
  END IF;

  IF remover_acesso THEN
    DELETE FROM public.usuarios WHERE id = target_user_id;
    UPDATE auth.users
       SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
          - 'perfil'
          - 'dbv_id'
          - 'unidade_id'
     WHERE id = target_user_id;
    DELETE FROM auth.mfa_factors WHERE user_id = target_user_id;
    RETURN;
  END IF;

  IF novo_perfil NOT IN ('admin_total', 'admin_geral', 'admin_diretoria', 'desbravador') THEN
    RAISE EXCEPTION 'Perfil inválido.';
  END IF;

  SELECT *
    INTO dados_usuario
    FROM public.usuarios
   WHERE id = target_user_id
   LIMIT 1;

  SELECT unidade_id, nome
    INTO novo_unidade_id, novo_nome
    FROM public.desbravadores
   WHERE id = novo_dbv_id
   LIMIT 1;

  UPDATE public.usuarios
     SET perfil = novo_perfil,
         dbv_id = novo_dbv_id,
         unidade_id = novo_unidade_id,
         nome = COALESCE(novo_nome, dados_usuario.nome),
         email = COALESCE(dados_usuario.email, (SELECT email FROM auth.users WHERE id = target_user_id))
   WHERE id = target_user_id;

  UPDATE auth.users
     SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object(
          'perfil', novo_perfil,
          'dbv_id', novo_dbv_id,
          'unidade_id', novo_unidade_id
        )
   WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.is_admin_total_or_geral() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gerenciar_acesso_usuario(uuid, text, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_total_or_geral() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gerenciar_acesso_usuario(uuid, text, integer, boolean) TO authenticated;
