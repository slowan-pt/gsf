-- 159_mestrados_progresso_e_retroativo.sql
-- Mestrados (requer 137, 139, 140 e 155):
--  1) mestrado_progresso(membro): andamento de CADA mestrado ativo para o membro (x de y, obrigatorias, etapa).
--     Usa a mesma contagem do reconhecimento automatico (mestrado_contagem), entao nunca diverge dele.
--  2) Os 4 mestrados "da area" (ADRA, Artes e Habilidades Manuais, Atividades Agricolas, Habilidades Domesticas)
--     foram preenchidos em 137 com as especialidades que existiam NAQUELA data. Aqui a lista e atualizada com o
--     catalogo de hoje (so ACRESCENTA o que faltava; nunca remove) e a regra ganha uma nova versao se mudou.
--  3) Verificacao RETROATIVA de todos os membros (idempotente: pode rodar de novo sem duplicar nada). Quem ja
--     cumpre os requisitos entra na fila da diretoria, como acontece hoje quando a ultima especialidade e aprovada.
--     Quem ja tem o mestrado (aprovado/investido) e preservado. Nada e inventado: so conta especialidade OK.
-- O resultado (membros avaliados, novos processos, etc.) aparece na tabela devolvida no fim.

-- ---------------------------------------------------------------------------
-- 1) Progresso de todos os mestrados ativos para um membro
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mestrado_progresso(p_dbv integer)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.mestrado_pode_ver_membro(p_dbv) THEN
    RAISE EXCEPTION 'Sem permissao.' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(t.linha ORDER BY t.ordem, t.nome)
    FROM (
      SELECT m.ordem_exibicao AS ordem, m.nome,
             jsonb_build_object(
               'id', m.id, 'codigo', m.codigo, 'nome', m.nome, 'imagem_url', m.imagem_url,
               'etapa', p.etapa, 'alerta_requisitos', COALESCE(p.alerta_requisitos, FALSE),
               'contagem', public.mestrado_contagem(p_dbv, m.id, '[]'::jsonb)) AS linha
      FROM public.mestrados m
      LEFT JOIN public.mestrado_processos p ON p.mestrado_id = m.id AND p.dbv_id = p_dbv
      WHERE m.situacao = 'ativo'
    ) t
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mestrado_progresso(integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) Mestrados "da area": acrescenta as especialidades do catalogo que ainda nao constavam
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_prog integer := (SELECT id FROM public.programas WHERE nome ILIKE '%desbravador%' ORDER BY id LIMIT 1);
  m public.mestrados%ROWTYPE;
  v_novas integer;
BEGIN
  FOR m IN SELECT * FROM public.mestrados
           WHERE codigo IN ('ME-001', 'ME-002', 'ME-003', 'ME-015') AND situacao = 'ativo' AND array_length(areas, 1) >= 1
           FOR UPDATE
  LOOP
    WITH novas AS (
      INSERT INTO public.mestrado_especialidades (mestrado_id, especialidade_id, obrigatoria)
      SELECT m.id, em.id, FALSE
      FROM public.especialidades_modelo em
      WHERE em.ativo = TRUE AND em.programa_id = v_prog
        AND public.mestrado_norm(em.nome) NOT LIKE 'mestr%'
        AND EXISTS (SELECT 1 FROM unnest(m.areas) a WHERE public.mestrado_norm(em.categoria) LIKE public.mestrado_norm(a) || '%')
      ON CONFLICT DO NOTHING
      RETURNING 1
    )
    SELECT count(*) INTO v_novas FROM novas;

    IF v_novas > 0 THEN
      UPDATE public.mestrados SET versao = versao + 1, atualizado_em = now() WHERE id = m.id;
      INSERT INTO public.mestrado_versoes (mestrado_id, versao, snapshot)
      SELECT x.id, x.versao, jsonb_build_object(
        'codigo', x.codigo, 'nome', x.nome, 'quantidade_exigida', x.quantidade_exigida, 'areas', x.areas,
        'fonte', x.fonte, 'edicao', x.edicao, 'observacoes', x.observacoes, 'situacao', x.situacao,
        'especialidades', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', me.especialidade_id, 'obrigatoria', me.obrigatoria, 'grupo_requisito', me.grupo_requisito)), '[]'::jsonb)
                            FROM public.mestrado_especialidades me WHERE me.mestrado_id = x.id))
      FROM public.mestrados x WHERE x.id = m.id
      ON CONFLICT (mestrado_id, versao) DO UPDATE SET snapshot = EXCLUDED.snapshot, criado_em = now();
      RAISE NOTICE '% : % especialidade(s) do catalogo acrescentadas a lista (nova versao).', m.codigo, v_novas;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3) Verificacao retroativa de todos os membros
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE IF NOT EXISTS _mestrado_retroativo (item text, valor integer);
TRUNCATE _mestrado_retroativo;

DO $$
DECLARE
  v_antes integer;
  v_avaliados integer;
BEGIN
  SELECT count(*) INTO v_antes FROM public.mestrado_processos;
  v_avaliados := public.mestrado_reavaliar_todos(NULL);
  INSERT INTO _mestrado_retroativo VALUES
    ('Membros avaliados', v_avaliados),
    ('Mestrados novos encaminhados a diretoria nesta verificacao', (SELECT count(*)::integer FROM public.mestrado_processos) - v_antes);
END $$;

SELECT item AS resultado, valor FROM _mestrado_retroativo
UNION ALL
SELECT 'Mestrados ativos', count(*)::integer FROM public.mestrados WHERE situacao = 'ativo'
UNION ALL
SELECT 'Mestrados em rascunho/inativos (nao avaliados)', count(*)::integer FROM public.mestrados WHERE situacao <> 'ativo'
UNION ALL
SELECT 'Processos - ' || etapa, count(*)::integer FROM public.mestrado_processos GROUP BY etapa
UNION ALL
SELECT 'Especialidades concluidas sem correspondente no catalogo (nao contam)',
       count(DISTINCT public.mestrado_norm(e.nome))::integer
  FROM public.especialidades e
 WHERE e.status = 'OK'
   AND NOT EXISTS (SELECT 1 FROM public.especialidades_modelo em WHERE public.mestrado_norm(em.nome) = public.mestrado_norm(e.nome))
ORDER BY 1;
