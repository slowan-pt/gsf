BEGIN;

CREATE OR REPLACE FUNCTION public.current_user_can_change_atividade(target_clube_id integer)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.current_user_is_admin_ti()
    OR EXISTS (
      SELECT 1 FROM public.usuario_clubes uc
      WHERE uc.usuario_id = auth.uid()
        AND uc.clube_id = target_clube_id
        AND uc.ativo = TRUE
        AND uc.perfil IN ('admin_clube', 'usuario_diretoria', 'usuario_instrutor', 'usuario_secretaria')
    )
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_can_change_atividade(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_change_atividade(integer) TO authenticated;

-- Mantém criação e acompanhamento existentes, e habilita Instrutor na RPC
-- de salvamento e nas políticas permissivas já usadas pelo formulário.
CREATE OR REPLACE FUNCTION public.current_user_can_manage_atividades(target_clube_id integer)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT public.current_user_can_change_atividade(target_clube_id)
    OR EXISTS (
      SELECT 1 FROM public.usuario_clubes uc
      WHERE uc.usuario_id = auth.uid()
        AND uc.clube_id = target_clube_id
        AND uc.ativo = TRUE
        AND uc.perfil IN ('usuario_conselheiro', 'usuario_capelao', 'usuario_pastor')
    );
$$;

-- Políticas restritivas também valem quando outra política permite a operação.
DO $$
DECLARE
  tabela text;
  escopo text := 'public.current_user_can_change_atividade(clube_id)';
BEGIN
  FOREACH tabela IN ARRAY ARRAY['atividades', 'atividades_alvos', 'atividades_anexos'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS atividade_alterar_perfis ON public.%I', tabela);
    EXECUTE format('DROP POLICY IF EXISTS atividade_excluir_perfis ON public.%I', tabela);
    EXECUTE format(
      'CREATE POLICY atividade_alterar_perfis ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',
      tabela, escopo, escopo
    );
    EXECUTE format(
      'CREATE POLICY atividade_excluir_perfis ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (%s)',
      tabela, escopo
    );
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
