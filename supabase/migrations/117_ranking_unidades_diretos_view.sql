-- Soma no banco os pontos lançados direto nas unidades (pontuacoes_unidades),
-- por unidade e por ano, em vez de o app baixar todos os lançamentos.
--
-- Complementa a ranking_totais (migration 111): o ranking de unidades usa os
-- totais por membro dessa view + os totais diretos desta, e só baixa a lista
-- de membros ativos (algumas dezenas de linhas).
--
-- security_invoker = on: roda com as permissões de quem consulta (herda o RLS).

DROP VIEW IF EXISTS public.ranking_unidades_diretos;

CREATE VIEW public.ranking_unidades_diretos
WITH (security_invoker = on)
AS
SELECT
  pu.clube_id,
  pu.unidade_id,
  pu.unidade_nome,
  EXTRACT(YEAR FROM pu.data::date)::int AS ano,
  SUM(COALESCE(pu.pontos, 0))::numeric AS total
FROM public.pontuacoes_unidades pu
WHERE pu.clube_id IS NOT NULL
GROUP BY pu.clube_id, pu.unidade_id, pu.unidade_nome, EXTRACT(YEAR FROM pu.data::date)::int;

COMMENT ON VIEW public.ranking_unidades_diretos IS
  'Pontos lançados direto nas unidades, somados por unidade e por ano.';

GRANT SELECT ON public.ranking_unidades_diretos TO authenticated;

CREATE INDEX IF NOT EXISTS idx_pontuacoes_unidades_clube_data
  ON public.pontuacoes_unidades (clube_id, data);
