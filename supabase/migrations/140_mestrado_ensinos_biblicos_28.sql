-- Ensinos Biblicos tem 28 especialidades no Manual 2025 (indice, pag. 90): faltava "Vida, morte e
-- ressurreicao de Cristo" na lista do ME-016. Inclui, registra a nova versao da regra e reavalia os membros.
DO $$
DECLARE
  v_prog integer := (SELECT id FROM public.programas WHERE nome ILIKE '%desbravador%' ORDER BY id LIMIT 1);
  m public.mestrados%ROWTYPE;
  v_antes integer;
  v_depois integer;
BEGIN
  SELECT * INTO m FROM public.mestrados WHERE codigo = 'ME-016' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ME-016 nao existe.'; END IF;

  SELECT count(*) INTO v_antes FROM public.mestrado_especialidades WHERE mestrado_id = m.id;

  INSERT INTO public.mestrado_especialidades (mestrado_id, especialidade_id, obrigatoria)
  SELECT m.id, em.id, FALSE
  FROM public.especialidades_modelo em
  WHERE em.ativo = TRUE AND em.programa_id = v_prog
    AND public.mestrado_norm(em.nome) = public.mestrado_norm('Vida, morte e ressureição de Cristo')
  ON CONFLICT DO NOTHING;

  SELECT count(*) INTO v_depois FROM public.mestrado_especialidades WHERE mestrado_id = m.id;
  IF v_depois = v_antes THEN
    RAISE NOTICE 'Nada a fazer: a lista do ME-016 ja tinha % especialidades.', v_antes;
    RETURN;
  END IF;

  UPDATE public.mestrados SET versao = versao + 1, atualizado_em = now() WHERE id = m.id;
  SELECT * INTO m FROM public.mestrados WHERE id = m.id;
  INSERT INTO public.mestrado_versoes (mestrado_id, versao, snapshot)
  VALUES (m.id, m.versao, jsonb_build_object(
    'codigo', m.codigo, 'nome', m.nome, 'quantidade_exigida', m.quantidade_exigida, 'areas', m.areas,
    'fonte', m.fonte, 'edicao', m.edicao, 'observacoes', m.observacoes, 'situacao', m.situacao,
    'especialidades', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', me.especialidade_id, 'obrigatoria', me.obrigatoria, 'grupo_requisito', me.grupo_requisito)), '[]'::jsonb)
                        FROM public.mestrado_especialidades me WHERE me.mestrado_id = m.id)))
  ON CONFLICT (mestrado_id, versao) DO UPDATE SET snapshot = EXCLUDED.snapshot, criado_em = now();
  PERFORM public.mestrado_reavaliar_todos(m.id);
END $$;
