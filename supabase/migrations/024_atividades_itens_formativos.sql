-- Vincula atividades a classes/especialidades que ainda serão recebidas.
-- A aba final de Classes/Especialidades fica reservada para o que já foi entregue.

ALTER TABLE public.atividades
  ADD COLUMN IF NOT EXISTS item_formativo_tipo TEXT,
  ADD COLUMN IF NOT EXISTS item_formativo_nome TEXT,
  ADD COLUMN IF NOT EXISTS gera_investidura BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  ALTER TABLE public.atividades
    ADD CONSTRAINT atividades_item_formativo_tipo_check
    CHECK (item_formativo_tipo IS NULL OR item_formativo_tipo IN ('classe', 'especialidade'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_atividades_item_formativo
  ON public.atividades(clube_id, item_formativo_tipo, item_formativo_nome)
  WHERE item_formativo_tipo IS NOT NULL AND item_formativo_nome IS NOT NULL;
