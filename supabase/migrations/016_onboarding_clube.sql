-- Onboarding automatizado de clube.
-- Prepara um clube recém-criado com modelos mínimos para começar a operar.

CREATE OR REPLACE FUNCTION public.onboard_clube(target_clube_id INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_programa_id INTEGER;
  v_programa_codigo TEXT;
  v_clube_nome TEXT;
  v_docs_count INTEGER := 0;
  v_pontos_count INTEGER := 0;
  v_token TEXT;
BEGIN
  SELECT c.programa_id, p.codigo, c.nome
    INTO v_programa_id, v_programa_codigo, v_clube_nome
  FROM public.clubes c
  JOIN public.programas p ON p.id = c.programa_id
  WHERE c.id = target_clube_id;

  IF v_programa_id IS NULL THEN
    RAISE EXCEPTION 'Clube % não encontrado.', target_clube_id;
  END IF;

  IF NOT (
    public.current_user_is_admin_ti()
    OR public.current_user_can_admin_clube(target_clube_id)
  ) THEN
    RAISE EXCEPTION 'Apenas admin_ti ou admin_clube pode executar onboarding de clube.';
  END IF;

  -- Classes oficiais por programa.
  IF v_programa_codigo = 'desbravadores' THEN
    INSERT INTO public.classes_modelo (programa_id, nome, tipo, idade_indicada, ordem, ativo)
    VALUES
      (v_programa_id, 'Amigo', 'regular', NULL, 1, TRUE),
      (v_programa_id, 'Amigo da Natureza', 'avançada', NULL, 2, TRUE),
      (v_programa_id, 'Companheiro', 'regular', NULL, 3, TRUE),
      (v_programa_id, 'Companheiro de Excursionismo', 'avançada', NULL, 4, TRUE),
      (v_programa_id, 'Pesquisador', 'regular', NULL, 5, TRUE),
      (v_programa_id, 'Pesquisador de Campo e Bosque', 'avançada', NULL, 6, TRUE),
      (v_programa_id, 'Pioneiro', 'regular', NULL, 7, TRUE),
      (v_programa_id, 'Pioneiro de Novas Fronteiras', 'avançada', NULL, 8, TRUE),
      (v_programa_id, 'Excursionista', 'regular', NULL, 9, TRUE),
      (v_programa_id, 'Excursionista na Mata', 'avançada', NULL, 10, TRUE),
      (v_programa_id, 'Guia', 'regular', NULL, 11, TRUE),
      (v_programa_id, 'Guia de Exploração', 'avançada', NULL, 12, TRUE)
    ON CONFLICT (programa_id, nome) DO UPDATE
    SET tipo = EXCLUDED.tipo,
        idade_indicada = EXCLUDED.idade_indicada,
        ordem = EXCLUDED.ordem,
        ativo = TRUE;
  ELSE
    INSERT INTO public.classes_modelo (programa_id, nome, tipo, idade_indicada, ordem, ativo)
    VALUES
      (v_programa_id, 'Abelhinhas Laboriosas', 'regular', 6, 1, TRUE),
      (v_programa_id, 'Luminares', 'regular', 7, 2, TRUE),
      (v_programa_id, 'Edificadores', 'regular', 8, 3, TRUE),
      (v_programa_id, 'Mãos Ajudadoras', 'regular', 9, 4, TRUE)
    ON CONFLICT (programa_id, nome) DO UPDATE
    SET tipo = EXCLUDED.tipo,
        idade_indicada = EXCLUDED.idade_indicada,
        ordem = EXCLUDED.ordem,
        ativo = TRUE;
  END IF;

  -- Cargos oficiais por programa.
  INSERT INTO public.cargos_modelo (
    programa_id, codigo, nome_masculino, nome_feminino, tipo,
    idade_minima, idade_maxima, perfil_sugerido, ativo
  )
  VALUES
    (v_programa_id, CASE WHEN v_programa_codigo = 'aventureiros' THEN 'aventureiro' ELSE 'desbravador' END,
      CASE WHEN v_programa_codigo = 'aventureiros' THEN 'Aventureiro' ELSE 'Desbravador' END,
      CASE WHEN v_programa_codigo = 'aventureiros' THEN 'Aventureira' ELSE 'Desbravadora' END,
      'membro',
      CASE WHEN v_programa_codigo = 'aventureiros' THEN 6 ELSE 10 END,
      CASE WHEN v_programa_codigo = 'aventureiros' THEN 9 ELSE 15 END,
      CASE WHEN v_programa_codigo = 'aventureiros' THEN 'usuario_aventureiro' ELSE 'usuario_desbravador' END,
      TRUE),
    (v_programa_id, 'diretor', 'Diretor', 'Diretora', 'diretoria', 16, NULL, 'usuario_diretoria', TRUE),
    (v_programa_id, 'diretor_associado', 'Diretor associado', 'Diretora associada', 'diretoria', 16, NULL, 'usuario_diretoria', TRUE),
    (v_programa_id, 'secretario', 'Secretário', 'Secretária', 'diretoria', 16, NULL, 'usuario_secretaria', TRUE),
    (v_programa_id, 'tesoureiro', 'Tesoureiro', 'Tesoureira', 'diretoria', 16, NULL, 'usuario_tesouraria', TRUE),
    (v_programa_id, 'capelao', 'Capelão', 'Capelã', 'diretoria', 16, NULL, 'usuario_capelao', TRUE),
    (v_programa_id, 'instrutor_classes', 'Instrutor de classes', 'Instrutora de classes', 'diretoria', 16, NULL, 'usuario_diretoria', TRUE),
    (v_programa_id, 'instrutor_especialidades', 'Instrutor de especialidades', 'Instrutora de especialidades', 'diretoria', 16, NULL, 'usuario_diretoria', TRUE),
    (v_programa_id, 'conselheiro', 'Conselheiro', 'Conselheira', 'unidade', 16, NULL, 'usuario_conselheiro', TRUE),
    (v_programa_id, 'comunicacao', 'Comunicação', 'Comunicação', 'diretoria', 16, NULL, 'usuario_diretoria', TRUE)
  ON CONFLICT (programa_id, codigo) DO UPDATE
  SET nome_masculino = EXCLUDED.nome_masculino,
      nome_feminino = EXCLUDED.nome_feminino,
      tipo = EXCLUDED.tipo,
      idade_minima = EXCLUDED.idade_minima,
      idade_maxima = EXCLUDED.idade_maxima,
      perfil_sugerido = EXCLUDED.perfil_sugerido,
      ativo = TRUE;

  IF v_programa_codigo = 'desbravadores' THEN
    INSERT INTO public.cargos_modelo (
      programa_id, codigo, nome_masculino, nome_feminino, tipo,
      idade_minima, idade_maxima, perfil_sugerido, ativo
    )
    VALUES
      (v_programa_id, 'capitao_unidade', 'Capitão de unidade', 'Capitã de unidade', 'unidade', 10, 15, 'usuario_desbravador', TRUE),
      (v_programa_id, 'secretario_unidade', 'Secretário de unidade', 'Secretária de unidade', 'unidade', 10, 15, 'usuario_desbravador', TRUE)
    ON CONFLICT (programa_id, codigo) DO UPDATE
    SET nome_masculino = EXCLUDED.nome_masculino,
        nome_feminino = EXCLUDED.nome_feminino,
        tipo = EXCLUDED.tipo,
        idade_minima = EXCLUDED.idade_minima,
        idade_maxima = EXCLUDED.idade_maxima,
        perfil_sugerido = EXCLUDED.perfil_sugerido,
        ativo = TRUE;
  END IF;

  -- Documentos padrão. Por enquanto usamos o padrão DBV também para Aventureiros,
  -- deixando o clube ajustar depois no menu Modelos.
  INSERT INTO public.documentos_modelo (programa_id, clube_id, campo, nome, obrigatorio, permite_anexo, limite_anexos, ordem, ativo)
  VALUES
    (v_programa_id, target_clube_id, 'rg', 'RG', TRUE, TRUE, 1, 1, TRUE),
    (v_programa_id, target_clube_id, 'cpf', 'CPF', TRUE, TRUE, 1, 2, TRUE),
    (v_programa_id, target_clube_id, 'rg_resp', 'RG Responsável', TRUE, TRUE, 1, 3, TRUE),
    (v_programa_id, target_clube_id, 'cartao_sus', 'Cartão SUS', TRUE, TRUE, 1, 4, TRUE),
    (v_programa_id, target_clube_id, 'cartao_plano', 'Cartão de Plano', FALSE, TRUE, 1, 5, TRUE),
    (v_programa_id, target_clube_id, 'ficha_saude', 'Ficha de Saúde', TRUE, TRUE, 1, 6, TRUE),
    (v_programa_id, target_clube_id, 'carteira_vacinacao', 'Carteira de Vacinação', TRUE, TRUE, 1, 7, TRUE),
    (v_programa_id, target_clube_id, 'laudo_medico', 'Laudo Médico', FALSE, TRUE, 1, 8, TRUE),
    (v_programa_id, target_clube_id, 'ficha_reg', 'Ficha de Reg. Atualizada', TRUE, TRUE, 1, 9, TRUE),
    (v_programa_id, target_clube_id, 'comp_residencia', 'Comp. Residência', TRUE, TRUE, 1, 10, TRUE),
    (v_programa_id, target_clube_id, 'aut_saida', 'Aut. Saída', TRUE, TRUE, 1, 11, TRUE),
    (v_programa_id, target_clube_id, 'aut_viagem', 'Aut. Viagem Autenticada', TRUE, TRUE, 1, 12, TRUE),
    (v_programa_id, target_clube_id, 'ri_assinado', 'RI Assinado', TRUE, TRUE, 1, 13, TRUE),
    (v_programa_id, target_clube_id, 'foto', 'Foto 3x4', TRUE, TRUE, 1, 14, TRUE),
    (v_programa_id, target_clube_id, 'ant_criminais', 'Ant. Criminais', FALSE, TRUE, 1, 15, TRUE)
  ON CONFLICT (programa_id, clube_id, campo) DO UPDATE
  SET nome = EXCLUDED.nome,
      obrigatorio = EXCLUDED.obrigatorio,
      permite_anexo = EXCLUDED.permite_anexo,
      limite_anexos = EXCLUDED.limite_anexos,
      ordem = EXCLUDED.ordem,
      ativo = TRUE;

  GET DIAGNOSTICS v_docs_count = ROW_COUNT;

  -- Pontuações iniciais.
  INSERT INTO public.pontuacao_itens (clube_id, programa_id, titulo, sigla, valor, ativo, ordem, padrao)
  VALUES
    (target_clube_id, v_programa_id, 'Presença', 'PR', 25, TRUE, 1, TRUE),
    (target_clube_id, v_programa_id, 'Pontualidade', 'PO', 100, TRUE, 2, TRUE),
    (target_clube_id, v_programa_id, 'Material', 'MA', 25, TRUE, 3, TRUE),
    (target_clube_id, v_programa_id, 'Uniforme', 'UN', 25, TRUE, 4, TRUE)
  ON CONFLICT (clube_id, sigla) DO UPDATE
  SET titulo = EXCLUDED.titulo,
      valor = EXCLUDED.valor,
      ativo = TRUE,
      ordem = EXCLUDED.ordem,
      padrao = TRUE,
      updated_at = NOW();

  GET DIAGNOSTICS v_pontos_count = ROW_COUNT;

  -- Link de pré-cadastro único do clube.
  v_token := 'clube-' || target_clube_id::TEXT;
  INSERT INTO public.pre_cadastro_links (clube_id, token, titulo, ativo, criado_por)
  VALUES (target_clube_id, v_token, 'Pré-cadastro ' || COALESCE(v_clube_nome, 'Clube'), TRUE, auth.uid())
  ON CONFLICT (token) DO UPDATE
  SET titulo = EXCLUDED.titulo,
      ativo = TRUE,
      updated_at = NOW();

  INSERT INTO public.clubes_onboarding_status (
    clube_id, modelos_clonados, unidades_criadas, admin_convidado, primeiro_import_realizado, finalizado, observacoes, updated_at
  )
  VALUES (
    target_clube_id,
    TRUE,
    EXISTS (SELECT 1 FROM public.unidades WHERE clube_id = target_clube_id),
    EXISTS (
      SELECT 1
      FROM public.usuario_clubes
      WHERE clube_id = target_clube_id
        AND ativo = TRUE
        AND perfil IN ('admin_clube', 'admin_ti')
    ),
    FALSE,
    FALSE,
    'Modelos iniciais e link de pré-cadastro preparados automaticamente.',
    NOW()
  )
  ON CONFLICT (clube_id) DO UPDATE
  SET modelos_clonados = TRUE,
      unidades_criadas = EXISTS (SELECT 1 FROM public.unidades WHERE clube_id = target_clube_id),
      admin_convidado = EXISTS (
        SELECT 1
        FROM public.usuario_clubes
        WHERE clube_id = target_clube_id
          AND ativo = TRUE
          AND perfil IN ('admin_clube', 'admin_ti')
      ),
      observacoes = EXCLUDED.observacoes,
      updated_at = NOW();

  RETURN jsonb_build_object(
    'ok', TRUE,
    'clube_id', target_clube_id,
    'programa_id', v_programa_id,
    'pre_cadastro_token', v_token,
    'documentos_preparados', v_docs_count,
    'pontuacoes_preparadas', v_pontos_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.onboard_clube(INTEGER) TO authenticated;
