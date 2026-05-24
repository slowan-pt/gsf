CREATE OR REPLACE FUNCTION public.resetar_mfa_usuario(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  requester_perfil text;
BEGIN
  SELECT perfil
    INTO requester_perfil
    FROM public.usuarios
   WHERE id = auth.uid()
   LIMIT 1;

  IF COALESCE(requester_perfil, '') NOT IN ('admin_total', 'admin_geral') THEN
    RAISE EXCEPTION 'Apenas admin total pode resetar MFA.';
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
