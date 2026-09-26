-- 131_urls_catalogo_mda_para_r2.sql
-- As insígnias do catálogo de especialidades (bucket público catalogo-mda,
-- ~624 arquivos de 39 kB) eram servidas direto do Storage do Supabase: cada
-- abertura de uma lista de especialidades baixava dezenas de MB. Aponta as URLs
-- para o Worker dbvplus-arquivos (Cloudflare R2, cache longo na borda).
--
-- Os arquivos NÃO são apagados do Supabase: o Worker copia cada um para o R2 na
-- primeira leitura e as URLs antigas continuam funcionando. Para desfazer, troque
-- os prefixos de volta (NOVO -> ANTIGO). Requer o Worker já publicado com o
-- bucket catalogo-mda.

DO $$
DECLARE
  antigo  text := 'https://enoacjmlcznsrvynnamf.supabase.co/storage/v1/object/public/catalogo-mda/';
  novo    text := 'https://dbvplus-arquivos.slowgithub.workers.dev/catalogo-mda/';
  col     record;
  qtd     bigint;
BEGIN
  FOR col IN
    SELECT c.table_name, c.column_name, c.data_type
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public'
      AND c.data_type IN ('text', 'character varying', 'jsonb')
  LOOP
    IF col.data_type = 'jsonb' THEN
      EXECUTE format('SELECT count(*) FROM public.%I WHERE %I::text LIKE %L',
        col.table_name, col.column_name, '%' || antigo || '%') INTO qtd;
    ELSE
      EXECUTE format('SELECT count(*) FROM public.%I WHERE %I LIKE %L',
        col.table_name, col.column_name, '%' || antigo || '%') INTO qtd;
    END IF;

    IF qtd > 0 THEN
      RAISE NOTICE 'Atualizando %.% (%): % linhas', col.table_name, col.column_name, col.data_type, qtd;
      IF col.data_type = 'jsonb' THEN
        EXECUTE format(
          'UPDATE public.%I SET %I = replace(%I::text, %L, %L)::jsonb WHERE %I::text LIKE %L',
          col.table_name, col.column_name, col.column_name, antigo, novo,
          col.column_name, '%' || antigo || '%');
      ELSE
        EXECUTE format(
          'UPDATE public.%I SET %I = replace(%I, %L, %L) WHERE %I LIKE %L',
          col.table_name, col.column_name, col.column_name, antigo, novo,
          col.column_name, '%' || antigo || '%');
      END IF;
    END IF;
  END LOOP;
END $$;
