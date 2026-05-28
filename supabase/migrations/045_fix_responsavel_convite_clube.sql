-- Fix: aceitar_convite_responsavel did not update clube_id when an existing
-- responsavel_membros row was found for a different clube.  The pai would be
-- stored under the old clube_id and become invisible in the current club's
-- Resp. tab.  Also adds nome_cache / email_cache so external pais (not in the
-- usuarios table) can still display their real name.

ALTER TABLE public.responsavel_membros
  ADD COLUMN IF NOT EXISTS nome_cache  TEXT,
  ADD COLUMN IF NOT EXISTS email_cache TEXT;

-- Grant the new columns to authenticated role (migration 041 already covered
-- the table; new columns just need no extra grant for SELECT/INSERT/UPDATE).

CREATE OR REPLACE FUNCTION public.aceitar_convite_responsavel(
  p_token    text,
  p_telefone text DEFAULT NULL
)
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

  SELECT
    email,
    COALESCE(raw_user_meta_data->>'nome', raw_user_meta_data->>'name', email)
  INTO v_email, v_nome
  FROM auth.users
  WHERE id = v_user_id;

  -- Try the unused convite first.
  SELECT * INTO v_convite
  FROM responsavel_convites
  WHERE token = p_token AND NOT usado;

  IF NOT FOUND THEN
    -- Already used → idempotent success.
    SELECT * INTO v_convite
    FROM responsavel_convites
    WHERE token = p_token AND usado;

    IF FOUND THEN
      RETURN json_build_object(
        'success', true,
        'membro_id', v_convite.membro_id,
        'ja_vinculado', true
      );
    END IF;

    RETURN json_build_object('error', 'invalid_token');
  END IF;

  IF LOWER(v_convite.email) != LOWER(v_email) THEN
    RETURN json_build_object(
      'error', 'email_mismatch',
      'esperado', v_convite.email
    );
  END IF;

  v_telefone := NULLIF(TRIM(COALESCE(p_telefone, v_convite.telefone, '')), '');

  -- Look for an existing row for this (usuario, membro) pair regardless of clube.
  SELECT id INTO v_exist_id
  FROM responsavel_membros
  WHERE usuario_id = v_user_id
    AND membro_id  = v_convite.membro_id
  LIMIT 1;

  IF FOUND THEN
    -- Always sync to the clube/programa from the convite so the record
    -- appears in the correct club's Resp. tab.
    UPDATE responsavel_membros
    SET
      ativo       = true,
      clube_id    = v_convite.clube_id,
      programa_id = v_convite.programa_id,
      parentesco  = COALESCE(v_convite.parentesco, parentesco),
      nome_cache  = v_nome,
      email_cache = v_email,
      updated_at  = NOW()
    WHERE id = v_exist_id;
  ELSE
    INSERT INTO responsavel_membros
      (usuario_id, membro_id, clube_id, programa_id, parentesco, ativo, nome_cache, email_cache)
    VALUES
      (v_user_id, v_convite.membro_id, v_convite.clube_id, v_convite.programa_id,
       v_convite.parentesco, true, v_nome, v_email);
  END IF;

  -- Mark the convite as used and persist the phone if provided.
  UPDATE responsavel_convites
  SET
    usado    = true,
    telefone = COALESCE(v_telefone, telefone)
  WHERE id = v_convite.id;

  -- Best-effort update of the desbravador contact fields.
  UPDATE desbravadores
  SET
    email                = COALESCE(NULLIF(email, ''), v_email),
    nome_responsavel     = COALESCE(NULLIF(nome_responsavel, ''), v_nome),
    contato_responsavel  = COALESCE(v_telefone, contato_responsavel),
    updated_at           = NOW()
  WHERE id       = v_convite.membro_id
    AND clube_id = v_convite.clube_id;

  RETURN json_build_object('success', true, 'membro_id', v_convite.membro_id);
END;
$function$;
