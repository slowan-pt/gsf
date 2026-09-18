-- Os tipos de ranking exibidos (DBV, Diretoria, Conselheiros, Unidades)
-- passam a ser configuráveis SEPARADAMENTE para diretoria e para membros
-- em geral, em vez de uma lista única compartilhada pelos dois públicos.
-- Ex.: a diretoria pode ver as 4 abas, enquanto membros em geral veem só
-- DBV e Unidades.

ALTER TABLE public.config_ranking
  ADD COLUMN IF NOT EXISTS diretoria_tipo_dbv BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS diretoria_tipo_diretoria BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS diretoria_tipo_conselheiros BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS diretoria_tipo_unidades BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS membros_tipo_dbv BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS membros_tipo_diretoria BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS membros_tipo_conselheiros BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS membros_tipo_unidades BOOLEAN NOT NULL DEFAULT true;

-- Migra quem já tinha configurado os campos únicos antigos (tipo_dbv etc.)
-- para os dois novos grupos, preservando a escolha anterior nos dois.
UPDATE public.config_ranking SET
  diretoria_tipo_dbv = tipo_dbv,
  diretoria_tipo_diretoria = tipo_diretoria,
  diretoria_tipo_conselheiros = tipo_conselheiros,
  diretoria_tipo_unidades = tipo_unidades,
  membros_tipo_dbv = tipo_dbv,
  membros_tipo_diretoria = tipo_diretoria,
  membros_tipo_conselheiros = tipo_conselheiros,
  membros_tipo_unidades = tipo_unidades
WHERE tipo_dbv IS NOT NULL;

ALTER TABLE public.config_ranking
  DROP COLUMN IF EXISTS tipo_dbv,
  DROP COLUMN IF EXISTS tipo_diretoria,
  DROP COLUMN IF EXISTS tipo_conselheiros,
  DROP COLUMN IF EXISTS tipo_unidades;
