BEGIN;

ALTER TABLE public.atividades_alvos ADD COLUMN IF NOT EXISTS grupo_unidade_id integer;

UPDATE public.atividades_alvos al SET grupo_unidade_id = -1000
FROM public.atividades a
WHERE a.id = al.atividade_id AND a.clube_id = al.clube_id AND a.destino = 'unidade'
  AND al.tipo = 'membro' AND al.grupo_unidade_id IS NULL;

-- A composição original de unidades antigas não foi armazenada. Use a atual e
-- preserve quem já respondeu. Unidades sem participantes continuam legadas.
WITH unidades_antigas AS (
  SELECT al.id, al.atividade_id, al.clube_id, al.unidade_id
  FROM public.atividades_alvos al
  WHERE al.tipo = 'unidade'
), candidatos AS (
  SELECT u.id AS alvo_id, u.atividade_id, u.clube_id, u.unidade_id, d.id AS membro_id
  FROM unidades_antigas u
  JOIN public.desbravadores d ON d.clube_id = u.clube_id AND d.unidade_id = u.unidade_id
  WHERE d.ativo IS DISTINCT FROM FALSE
  UNION
  SELECT u.id, u.atividade_id, u.clube_id, u.unidade_id, r.dbv_id
  FROM unidades_antigas u
  JOIN public.atividades_respostas r ON r.atividade_id = u.atividade_id AND r.clube_id = u.clube_id
  JOIN public.desbravadores d ON d.id = r.dbv_id AND d.clube_id = u.clube_id
  WHERE u.unidade_id = (
    SELECT COALESCE(
      min(outra.unidade_id) FILTER (WHERE outra.unidade_id = d.unidade_id),
      min(outra.unidade_id)
    ) FROM unidades_antigas outra WHERE outra.atividade_id = u.atividade_id
  )
), inseridos AS (
  INSERT INTO public.atividades_alvos (clube_id, atividade_id, tipo, membro_id, grupo_unidade_id)
  SELECT DISTINCT clube_id, atividade_id, 'membro', membro_id, unidade_id FROM candidatos
  RETURNING atividade_id, grupo_unidade_id
)
DELETE FROM public.atividades_alvos al
USING inseridos i
WHERE al.tipo = 'unidade' AND al.atividade_id = i.atividade_id AND al.unidade_id = i.grupo_unidade_id;

CREATE OR REPLACE FUNCTION public.salvar_atividade_com_alvos(
  p_clube_id integer, p_atividade_id bigint, p_dados jsonb, p_alvos jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  dados public.atividades;
  atividade bigint := p_atividade_id;
  destinos jsonb;
  participantes jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_manage_atividades(p_clube_id) THEN
    RAISE EXCEPTION 'Sem permissão para salvar atividades neste clube.' USING ERRCODE = '42501';
  END IF;
  dados := jsonb_populate_record(NULL::public.atividades, p_dados);
  IF NULLIF(btrim(dados.titulo), '') IS NULL
    OR dados.destino IS NULL OR dados.destino NOT IN ('todos', 'unidade', 'desbravador')
    OR jsonb_typeof(p_alvos) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Dados da atividade inválidos.';
  END IF;

  IF atividade IS NOT NULL THEN
    PERFORM 1 FROM public.atividades a WHERE a.id = atividade AND a.clube_id = p_clube_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Atividade não encontrada neste clube.'; END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_alvos) x(tipo text, membro_id integer, unidade_id integer)
    WHERE CASE
      WHEN dados.destino = 'unidade' AND x.tipo = 'unidade' THEN
        x.membro_id IS NOT NULL OR x.unidade_id IS NULL OR (x.unidade_id <> -1000 AND NOT EXISTS (
          SELECT 1 FROM public.unidades u WHERE u.id = x.unidade_id AND u.clube_id = p_clube_id
        ))
      WHEN dados.destino <> 'unidade' AND x.tipo = 'membro' THEN
        x.unidade_id IS NOT NULL OR NOT EXISTS (
          SELECT 1 FROM public.desbravadores d WHERE d.id = x.membro_id AND d.clube_id = p_clube_id
        )
      ELSE TRUE
    END
  ) THEN RAISE EXCEPTION 'Há destinatários inválidos ou de outro clube.'; END IF;

  WITH entrada AS (
    SELECT DISTINCT tipo, membro_id, unidade_id
    FROM jsonb_to_recordset(p_alvos) x(tipo text, membro_id integer, unidade_id integer)
  ), fixados AS (
    SELECT al.membro_id, al.grupo_unidade_id AS grupo
    FROM entrada e JOIN public.atividades_alvos al
      ON al.atividade_id = atividade AND al.clube_id = p_clube_id AND al.tipo = 'membro'
      AND al.grupo_unidade_id = e.unidade_id
    WHERE e.tipo = 'unidade'
  ), lista AS (
    SELECT membro_id, NULL::integer AS grupo FROM entrada WHERE tipo = 'membro'
    UNION SELECT membro_id, grupo FROM fixados
    UNION
    SELECT d.id, e.unidade_id
    FROM entrada e JOIN public.desbravadores d
      ON d.clube_id = p_clube_id AND (d.unidade_id = e.unidade_id
        OR (e.unidade_id = -1000 AND lower(btrim(d.unidade_nome)) = 'diretoria'))
    WHERE e.tipo = 'unidade' AND d.ativo IS DISTINCT FROM FALSE
      AND NOT EXISTS (SELECT 1 FROM fixados f WHERE f.grupo = e.unidade_id)
  )
  SELECT jsonb_agg(jsonb_build_object('membro_id', membro_id, 'grupo', grupo)) INTO destinos FROM lista;
  IF destinos IS NULL THEN RAISE EXCEPTION 'Selecione ao menos um membro para a atividade.'; END IF;

  IF atividade IS NULL THEN
    INSERT INTO public.atividades (clube_id, titulo, descricao, data, destino, unidade_id,
      unidade_nome, dbv_id, dbv_nome, criado_por, avaliador_id, avaliador_nome,
      item_formativo_tipo, item_formativo_nome, gera_investidura, plano_formativo_id)
    VALUES (p_clube_id, dados.titulo, dados.descricao, dados.data, dados.destino, dados.unidade_id,
      dados.unidade_nome, dados.dbv_id, dados.dbv_nome, dados.criado_por, dados.avaliador_id, dados.avaliador_nome,
      dados.item_formativo_tipo, dados.item_formativo_nome, dados.gera_investidura, dados.plano_formativo_id)
    RETURNING id INTO atividade;
  ELSE
    UPDATE public.atividades a SET titulo = dados.titulo, descricao = dados.descricao,
      data = dados.data, destino = dados.destino, unidade_id = dados.unidade_id,
      unidade_nome = dados.unidade_nome, dbv_id = dados.dbv_id, dbv_nome = dados.dbv_nome,
      avaliador_id = dados.avaliador_id, avaliador_nome = dados.avaliador_nome,
      item_formativo_tipo = dados.item_formativo_tipo, item_formativo_nome = dados.item_formativo_nome,
      gera_investidura = dados.gera_investidura, plano_formativo_id = dados.plano_formativo_id
    WHERE a.id = atividade AND a.clube_id = p_clube_id;
  END IF;

  DELETE FROM public.atividades_alvos al WHERE al.atividade_id = atividade AND al.clube_id = p_clube_id;
  WITH gravados AS (
    INSERT INTO public.atividades_alvos (clube_id, atividade_id, tipo, membro_id, grupo_unidade_id)
    SELECT p_clube_id, atividade, 'membro', x.membro_id, x.grupo
    FROM jsonb_to_recordset(destinos) x(membro_id integer, grupo integer)
    RETURNING id, membro_id, grupo_unidade_id
  )
  SELECT jsonb_agg(to_jsonb(g)) INTO participantes FROM gravados g;
  RETURN jsonb_build_object('id', atividade, 'alvos', participantes);
END
$$;

REVOKE ALL ON FUNCTION public.salvar_atividade_com_alvos(integer, bigint, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_atividade_com_alvos(integer, bigint, jsonb, jsonb) TO authenticated;

CREATE TABLE IF NOT EXISTS public.atividades_push (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atividade_id bigint NOT NULL REFERENCES public.atividades(id) ON DELETE CASCADE,
  clube_id integer NOT NULL REFERENCES public.clubes(id) ON DELETE CASCADE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  membros integer NOT NULL CHECK (membros >= 0),
  sem_aparelho integer NOT NULL CHECK (sem_aparelho >= 0),
  falhas integer NOT NULL CHECK (falhas >= 0),
  consulta_com_erro boolean NOT NULL DEFAULT FALSE,
  tickets jsonb NOT NULL CHECK (jsonb_typeof(tickets) = 'array'),
  recibos jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(recibos) = 'object')
);
CREATE INDEX IF NOT EXISTS idx_atividades_push_atividade ON public.atividades_push(atividade_id, criado_em DESC);
ALTER TABLE public.atividades_push ENABLE ROW LEVEL SECURITY;
CREATE POLICY atividades_push_gestao ON public.atividades_push FOR ALL TO authenticated
  USING (public.current_user_can_manage_atividades(clube_id))
  WITH CHECK (public.current_user_can_manage_atividades(clube_id) AND EXISTS (
    SELECT 1 FROM public.atividades a WHERE a.id = atividade_id AND a.clube_id = atividades_push.clube_id
  ));
GRANT SELECT, INSERT ON public.atividades_push TO authenticated;
GRANT UPDATE (recibos) ON public.atividades_push TO authenticated;

CREATE OR REPLACE FUNCTION public.registrar_recibos_atividade(p_clube_id integer, p_registro_id uuid, p_recibos jsonb)
RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$
  UPDATE public.atividades_push p
  SET recibos = p.recibos || COALESCE((
    SELECT jsonb_object_agg(r.key, r.value)
    FROM jsonb_each(p_recibos) r WHERE p.tickets ? r.key AND NOT (p.recibos ? r.key)
  ), '{}'::jsonb)
  WHERE p.clube_id = p_clube_id AND p.id = p_registro_id
  RETURNING p.recibos
$$;
REVOKE ALL ON FUNCTION public.registrar_recibos_atividade(integer, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_recibos_atividade(integer, uuid, jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
