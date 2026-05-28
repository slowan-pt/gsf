-- Supabase Data API grants, explicit as required for tables created after the
-- 2026 rollout. RLS remains responsible for row-level authorization.
--
-- Keep this list in sync whenever a new table is accessed through supabase-js.
-- Do not use ALTER DEFAULT PRIVILEGES here: new sensitive tables should not
-- become API-visible until their RLS policies and intended grants are reviewed.

GRANT USAGE ON SCHEMA public TO authenticated, service_role;

DO $$
DECLARE
  api_table text;
  sequence_name text;
  authenticated_tables constant text[] := ARRAY[
    'usuarios',
    'unidades',
    'desbravadores',
    'documentos',
    'documento_tipos',
    'documento_status',
    'documento_imagens',
    'progresso_classes',
    'especialidades',
    'eventos',
    'pontuacoes',
    'config_pontuacao',
    'config_pontuacao_itens',
    'pontuacoes_custom',
    'config_campori',
    'parcelas_campori_config',
    'pagamentos_campori',
    'push_tokens',
    'mensagens_clube',
    'atividades',
    'atividades_alvos',
    'atividades_anexos',
    'atividades_respostas',
    'atividades_mensagens',
    'planos_formativos',
    'configuracoes_visuais_clube',
    'lgpd_termos',
    'lgpd_aceites',
    'programas',
    'clubes',
    'perfis_acesso',
    'usuario_clubes',
    'responsavel_membros',
    'responsavel_convites',
    'classes_modelo',
    'cargos_modelo',
    'documentos_modelo',
    'especialidades_modelo',
    'mda_requisitos_modelo',
    'pontuacao_itens',
    'documentos_pais_config',
    'investidura_itens',
    'membros',
    'clubes_onboarding_status',
    'importacoes_lote',
    'importacoes_lote_itens',
    'relatorios_modelo',
    'arquivos_registro',
    'auditoria_eventos',
    'pre_cadastro_links',
    'pre_cadastros',
    'pre_cadastro_responsaveis',
    'whatsapp_config',
    'whatsapp_fila',
    'ranking_clubes_requisitos',
    'ranking_clubes_pontuacoes',
    'ranking_clubes_niveis'
  ];
BEGIN
  FOREACH api_table IN ARRAY authenticated_tables LOOP
    IF to_regclass(format('public.%I', api_table)) IS NOT NULL THEN
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated, service_role',
        api_table
      );

      IF EXISTS (
        SELECT 1
        FROM information_schema.columns AS c
        WHERE c.table_schema = 'public'
          AND c.table_name = api_table
          AND c.column_name = 'id'
      ) THEN
        sequence_name := pg_get_serial_sequence(format('public.%I', api_table), 'id');
        IF sequence_name IS NOT NULL THEN
          EXECUTE format(
            'GRANT USAGE, SELECT ON SEQUENCE %s TO authenticated, service_role',
            sequence_name
          );
        END IF;
      END IF;
    END IF;
  END LOOP;
END
$$;

-- Anonymous access is deliberately narrow. These are the public Data API
-- operations used before authentication in the pre-registration journey.
GRANT USAGE ON SCHEMA public TO anon;

DO $$
BEGIN
  IF to_regclass('public.pre_cadastro_links') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.pre_cadastro_links TO anon;
  END IF;
  IF to_regclass('public.pre_cadastros') IS NOT NULL THEN
    GRANT INSERT ON TABLE public.pre_cadastros TO anon;
  END IF;
  IF to_regclass('public.pre_cadastro_responsaveis') IS NOT NULL THEN
    GRANT INSERT ON TABLE public.pre_cadastro_responsaveis TO anon;
  END IF;
END
$$;
