-- 127_perfil_permissoes.sql
-- Matriz de permissões por perfil, editável pelo Admin TI (tela Permissões).
-- Semeada com o padrão de fábrica do app. O servidor passa a consultar esta
-- tabela para 'gerenciar_membros' e 'gerenciar_documentos' (ver funções abaixo);
-- as demais permissões controlam só o que aparece no app.
-- Requer a migration 126 (can_manage_members_clube).

CREATE TABLE IF NOT EXISTS public.perfil_permissoes (
  perfil     TEXT NOT NULL,
  permissao  TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (perfil, permissao)
);

ALTER TABLE public.perfil_permissoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "perfil_permissoes_select" ON public.perfil_permissoes;
DROP POLICY IF EXISTS "perfil_permissoes_admin_ti_all" ON public.perfil_permissoes;

CREATE POLICY "perfil_permissoes_select" ON public.perfil_permissoes
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "perfil_permissoes_admin_ti_all" ON public.perfil_permissoes
  FOR ALL TO authenticated
  USING (public.current_user_is_admin_ti())
  WITH CHECK (public.current_user_is_admin_ti());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfil_permissoes TO authenticated;

INSERT INTO public.perfil_permissoes (perfil, permissao) VALUES
  ('admin_clube', 'admin_clube'),
  ('admin_clube', 'gerenciar_acessos'),
  ('admin_clube', 'gerenciar_membros'),
  ('admin_clube', 'gerenciar_pontuacao'),
  ('admin_clube', 'gerenciar_unidades'),
  ('admin_clube', 'gerenciar_agenda'),
  ('admin_clube', 'gerenciar_atividades'),
  ('admin_clube', 'enviar_mensagens'),
  ('admin_clube', 'ver_relatorios'),
  ('admin_clube', 'ver_financeiro'),
  ('admin_clube', 'ver_filhos'),
  ('admin_clube', 'ver_unidade'),
  ('admin_clube', 'validar_classes'),
  ('usuario_secretaria', 'gerenciar_membros'),
  ('usuario_secretaria', 'gerenciar_documentos'),
  ('usuario_secretaria', 'gerenciar_atividades'),
  ('usuario_secretaria', 'gerenciar_agenda'),
  ('usuario_secretaria', 'enviar_mensagens'),
  ('usuario_secretaria', 'ver_relatorios'),
  ('usuario_secretaria', 'ver_unidade'),
  ('usuario_secretaria', 'validar_classes'),
  ('usuario_tesouraria', 'ver_financeiro'),
  ('usuario_tesouraria', 'ver_relatorios'),
  ('usuario_conselheiro', 'gerenciar_pontuacao'),
  ('usuario_conselheiro', 'gerenciar_atividades'),
  ('usuario_conselheiro', 'gerenciar_agenda'),
  ('usuario_conselheiro', 'ver_relatorios'),
  ('usuario_conselheiro', 'ver_unidade'),
  ('usuario_conselheiro', 'validar_classes'),
  ('usuario_diretoria', 'gerenciar_pontuacao'),
  ('usuario_diretoria', 'gerenciar_unidades'),
  ('usuario_diretoria', 'gerenciar_agenda'),
  ('usuario_diretoria', 'gerenciar_atividades'),
  ('usuario_diretoria', 'enviar_mensagens'),
  ('usuario_diretoria', 'ver_relatorios'),
  ('usuario_diretoria', 'ver_financeiro'),
  ('usuario_diretoria', 'ver_unidade'),
  ('usuario_diretoria', 'validar_classes'),
  ('usuario_instrutor', 'gerenciar_pontuacao'),
  ('usuario_instrutor', 'gerenciar_atividades'),
  ('usuario_instrutor', 'gerenciar_agenda'),
  ('usuario_instrutor', 'ver_relatorios'),
  ('usuario_instrutor', 'ver_unidade'),
  ('usuario_instrutor', 'validar_classes'),
  ('usuario_regional', 'validar_classes'),
  ('usuario_distrital', 'ver_relatorios'),
  ('usuario_distrital', 'ver_unidade'),
  ('usuario_pastor', 'ver_relatorios'),
  ('usuario_pastor', 'ver_unidade'),
  ('usuario_capelao', 'gerenciar_atividades'),
  ('usuario_capelao', 'enviar_mensagens'),
  ('usuario_capelao', 'ver_relatorios'),
  ('usuario_capelao', 'ver_unidade'),
  ('usuario_pais', 'ver_filhos'),
  ('responsavel', 'ver_filhos')
ON CONFLICT DO NOTHING;

-- O perfil tem a permissão no clube? Sem nenhuma linha para o perfil (tabela
-- vazia/limpa), vale o padrão de fábrica de membros: admin_clube e secretaria.
CREATE OR REPLACE FUNCTION public.perfil_tem_permissao(target_clube_id integer, perm text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid()
      AND uc.clube_id = target_clube_id
      AND uc.ativo = TRUE
      AND (
        EXISTS (
          SELECT 1 FROM public.perfil_permissoes pp
          WHERE pp.perfil = uc.perfil AND pp.permissao = perm
        )
        OR (
          NOT EXISTS (SELECT 1 FROM public.perfil_permissoes pp2 WHERE pp2.perfil = uc.perfil)
          AND perm IN ('gerenciar_membros', 'gerenciar_documentos')
          AND uc.perfil IN ('admin_clube', 'usuario_secretaria')
        )
      )
  )
$$;

GRANT EXECUTE ON FUNCTION public.perfil_tem_permissao(integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_manage_members_clube(target_clube_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_is_admin_ti()
  OR EXISTS (
    SELECT 1 FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid() AND uc.clube_id = target_clube_id AND uc.ativo = TRUE
      AND uc.perfil IN ('admin_ti', 'admin_total', 'admin_geral')
  )
  OR public.perfil_tem_permissao(target_clube_id, 'gerenciar_membros')
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_manage_docs_clube(target_clube_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_manage_members_clube(target_clube_id)
  OR public.perfil_tem_permissao(target_clube_id, 'gerenciar_documentos')
$$;
