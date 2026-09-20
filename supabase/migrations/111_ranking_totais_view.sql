-- Soma a pontuação no banco, em vez de baixar todos os lançamentos pro app.
--
-- Por quê: o ranking somava no cliente, então precisava baixar UMA LINHA POR
-- LANÇAMENTO do clube inteiro (hoje ~1.600, crescendo alguns milhares por ano).
-- Além de pesado, foi o que abriu espaço pro bug do teto de mil linhas do
-- PostgREST. Com esta view o app baixa uma linha por membro/ano (~dezenas) e
-- o total já vem pronto, independente do tamanho do histórico.
--
-- IMPORTANTE — a soma aqui tem que ser idêntica a somaPontuacaoBase() de
-- src/lib/categoriasPontuacao.ts. Uma categoria nova precisa entrar nos dois
-- lugares; scripts/verify-soma-sql.mjs falha o build se divergirem.
--
-- security_invoker = on: a view roda com as permissões de quem consulta, então
-- herda as políticas RLS de pontuacoes/pontuacoes_custom em vez de ignorá-las.

DROP VIEW IF EXISTS public.ranking_totais;

CREATE VIEW public.ranking_totais
WITH (security_invoker = on)
AS
WITH base AS (
  -- Lançamentos regulares: presença/pontualidade/material/uniforme usam o
  -- valor gravado na linha (*_pts) e, nos lançamentos antigos que não têm
  -- esse valor, caem pro configurado em config_pontuacao — mesma regra do app.
  SELECT
    p.clube_id,
    p.dbv_id,
    EXTRACT(YEAR FROM p.data::date)::int AS ano,
    (
        COALESCE(p.presenca_pts,     p.presenca     * COALESCE(c.presenca, 25),      0)
      + COALESCE(p.pontualidade_pts, p.pontualidade * COALESCE(c.pontualidade, 100), 0)
      + COALESCE(p.material_pts,     p.material     * COALESCE(c.material, 25),      0)
      + COALESCE(p.uniforme_pts,     p.uniforme     * COALESCE(c.uniforme, 25),      0)
      + COALESCE(p.pontos_extras, 0)
      + COALESCE(p.bom_biblia, 0)
      + COALESCE(p.classe_biblica, 0)
      + COALESCE(p.especialidade, 0)
      + COALESCE(p.pgm_especial, 0)
      + COALESCE(p.atividade_unidade, 0)
    )::numeric AS pontos
  FROM public.pontuacoes p
  LEFT JOIN public.config_pontuacao c ON c.clube_id = p.clube_id

  UNION ALL

  -- Pontuações personalizadas (itens configuráveis do clube).
  SELECT
    pc.clube_id,
    pc.dbv_id,
    EXTRACT(YEAR FROM pc.data::date)::int AS ano,
    COALESCE(pc.pontos, 0)::numeric AS pontos
  FROM public.pontuacoes_custom pc
)
SELECT
  clube_id,
  dbv_id,
  ano,
  SUM(pontos) AS total
FROM base
WHERE clube_id IS NOT NULL AND dbv_id IS NOT NULL
GROUP BY clube_id, dbv_id, ano;

COMMENT ON VIEW public.ranking_totais IS
  'Total de pontos por membro e por ano, já somado no banco. Mantenha a soma igual a somaPontuacaoBase() de src/lib/categoriasPontuacao.ts.';

GRANT SELECT ON public.ranking_totais TO authenticated;

-- Índices que a agregação usa. IF NOT EXISTS: rodar de novo é seguro.
CREATE INDEX IF NOT EXISTS idx_pontuacoes_clube_dbv_data
  ON public.pontuacoes (clube_id, dbv_id, data);
CREATE INDEX IF NOT EXISTS idx_pontuacoes_custom_clube_dbv_data
  ON public.pontuacoes_custom (clube_id, dbv_id, data);
