-- Investidura em duas etapas: aprovado (aguardando investidura) -> investido (recebido).
--
-- investidura_itens ja registra por membro/item (tipo, item_nome). Ganha o estado
-- intermediario e a data da investidura:
--   aguardando = true  -> concluido/aprovado, ainda nao recebeu em maos
--   entregue   = true  -> investido; entregue_em guarda a data da investidura
-- Itens antigos ficam como estao (aguardando = false): tudo que ja esta OK hoje e
-- tratado como "ja recebido", sem aparecer como pendente.

ALTER TABLE public.investidura_itens
  ADD COLUMN IF NOT EXISTS aguardando boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS entregue_em date,
  ADD COLUMN IF NOT EXISTS entregue_por uuid,
  ADD COLUMN IF NOT EXISTS origem text;

CREATE INDEX IF NOT EXISTS investidura_itens_aguardando_idx
  ON public.investidura_itens (clube_id, tipo)
  WHERE aguardando;

CREATE INDEX IF NOT EXISTS investidura_itens_entregue_em_idx
  ON public.investidura_itens (clube_id, entregue_em)
  WHERE entregue;

COMMENT ON COLUMN public.investidura_itens.aguardando IS 'Concluido/aprovado e aguardando a investidura (ainda nao recebido).';
COMMENT ON COLUMN public.investidura_itens.entregue_em IS 'Data da investidura em que o item foi entregue.';
COMMENT ON COLUMN public.investidura_itens.origem IS 'manual | atividade | classe';
