-- 125_isolamento_entre_clubes_2.sql
-- Segunda leva do isolamento entre clubes (a 124 tratou membros, pontuações,
-- eventos, documentos e progresso). Mesmas tabelas com is_admin() global na
-- escrita e leitura aberta a qualquer logado, todas com coluna clube_id:
--   config_pontuacao, config_pontuacao_itens, documento_tipos, especialidades,
--   mensagens_clube, pontuacoes_custom, pontuacoes_extras_itens, unidades.
-- Escrita: só a equipe do clube da linha (is_staff_clube, criada na 124).
-- Leitura: quem tem vínculo com o clube (current_user_has_clube, inclui pais).
-- Nas tabelas de configuração e em unidades, linhas sem clube (clube_id NULL,
-- legado/modelo) continuam legíveis para todos, para não sumir nada.
-- Fora daqui de propósito: push_tokens, usuarios (insert) e as tabelas do
-- Campori (recurso descontinuado) — dependem de decisão/coluna a confirmar.

DO $$
DECLARE
  t RECORD;
  leitura TEXT;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('config_pontuacao',        'admin_all_config_pontuacao',        'authenticated_select_config_pontuacao',        TRUE),
      ('config_pontuacao_itens',  'admin_all_config_pontuacao_itens',  'authenticated_select_config_pontuacao_itens',  TRUE),
      ('documento_tipos',         'admin_all_documento_tipos',         'authenticated_select_documento_tipos',         TRUE),
      ('especialidades',          'admin_all_especialidades',          'authenticated_select_especialidades',          TRUE),
      ('unidades',                'admin_all_unidades',                'authenticated_select_unidades',                TRUE),
      ('mensagens_clube',         'admin_all_mensagens',               'authenticated_select_mensagens',               FALSE),
      ('pontuacoes_custom',       'admin_all_pontuacoes_custom',       'authenticated_select_pontuacoes_custom',       FALSE),
      ('pontuacoes_extras_itens', 'admin_all_pontuacoes_extras_itens', 'authenticated_select_pontuacoes_extras_itens', FALSE)
    ) AS v(tabela, pol_admin, pol_select, permite_sem_clube)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t.pol_admin, t.tabela);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t.pol_select, t.tabela);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t.tabela || '_staff_clube_all', t.tabela);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t.tabela || '_select_clube', t.tabela);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_staff_clube(clube_id::integer)) WITH CHECK (public.is_staff_clube(clube_id::integer))',
      t.tabela || '_staff_clube_all', t.tabela);

    leitura := CASE WHEN t.permite_sem_clube
      THEN 'clube_id IS NULL OR public.current_user_has_clube(clube_id::integer)'
      ELSE 'public.current_user_has_clube(clube_id::integer)' END;
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)',
      t.tabela || '_select_clube', t.tabela, leitura);
  END LOOP;
END
$$;
