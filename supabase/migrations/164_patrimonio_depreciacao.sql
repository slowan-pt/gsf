BEGIN;

ALTER TABLE public.patrimonio_itens
  ADD COLUMN IF NOT EXISTS inicio_depreciacao date CHECK (inicio_depreciacao >= data_aquisicao),
  ADD COLUMN IF NOT EXISTS vida_util_meses integer CHECK (vida_util_meses BETWEEN 1 AND 1200),
  ADD COLUMN IF NOT EXISTS valor_residual numeric(12, 2) CHECK (valor_residual BETWEEN 0 AND valor_aquisicao);

COMMENT ON COLUMN public.patrimonio_itens.inicio_depreciacao IS 'Data em que o bem ficou disponível para uso.';
COMMENT ON COLUMN public.patrimonio_itens.vida_util_meses IS 'Vida útil econômica estimada para a depreciação linear.';
COMMENT ON COLUMN public.patrimonio_itens.valor_residual IS 'Valor residual estimado ao fim da vida útil, para toda a quantidade do item.';

NOTIFY pgrst, 'reload schema';
COMMIT;
