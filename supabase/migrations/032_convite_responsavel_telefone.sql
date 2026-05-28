-- Telefone informado pelo responsável no aceite do convite externo.

ALTER TABLE public.responsavel_convites
  ADD COLUMN IF NOT EXISTS telefone TEXT;

CREATE OR REPLACE FUNCTION public.aceitar_convite_responsavel(p_token text, p_telefone text DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_convite  responsavel_convites%ROWTYPE;
  v_user_id  UUID;
  v_email    TEXT;
  v_nome     TEXT;
  v_exist_id UUID;
  v_telefone TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'not_authenticated');
  END IF;

  SELECT email, COALESCE(raw_user_meta_data->>'nome', raw_user_meta_data->>'name', email)
  INTO v_email, v_nome
  FROM auth.users
  WHERE id = v_user_id;

  SELECT * INTO v_convite FROM responsavel_convites
  WHERE token = p_token AND NOT usado;

  IF NOT FOUND THEN
    SELECT * INTO v_convite FROM responsavel_convites WHERE token = p_token AND usado;
    IF FOUND THEN
      RETURN json_build_object('success', true, 'membro_id', v_convite.membro_id, 'ja_vinculado', true);
    END IF;
    RETURN json_build_object('error', 'invalid_token');
  END IF;

  IF LOWER(v_convite.email) != LOWER(v_email) THEN
    RETURN json_build_object('error', 'email_mismatch', 'esperado', v_convite.email);
  END IF;

  v_telefone := NULLIF(TRIM(COALESCE(p_telefone, v_convite.telefone, '')), '');

  SELECT id INTO v_exist_id FROM responsavel_membros
  WHERE usuario_id = v_user_id AND membro_id = v_convite.membro_id
  LIMIT 1;

  IF FOUND THEN
    UPDATE responsavel_membros
    SET ativo = true, updated_at = NOW()
    WHERE id = v_exist_id;
  ELSE
    INSERT INTO responsavel_membros (usuario_id, membro_id, clube_id, programa_id, parentesco, ativo)
    VALUES (v_user_id, v_convite.membro_id, v_convite.clube_id, v_convite.programa_id, v_convite.parentesco, true);
  END IF;

  UPDATE responsavel_convites
  SET usado = true,
      telefone = COALESCE(v_telefone, telefone)
  WHERE id = v_convite.id;

  UPDATE desbravadores
  SET email = COALESCE(NULLIF(email, ''), v_email),
      nome_responsavel = COALESCE(NULLIF(nome_responsavel, ''), v_nome),
      contato_responsavel = COALESCE(v_telefone, contato_responsavel),
      updated_at = NOW()
  WHERE id = v_convite.membro_id
    AND clube_id = v_convite.clube_id;

  RETURN json_build_object('success', true, 'membro_id', v_convite.membro_id);
END;
$function$;

