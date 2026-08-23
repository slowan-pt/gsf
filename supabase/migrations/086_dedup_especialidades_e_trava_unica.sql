-- Corrige duplicatas de especialidade por membro (ex.: "Cultura Física"
-- aparecendo duas vezes) e garante que não volte a acontecer.
--
-- Causa: a tabela especialidades já existia neste banco antes da migração
-- que definia UNIQUE(dbv_id, nome) (001_schema.sql usa CREATE TABLE IF NOT
-- EXISTS, que não adiciona a trava numa tabela já existente). Sem a trava,
-- tanto marcações manuais quanto importações conseguiam criar duas linhas
-- pra "a mesma" especialidade.

-- 1) Mescla duplicatas: mantém a linha mais antiga (menor id) de cada grupo
--    dbv_id + nome normalizado (sem espaço nas pontas/duplo, sem diferença
--    de maiúscula), apaga as demais.
WITH normalizado AS (
  SELECT
    id,
    dbv_id,
    lower(regexp_replace(trim(nome), '\s+', ' ', 'g')) AS nome_norm,
    ROW_NUMBER() OVER (
      PARTITION BY dbv_id, lower(regexp_replace(trim(nome), '\s+', ' ', 'g'))
      ORDER BY id
    ) AS rn
  FROM public.especialidades
)
DELETE FROM public.especialidades e
USING normalizado n
WHERE e.id = n.id AND n.rn > 1;

-- 2) Padroniza o nome da linha que sobrou (tira espaço nas pontas e colapsa
--    espaço duplo no meio) pra bater com o que o app agora grava.
UPDATE public.especialidades
SET nome = regexp_replace(trim(nome), '\s+', ' ', 'g')
WHERE nome <> regexp_replace(trim(nome), '\s+', ' ', 'g');

-- 3) Garante a trava UNIQUE(dbv_id, nome) — idempotente, não falha se já existir.
DO $$
BEGIN
  ALTER TABLE public.especialidades ADD CONSTRAINT especialidades_dbv_id_nome_key UNIQUE (dbv_id, nome);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;
