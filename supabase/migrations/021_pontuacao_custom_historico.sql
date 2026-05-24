-- Mantem historico de pontuacoes personalizadas mesmo quando o item sai do menu.

ALTER TABLE IF EXISTS public.pontuacoes_custom
  ADD COLUMN IF NOT EXISTS item_nome text,
  ADD COLUMN IF NOT EXISTS item_valor integer;

UPDATE public.pontuacoes_custom pc
SET
  item_nome = COALESCE(pc.item_nome, i.nome),
  item_valor = COALESCE(pc.item_valor, i.valor)
FROM public.config_pontuacao_itens i
WHERE pc.item_id = i.id
  AND (pc.item_nome IS NULL OR pc.item_valor IS NULL);

ALTER TABLE IF EXISTS public.pontuacoes_custom
  ALTER COLUMN item_id DROP NOT NULL;

DO $$
DECLARE
  v_constraint text;
BEGIN
  SELECT tc.constraint_name
    INTO v_constraint
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_schema = tc.constraint_schema
   AND kcu.constraint_name = tc.constraint_name
   AND kcu.table_name = tc.table_name
  WHERE tc.constraint_schema = 'public'
    AND tc.table_name = 'pontuacoes_custom'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'item_id'
  LIMIT 1;

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.pontuacoes_custom DROP CONSTRAINT %I', v_constraint);
  END IF;
END $$;

ALTER TABLE public.pontuacoes_custom
  ADD CONSTRAINT pontuacoes_custom_item_id_fkey
  FOREIGN KEY (item_id)
  REFERENCES public.config_pontuacao_itens(id)
  ON DELETE SET NULL;
