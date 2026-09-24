-- Aponta as URLs de fotos e anexos públicos para o Cloudflare R2 (Worker
-- dbvplus-arquivos), em vez do Storage do Supabase.
--
-- Os arquivos antigos NÃO são apagados do Supabase: o Worker copia cada arquivo
-- para o R2 na primeira leitura, e as URLs antigas continuam funcionando
-- (inclusive nos aparelhos com cache antigo). Para desfazer, troque os prefixos
-- de volta (NOVO -> ANTIGO abaixo).
--
-- Só os buckets públicos fotos_membros e atividades são afetados. Documentos,
-- backup do ranking e requisitos (privados) continuam no Supabase.

-- PASSO 1 (conferência, não altera nada): onde há URLs antigas.
-- SELECT c.table_name, c.column_name, c.data_type
-- FROM information_schema.columns c
-- JOIN information_schema.tables t
--   ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
-- WHERE c.table_schema = 'public' AND c.data_type IN ('text', 'character varying', 'jsonb');
-- (o PASSO 2 já testa cada coluna e só atualiza as que têm URL antiga)

-- PASSO 2: reescreve as URLs.
DO $$
DECLARE
  antigo_fotos  text := 'https://enoacjmlcznsrvynnamf.supabase.co/storage/v1/object/public/fotos_membros/';
  novo_fotos    text := 'https://dbvplus-arquivos.slowgithub.workers.dev/fotos_membros/';
  antigo_ativ   text := 'https://enoacjmlcznsrvynnamf.supabase.co/storage/v1/object/public/atividades/';
  novo_ativ     text := 'https://dbvplus-arquivos.slowgithub.workers.dev/atividades/';
  col           record;
  qtd           bigint;
BEGIN
  FOR col IN
    SELECT c.table_name, c.column_name, c.data_type
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public'
      AND c.data_type IN ('text', 'character varying', 'jsonb')
  LOOP
    -- jsonb guarda URLs no meio do texto: repete o teste sem exigir o início.
    IF col.data_type = 'jsonb' THEN
      EXECUTE format(
        'SELECT count(*) FROM public.%I WHERE %I::text LIKE %L OR %I::text LIKE %L',
        col.table_name, col.column_name, '%' || antigo_fotos || '%',
        col.column_name, '%' || antigo_ativ || '%'
      ) INTO qtd;
    ELSE
      -- texto puro: também cobre URLs no meio do texto (ex.: HTML/markdown).
      EXECUTE format(
        'SELECT count(*) FROM public.%I WHERE %I LIKE %L OR %I LIKE %L',
        col.table_name, col.column_name, '%' || antigo_fotos || '%',
        col.column_name, '%' || antigo_ativ || '%'
      ) INTO qtd;
    END IF;

    IF qtd > 0 THEN
      RAISE NOTICE 'Atualizando %.% (%): % linhas', col.table_name, col.column_name, col.data_type, qtd;
      IF col.data_type = 'jsonb' THEN
        EXECUTE format(
          'UPDATE public.%I SET %I = replace(replace(%I::text, %L, %L), %L, %L)::jsonb WHERE %I::text LIKE %L OR %I::text LIKE %L',
          col.table_name, col.column_name, col.column_name,
          antigo_fotos, novo_fotos, antigo_ativ, novo_ativ,
          col.column_name, '%' || antigo_fotos || '%',
          col.column_name, '%' || antigo_ativ || '%'
        );
      ELSE
        EXECUTE format(
          'UPDATE public.%I SET %I = replace(replace(%I, %L, %L), %L, %L) WHERE %I LIKE %L OR %I LIKE %L',
          col.table_name, col.column_name, col.column_name,
          antigo_fotos, novo_fotos, antigo_ativ, novo_ativ,
          col.column_name, '%' || antigo_fotos || '%',
          col.column_name, '%' || antigo_ativ || '%'
        );
      END IF;
    END IF;
  END LOOP;
END $$;
