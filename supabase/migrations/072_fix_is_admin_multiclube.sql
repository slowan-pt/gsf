-- 072_fix_is_admin_multiclube.sql
-- Corrige is_admin(): estava checando só usuarios.perfil (modelo antigo, um
-- perfil global por usuário), sem olhar usuario_clubes.perfil (modelo
-- multi-clube atual, um perfil por clube). Isso bloqueava silenciosamente
-- (via RLS) qualquer INSERT/UPDATE em pontuacoes, pontuacoes_custom,
-- config_pontuacao, config_pontuacao_itens e eventos para usuários cujo
-- perfil de admin/conselheiro/diretoria só existe em usuario_clubes.
-- Também faltava 'usuario_conselheiro', que tem permissão de
-- gerenciar_pontuacao no app (src/lib/permissoes.ts) mas nunca foi
-- liberado aqui.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_user_perfil(), '') IN (
    'admin_total', 'admin_geral', 'admin_diretoria',
    'admin_ti', 'admin_clube', 'usuario_diretoria',
    'usuario_secretaria', 'usuario_conselheiro'
  )
  OR public.current_user_is_admin_ti()
  OR EXISTS (
    SELECT 1
    FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid()
      AND uc.ativo = TRUE
      AND uc.perfil IN (
        'admin_ti', 'admin_clube', 'usuario_diretoria',
        'usuario_secretaria', 'usuario_conselheiro'
      )
  )
$$;
