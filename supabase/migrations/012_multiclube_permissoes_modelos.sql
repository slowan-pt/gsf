-- Hardening multi-clube e suporte aos perfis novos na administracao.

INSERT INTO public.perfis_acesso (codigo, nome, descricao, escopo, ordem, permissoes)
VALUES
  ('usuario_pais', 'Pais/Responsável', 'Acesso aos filhos vinculados.', 'responsavel', 90, '{"filhos": true}'::jsonb)
ON CONFLICT (codigo) DO UPDATE
SET nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao,
    escopo = EXCLUDED.escopo,
    ordem = EXCLUDED.ordem,
    ativo = TRUE,
    permissoes = EXCLUDED.permissoes;

ALTER TABLE IF EXISTS public.usuarios
  DROP CONSTRAINT IF EXISTS usuarios_perfil_check;

ALTER TABLE IF EXISTS public.usuarios
  ADD CONSTRAINT usuarios_perfil_check
  CHECK (
    perfil IN (
      'admin_total', 'admin_geral', 'admin_diretoria', 'desbravador',
      'admin_ti', 'admin_clube', 'usuario_secretaria', 'usuario_tesouraria',
      'usuario_conselheiro', 'usuario_diretoria', 'usuario_desbravador',
      'usuario_aventureiro', 'usuario_regional', 'usuario_distrital',
      'usuario_pastor', 'usuario_capelao', 'usuario_pais'
    )
  );

CREATE OR REPLACE FUNCTION public.current_user_can_admin_clube(target_clube_id INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_is_admin_ti()
  OR EXISTS (
    SELECT 1
    FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid()
      AND uc.clube_id = target_clube_id
      AND uc.ativo = TRUE
      AND uc.perfil IN ('admin_clube')
  )
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_manage_pontuacao(target_clube_id INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_is_admin_ti()
  OR EXISTS (
    SELECT 1
    FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid()
      AND uc.clube_id = target_clube_id
      AND uc.ativo = TRUE
      AND uc.perfil IN ('admin_clube', 'usuario_diretoria')
  )
$$;

DROP POLICY IF EXISTS "usuario_clubes_select_self_or_admin" ON public.usuario_clubes;
DROP POLICY IF EXISTS "usuario_clubes_admin_all" ON public.usuario_clubes;

CREATE POLICY "usuario_clubes_select_self_or_admin"
ON public.usuario_clubes
FOR SELECT
TO authenticated
USING (usuario_id = auth.uid() OR public.current_user_can_admin_clube(clube_id));

CREATE POLICY "usuario_clubes_admin_all"
ON public.usuario_clubes
FOR ALL
TO authenticated
USING (public.current_user_can_admin_clube(clube_id))
WITH CHECK (public.current_user_can_admin_clube(clube_id));

DROP POLICY IF EXISTS "responsavel_membros_select_self_or_admin" ON public.responsavel_membros;
DROP POLICY IF EXISTS "responsavel_membros_admin_all" ON public.responsavel_membros;

CREATE POLICY "responsavel_membros_select_self_or_admin"
ON public.responsavel_membros
FOR SELECT
TO authenticated
USING (usuario_id = auth.uid() OR public.current_user_can_admin_clube(clube_id));

CREATE POLICY "responsavel_membros_admin_all"
ON public.responsavel_membros
FOR ALL
TO authenticated
USING (public.current_user_can_admin_clube(clube_id))
WITH CHECK (public.current_user_can_admin_clube(clube_id));

DROP POLICY IF EXISTS "documentos_modelo_admin_all" ON public.documentos_modelo;
CREATE POLICY "documentos_modelo_admin_all"
ON public.documentos_modelo
FOR ALL
TO authenticated
USING (
  public.current_user_is_admin_ti()
  OR (clube_id IS NOT NULL AND public.current_user_can_admin_clube(clube_id))
)
WITH CHECK (
  public.current_user_is_admin_ti()
  OR (clube_id IS NOT NULL AND public.current_user_can_admin_clube(clube_id))
);

DROP POLICY IF EXISTS "pontuacao_itens_admin_all" ON public.pontuacao_itens;
CREATE POLICY "pontuacao_itens_admin_all"
ON public.pontuacao_itens
FOR ALL
TO authenticated
USING (public.current_user_can_manage_pontuacao(clube_id))
WITH CHECK (public.current_user_can_manage_pontuacao(clube_id));

-- RPC de administracao aceitando perfis novos.
CREATE OR REPLACE FUNCTION public.gerenciar_acesso_usuario(
  target_user_id uuid,
  novo_perfil text,
  novo_dbv_id integer DEFAULT NULL,
  remover_acesso boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  pode_admin boolean;
  dados_usuario record;
  auth_email text;
  novo_unidade_id integer;
  novo_nome text;
BEGIN
  SELECT public.current_user_is_admin_ti()
    OR EXISTS (
      SELECT 1 FROM public.usuario_clubes uc
      WHERE uc.usuario_id = auth.uid()
        AND uc.ativo = TRUE
        AND uc.perfil = 'admin_clube'
    )
  INTO pode_admin;

  IF NOT COALESCE(pode_admin, false) THEN
    RAISE EXCEPTION 'Apenas admin_ti/admin_clube pode gerenciar acessos.';
  END IF;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário inválido.';
  END IF;

  IF remover_acesso THEN
    DELETE FROM public.usuarios WHERE id = target_user_id;
    UPDATE auth.users
       SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
          - 'perfil'
          - 'dbv_id'
          - 'unidade_id'
     WHERE id = target_user_id;
    DELETE FROM auth.mfa_factors WHERE user_id = target_user_id;
    RETURN;
  END IF;

  IF novo_perfil NOT IN (
    'admin_total', 'admin_geral', 'admin_diretoria', 'desbravador',
    'admin_ti', 'admin_clube', 'usuario_secretaria', 'usuario_tesouraria',
    'usuario_conselheiro', 'usuario_diretoria', 'usuario_desbravador',
    'usuario_aventureiro', 'usuario_regional', 'usuario_distrital',
    'usuario_pastor', 'usuario_capelao', 'usuario_pais'
  ) THEN
    RAISE EXCEPTION 'Perfil inválido.';
  END IF;

  SELECT * INTO dados_usuario
  FROM public.usuarios
  WHERE id = target_user_id
  LIMIT 1;

  SELECT email INTO auth_email
  FROM auth.users
  WHERE id = target_user_id
  LIMIT 1;

  SELECT unidade_id, nome
    INTO novo_unidade_id, novo_nome
    FROM public.desbravadores
   WHERE id = novo_dbv_id
   LIMIT 1;

  INSERT INTO public.usuarios (id, email, nome, perfil, dbv_id, unidade_id)
  VALUES (
    target_user_id,
    COALESCE(dados_usuario.email, auth_email),
    COALESCE(novo_nome, dados_usuario.nome, auth_email),
    novo_perfil,
    novo_dbv_id,
    novo_unidade_id
  )
  ON CONFLICT (id) DO UPDATE
  SET perfil = EXCLUDED.perfil,
      dbv_id = EXCLUDED.dbv_id,
      unidade_id = EXCLUDED.unidade_id,
      nome = COALESCE(EXCLUDED.nome, public.usuarios.nome),
      email = COALESCE(public.usuarios.email, EXCLUDED.email);

  UPDATE auth.users
     SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object(
          'perfil', novo_perfil,
          'dbv_id', novo_dbv_id,
          'unidade_id', novo_unidade_id
        )
   WHERE id = target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gerenciar_acesso_usuario(uuid, text, integer, boolean) TO authenticated;

-- Defaults por programa para novos clubes consumirem como fallback.
INSERT INTO public.documentos_modelo (programa_id, clube_id, campo, nome, obrigatorio, permite_anexo, limite_anexos, ordem, ativo)
VALUES
  (2, NULL, 'certidao_nascimento', 'Certidão de Nascimento', TRUE, TRUE, 5, 1, TRUE),
  (2, NULL, 'cartao_sus', 'Cartão SUS', TRUE, TRUE, 5, 2, TRUE),
  (2, NULL, 'ficha_saude', 'Ficha de Saúde', TRUE, TRUE, 5, 3, TRUE),
  (2, NULL, 'carteira_vacinacao', 'Carteira de Vacinação', TRUE, TRUE, 5, 4, TRUE),
  (2, NULL, 'autorizacao_responsavel', 'Autorização do Responsável', TRUE, TRUE, 5, 5, TRUE),
  (2, NULL, 'comp_residencia', 'Comp. Residência', TRUE, TRUE, 5, 6, TRUE),
  (2, NULL, 'foto', 'Foto', TRUE, TRUE, 1, 7, TRUE)
ON CONFLICT (programa_id, clube_id, campo) DO UPDATE
SET nome = EXCLUDED.nome,
    obrigatorio = EXCLUDED.obrigatorio,
    permite_anexo = EXCLUDED.permite_anexo,
    limite_anexos = EXCLUDED.limite_anexos,
    ordem = EXCLUDED.ordem,
    ativo = TRUE;
