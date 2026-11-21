BEGIN;

-- Os registros antigos podem usar DD/MM/AAAA; o calendário também aceita esse formato.
CREATE OR REPLACE FUNCTION public.agenda_data_iso(valor text)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT
SET search_path = ''
AS $$
  SELECT CASE
    WHEN btrim(valor) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN left(btrim(valor), 10)
    WHEN partes IS NOT NULL THEN partes[3] || '-' || lpad(partes[2], 2, '0') || '-' || lpad(partes[1], 2, '0')
  END
  FROM (SELECT regexp_match(btrim(valor), '^([0-9]{1,2})/([0-9]{1,2})/([0-9]{4})') AS partes) AS data_br;
$$;

-- Aplica as permissões da agenda e mantém a RLS existente na execução.
CREATE OR REPLACE FUNCTION public.agenda_pode_acao(clube integer, acao text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT public.perfil_tem_acao(clube, 'gerenciar_agenda', acao)
    OR EXISTS (
      SELECT 1 FROM public.usuario_clubes uc
      WHERE uc.usuario_id = auth.uid() AND uc.clube_id = clube AND uc.ativo
        AND uc.perfil IN ('admin_clube', 'usuario_secretaria', 'usuario_conselheiro', 'usuario_diretoria', 'usuario_instrutor')
        AND NOT EXISTS (SELECT 1 FROM public.perfil_permissoes pp WHERE pp.perfil = uc.perfil)
    );
$$;

CREATE OR REPLACE FUNCTION public.limpar_agenda_periodo(p_clube_id integer, p_ano integer, p_mes integer DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  inicio date;
  fim date;
  removidos integer;
BEGIN
  IF NOT public.agenda_pode_acao(p_clube_id, 'excluir') THEN
    RAISE EXCEPTION 'Sem permissão para excluir eventos deste clube.' USING ERRCODE = '42501';
  END IF;
  IF p_ano IS NULL OR p_ano NOT BETWEEN 1900 AND 9998 OR (p_mes IS NOT NULL AND p_mes NOT BETWEEN 1 AND 12) THEN
    RAISE EXCEPTION 'Período inválido.';
  END IF;
  inicio := make_date(p_ano, COALESCE(p_mes, 1), 1);
  fim := CASE WHEN p_mes IS NULL THEN inicio + interval '1 year' ELSE inicio + interval '1 month' END;
  PERFORM pg_advisory_xact_lock(163, p_clube_id);
  DELETE FROM public.eventos e WHERE e.clube_id = p_clube_id
    AND public.agenda_data_iso(e.data) >= to_char(inicio, 'YYYY-MM-DD')
    AND public.agenda_data_iso(e.data) < to_char(fim, 'YYYY-MM-DD');
  GET DIAGNOSTICS removidos = ROW_COUNT;
  RETURN removidos;
END;
$$;

CREATE OR REPLACE FUNCTION public.substituir_agenda_datas(p_clube_id integer, p_eventos jsonb)
RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  datas text[];
  inseridos integer;
BEGIN
  IF NOT public.agenda_pode_acao(p_clube_id, 'criar') OR NOT public.agenda_pode_acao(p_clube_id, 'excluir') THEN
    RAISE EXCEPTION 'Importar a agenda exige permissão para criar e excluir eventos deste clube.' USING ERRCODE = '42501';
  END IF;
  IF p_eventos IS NULL OR jsonb_typeof(p_eventos) <> 'array' THEN
    RAISE EXCEPTION 'Lista de eventos inválida.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_eventos) AS linha(data text, atividade text)
    WHERE data IS NULL OR data !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR NULLIF(btrim(atividade), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'Todos os eventos precisam de uma data ISO e de uma atividade.';
  END IF;
  SELECT array_agg(DISTINCT data) INTO datas FROM jsonb_to_recordset(p_eventos) AS linha(data text);
  IF datas IS NULL THEN RETURN 0; END IF;
  PERFORM pg_advisory_xact_lock(163, p_clube_id);
  DELETE FROM public.eventos e WHERE e.clube_id = p_clube_id AND public.agenda_data_iso(e.data) = ANY(datas);
  INSERT INTO public.eventos (clube_id, data, horario, local, atividade, responsavel, apoio, material, observacoes, semestre)
  SELECT p_clube_id, linha.data, linha.horario, linha.local, linha.atividade,
    linha.responsavel, linha.apoio, linha.material, linha.observacoes,
    CASE WHEN extract(month FROM linha.data::date) <= 6 THEN 1 ELSE 2 END
  FROM jsonb_to_recordset(p_eventos) AS linha(
    data text, horario text, local text, atividade text, responsavel text, apoio text, material text, observacoes text
  );
  GET DIAGNOSTICS inseridos = ROW_COUNT;
  RETURN inseridos;
END;
$$;

REVOKE ALL ON FUNCTION public.limpar_agenda_periodo(integer, integer, integer), public.substituir_agenda_datas(integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.limpar_agenda_periodo(integer, integer, integer), public.substituir_agenda_datas(integer, jsonb) TO authenticated;

COMMIT;
