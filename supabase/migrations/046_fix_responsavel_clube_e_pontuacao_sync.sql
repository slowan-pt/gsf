-- Migration 046: two independent fixes
--
-- FIX 1: responsavel_membros.clube_id may be wrong for records created before
-- migration 045 when an existing row was found (old function only set ativo=true
-- without touching clube_id).  Correct source of truth is desbravadores.clube_id.

UPDATE public.responsavel_membros rm
SET
  clube_id   = d.clube_id,
  updated_at = NOW()
FROM public.desbravadores d
WHERE rm.membro_id = d.id
  AND rm.clube_id  != d.clube_id;

-- Derive programa_id from the clube's first programa when it is NULL.
UPDATE public.responsavel_membros rm
SET
  programa_id = p.id,
  updated_at  = NOW()
FROM (
  SELECT DISTINCT ON (clube_id) id, clube_id
  FROM public.programas
  ORDER BY clube_id, id
) p
WHERE rm.clube_id    = p.clube_id
  AND rm.programa_id IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 2: pontuacao_itens (managed by modelos.tsx admin screen) was not used by
-- pontuacaoStore, which instead read from legacy config_pontuacao_itens.
-- Migrate items that exist only in config_pontuacao_itens so they appear in the
-- Modelos screen after the store switch.
-- Items are copied only when there is no matching title (case-insensitive) in
-- pontuacao_itens for the same clube — avoids duplicates.

INSERT INTO public.pontuacao_itens
  (clube_id, programa_id, titulo, sigla, valor, ordem, ativo, padrao)
SELECT
  cpi.clube_id,
  COALESCE(
    (SELECT id FROM public.programas WHERE clube_id = cpi.clube_id ORDER BY id LIMIT 1),
    1
  )                                                                  AS programa_id,
  cpi.nome                                                           AS titulo,
  UPPER(LEFT(REGEXP_REPLACE(cpi.nome, '[^A-Za-z0-9]', '', 'g'), 4)) AS sigla,
  cpi.valor,
  COALESCE(
    (SELECT MAX(pi2.ordem) FROM public.pontuacao_itens pi2 WHERE pi2.clube_id = cpi.clube_id),
    0
  ) + ROW_NUMBER() OVER (PARTITION BY cpi.clube_id ORDER BY cpi.id) AS ordem,
  cpi.ativo::boolean,
  FALSE                                                              AS padrao
FROM public.config_pontuacao_itens cpi
WHERE cpi.clube_id IS NOT NULL
  AND cpi.ativo    = TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM public.pontuacao_itens pi
    WHERE pi.clube_id    = cpi.clube_id
      AND LOWER(pi.titulo) = LOWER(cpi.nome)
  );
