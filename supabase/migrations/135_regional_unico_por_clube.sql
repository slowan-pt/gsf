-- Um clube so pode ter UM regional; um regional pode ter varios clubes.
-- A regra entra em perfil_externo_salvar (so cobre novos vinculos: se ja houver dois regionais
-- no mesmo clube, um deles precisa sair do clube antes de qualquer um ser salvo de novo).

CREATE OR REPLACE FUNCTION public.perfil_externo_salvar(
  p_usuario_id uuid, p_tipo text, p_nome text, p_email text, p_clubes integer[]
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_perfil text;
  v_atual text;
  v_clube integer;
  v_outro text;
  v_nome_clube text;
BEGIN
  IF NOT public.perfil_externo_pode_gerir() THEN
    RAISE EXCEPTION 'Sem permissao para gerenciar perfis externos.' USING ERRCODE = '42501';
  END IF;
  IF p_tipo NOT IN ('pastor', 'regional', 'associacao') THEN
    RAISE EXCEPTION 'Tipo de perfil externo invalido.';
  END IF;
  IF p_tipo = 'associacao' AND NOT public.current_user_is_admin_ti() THEN
    RAISE EXCEPTION 'Somente o Admin TI cria perfis de Associacao.' USING ERRCODE = '42501';
  END IF;
  IF p_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Conta de usuario nao informada.';
  END IF;

  v_perfil := public.perfil_externo_codigo(p_tipo);

  SELECT perfil INTO v_atual FROM public.usuarios WHERE id = p_usuario_id;
  IF v_atual IN ('admin_ti', 'admin_total', 'admin_geral') THEN
    RAISE EXCEPTION 'Esta conta tem perfil de plataforma e nao pode virar perfil externo.' USING ERRCODE = '42501';
  END IF;

  -- Um regional por clube.
  IF p_tipo = 'regional' THEN
    FOREACH v_clube IN ARRAY COALESCE(p_clubes, ARRAY[]::integer[]) LOOP
      SELECT COALESCE(u.nome, u.email) INTO v_outro
      FROM public.usuario_clubes uc
      JOIN public.usuarios u ON u.id = uc.usuario_id
      WHERE uc.clube_id = v_clube AND uc.perfil = 'usuario_regional' AND uc.ativo = TRUE
        AND uc.usuario_id <> p_usuario_id
      LIMIT 1;
      IF v_outro IS NOT NULL THEN
        SELECT nome INTO v_nome_clube FROM public.clubes WHERE id = v_clube;
        RAISE EXCEPTION 'O clube % ja tem um regional (%). Um clube so pode ter um regional.', COALESCE(v_nome_clube, v_clube::text), v_outro;
      END IF;
    END LOOP;
  END IF;

  PERFORM set_config('app.perfil_externo', '1', TRUE);

  INSERT INTO public.usuarios (id, email, nome, perfil)
  VALUES (p_usuario_id, lower(btrim(p_email)), btrim(p_nome), v_perfil)
  ON CONFLICT (id) DO UPDATE
    SET perfil = v_perfil,
        nome = COALESCE(NULLIF(btrim(p_nome), ''), public.usuarios.nome);

  INSERT INTO public.perfis_externos (usuario_id, tipo, ativo, criado_por)
  VALUES (p_usuario_id, p_tipo, TRUE, auth.uid())
  ON CONFLICT (usuario_id) DO UPDATE SET tipo = p_tipo, ativo = TRUE, updated_at = now();

  DELETE FROM public.usuario_clubes
   WHERE usuario_id = p_usuario_id AND perfil = v_perfil
     AND NOT (clube_id::integer = ANY (COALESCE(p_clubes, ARRAY[]::integer[])));

  FOREACH v_clube IN ARRAY COALESCE(p_clubes, ARRAY[]::integer[]) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.usuario_clubes
       WHERE usuario_id = p_usuario_id AND clube_id = v_clube AND perfil = v_perfil
    ) THEN
      INSERT INTO public.usuario_clubes (usuario_id, clube_id, perfil, ativo)
      VALUES (p_usuario_id, v_clube, v_perfil, TRUE);
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.perfil_externo_salvar(uuid, text, text, text, integer[]) TO authenticated;
