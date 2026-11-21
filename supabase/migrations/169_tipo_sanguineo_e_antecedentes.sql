BEGIN;

ALTER TABLE public.desbravadores
  ADD COLUMN IF NOT EXISTS tipo_sanguineo text CHECK (tipo_sanguineo IN ('A', 'B', 'AB', 'O')),
  ADD COLUMN IF NOT EXISTS fator_rh text CHECK (fator_rh IN ('+', '-'));

CREATE OR REPLACE FUNCTION public.pendencias_antecedentes_diretoria(p_clube_id integer)
RETURNS TABLE (membro_id integer, nome text, vence_em date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  WITH autorizacao AS (
    SELECT EXISTS (
      SELECT 1 FROM public.usuario_clubes uc
      WHERE uc.usuario_id = auth.uid() AND uc.clube_id = p_clube_id AND uc.ativo
        AND uc.perfil IN ('admin_clube', 'usuario_secretaria')
    ) AS permitido
  ), vencimentos AS (
    SELECT d.id, d.nome, (
      (max(di.created_at) AT TIME ZONE 'America/Sao_Paulo')::date + interval '6 months'
    )::date AS validade
    FROM autorizacao a
    JOIN public.desbravadores d ON a.permitido AND d.clube_id = p_clube_id
    LEFT JOIN public.documento_imagens di
      ON di.dbv_id = d.id AND di.clube_id = p_clube_id AND di.campo = 'ant_criminais'
    WHERE d.ativo IS DISTINCT FROM FALSE AND lower(trim(d.unidade_nome)) = 'diretoria'
    GROUP BY d.id, d.nome
  )
  SELECT v.id, v.nome, v.validade
  FROM vencimentos v
  WHERE v.validade IS NULL OR v.validade <= (now() AT TIME ZONE 'America/Sao_Paulo')::date
  ORDER BY v.nome, v.id
$$;

REVOKE ALL ON FUNCTION public.pendencias_antecedentes_diretoria(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pendencias_antecedentes_diretoria(integer) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
