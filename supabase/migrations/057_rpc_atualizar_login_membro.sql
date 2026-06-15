-- Permite que admin_ti/admin_clube atualize e-mail e senha de login de um membro.
-- A atualização precisa tocar auth.users; por isso fica centralizada em RPC SECURITY DEFINER.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
SET search_path = public, auth, extensions
AS $$
DECLARE
  pode_admin boolean;
  email_final text;
  senha_final text;
BEGIN
  SELECT public.current_user_is_admin_ti()
    OR EXISTS (
      SELECT 1
      FROM public.usuario_clubes uc
      WHERE uc.usuario_id = auth.uid()
        AND uc.ativo = TRUE
        AND uc.perfil IN ('admin_clube', 'admin_geral', 'admin_total')
    )
  INTO pode_admin;

  IF NOT COALESCE(pode_admin, false) THEN
    RAISE EXCEPTION 'Apenas admin_ti/admin_clube pode alterar credenciais de login.';
  END IF;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário inválido.';
  END IF;

  email_final := NULLIF(lower(trim(novo_email)), '');
  senha_final := NULLIF(trim(nova_senha), '');

  IF email_final IS NOT NULL
     AND EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = email_final AND id <> target_user_id) THEN
    RAISE EXCEPTION 'Já existe outro usuário com este e-mail.';
  END IF;

  IF senha_final IS NOT NULL AND length(senha_final) < 6 THEN
    RAISE EXCEPTION 'A senha precisa ter pelo menos 6 caracteres.';
  END IF;

  UPDATE auth.users
     SET email = COALESCE(email_final, email),
         encrypted_password = CASE
           WHEN senha_final IS NOT NULL THEN crypt(senha_final, gen_salt('bf'))
           ELSE encrypted_password
         END,
         email_confirmed_at = COALESCE(email_confirmed_at, now()),
         confirmation_token = '',
         recovery_token = '',
         raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
           || jsonb_strip_nulls(jsonb_build_object(
             'nome', NULLIF(trim(novo_nome), ''),
             'perfil', novo_perfil,
             'dbv_id', novo_dbv_id,
             'unidade_id', novo_unidade_id
           )),
         updated_at = now()
   WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário de autenticação não encontrado.';
  END IF;

  UPDATE public.usuarios
     SET email = COALESCE(email_final, email),
         nome = COALESCE(NULLIF(trim(novo_nome), ''), nome),
         perfil = COALESCE(novo_perfil, perfil),
         dbv_id = COALESCE(novo_dbv_id, dbv_id),
         unidade_id = COALESCE(novo_unidade_id, unidade_id)
   WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.atualizar_login_membro(uuid, text, text, text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atualizar_login_membro(uuid, text, text, text, text, integer, integer) TO authenticated;
