-- 073_fix_pontuacoes_clube_e_item_fk.sql
-- Corrige os dois motivos pelos quais pontuações "salvavam" mas sumiam.
--
-- (1) FK errada em pontuacoes_custom.item_id
--     A FK aponta para config_pontuacao_itens (tabela legada, pré multi-clube),
--     mas o app web lê a lista de itens de pontuacao_itens (tabela multi-clube,
--     migração 010) e grava esses ids em pontuacoes_custom.item_id. Qualquer item
--     cujo id não exista também na tabela legada faz o INSERT falhar com violação
--     de chave estrangeira (23503) — derrubando o salvamento inteiro da tela.
--     A migração 021 já tinha tornado item_id anulável e ON DELETE SET NULL,
--     porque o histórico real é preservado em item_nome/item_valor. Portanto a FK
--     não agrega integridade útil aqui e é removida.
--
-- (2) Linhas com clube_id NULL
--     O app instalado (nativo) enfileirava as gravações sem clube_id, então as
--     linhas chegavam ao Supabase com clube_id NULL. Como todas as telas filtram
--     por .eq('clube_id', ...), esses lançamentos ficavam invisíveis — parecia
--     que não tinham salvo. O código já foi corrigido para enviar clube_id; aqui
--     recuperamos as linhas órfãs, herdando o clube do próprio membro.

-- ── (1) Remove a FK que aponta para a tabela legada ──────────────────────────
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

-- ── (2) Recupera lançamentos que ficaram sem clube ───────────────────────────
UPDATE public.pontuacoes p
SET clube_id = dbv.clube_id
FROM public.desbravadores dbv
WHERE p.dbv_id = dbv.id
  AND p.clube_id IS NULL
  AND dbv.clube_id IS NOT NULL;

UPDATE public.pontuacoes_custom pc
SET clube_id = dbv.clube_id
FROM public.desbravadores dbv
WHERE pc.dbv_id = dbv.id
  AND pc.clube_id IS NULL
  AND dbv.clube_id IS NOT NULL;

UPDATE public.pontuacoes_unidades
SET clube_id = 1
WHERE clube_id IS NULL;
