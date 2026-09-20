-- Diagnóstico: por que o Ranking e o Extrato mostram totais diferentes
-- para o mesmo membro. NÃO altera nada — são só consultas de leitura.
-- Rode no SQL Editor do Supabase e me mande os 4 resultados.

-- ───────────────────────────────────────────────────────────────────
-- 1) O clube passa do limite de 1000 linhas por query do PostgREST?
--    Se "total_pontuacoes" > 1000, o ranking está lendo só parte dos
--    lançamentos (o extrato, por filtrar 1 membro, lê tudo).
-- ───────────────────────────────────────────────────────────────────
SELECT
  clube_id,
  COUNT(*)                          AS total_pontuacoes,
  COUNT(*) > 1000                   AS passa_do_limite_1000
FROM public.pontuacoes
GROUP BY clube_id
ORDER BY total_pontuacoes DESC;

-- ───────────────────────────────────────────────────────────────────
-- 2) Existem lançamentos com clube_id nulo ou de outro clube?
--    O ranking filtra por clube_id, o extrato não — se houver linhas
--    "órfãs", elas entram só no extrato.
-- ───────────────────────────────────────────────────────────────────
SELECT
  COUNT(*) FILTER (WHERE clube_id IS NULL)     AS pontuacoes_sem_clube,
  COUNT(*) FILTER (WHERE programa_id IS NULL)  AS pontuacoes_sem_programa,
  COUNT(DISTINCT clube_id)                     AS clubes_distintos
FROM public.pontuacoes;

-- ───────────────────────────────────────────────────────────────────
-- 3) O total REAL da Manuela, do jeito que o app calcula a soma
--    (presença/pontualidade/material/uniforme + extras + as 5
--    categorias diretas), separando por clube_id.
--    Compare "total_calculado" com o que aparece nas telas.
-- ───────────────────────────────────────────────────────────────────
WITH cfg AS (
  SELECT clube_id, presenca, pontualidade, material, uniforme
  FROM public.config_pontuacao
),
alvo AS (
  SELECT id, nome, clube_id
  FROM public.desbravadores
  WHERE nome ILIKE '%Manuela%'
)
SELECT
  a.nome,
  p.clube_id                                    AS clube_id_do_lancamento,
  a.clube_id                                    AS clube_id_do_membro,
  COUNT(*)                                      AS qtd_lancamentos,
  SUM(
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
  )                                             AS total_calculado,
  MIN(p.data)                                   AS primeiro_lancamento,
  MAX(p.data)                                   AS ultimo_lancamento
FROM alvo a
JOIN public.pontuacoes p ON p.dbv_id = a.id
LEFT JOIN cfg c ON c.clube_id = p.clube_id
GROUP BY a.nome, p.clube_id, a.clube_id
ORDER BY a.nome, p.clube_id;

-- ───────────────────────────────────────────────────────────────────
-- 4) Pontuações personalizadas da Manuela (entram nos dois fluxos,
--    mas o ranking filtra por clube_id e o extrato não).
-- ───────────────────────────────────────────────────────────────────
SELECT
  d.nome,
  pc.clube_id,
  COUNT(*)            AS qtd,
  SUM(pc.pontos)      AS total_custom
FROM public.desbravadores d
JOIN public.pontuacoes_custom pc ON pc.dbv_id = d.id
WHERE d.nome ILIKE '%Manuela%'
GROUP BY d.nome, pc.clube_id
ORDER BY d.nome;
