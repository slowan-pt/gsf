-- Bootstrap multiclube: clube de Aventureiros Ceuvamar para validar separação por clube.
-- Idempotente: pode ser executado mais de uma vez sem duplicar dados.

DO $$
DECLARE
  v_programa_id INTEGER;
  v_clube_id INTEGER;
  v_sloan_id UUID;
BEGIN
  SELECT id INTO v_programa_id
  FROM public.programas
  WHERE codigo = 'aventureiros';

  IF v_programa_id IS NULL THEN
    RAISE EXCEPTION 'Programa aventureiros não encontrado.';
  END IF;

  PERFORM setval(
    pg_get_serial_sequence('public.clubes', 'id'),
    GREATEST((SELECT COALESCE(MAX(id), 0) FROM public.clubes), 1),
    TRUE
  );

  PERFORM setval(
    pg_get_serial_sequence('public.unidades', 'id'),
    GREATEST((SELECT COALESCE(MAX(id), 0) FROM public.unidades), 1),
    TRUE
  );

  PERFORM setval(
    pg_get_serial_sequence('public.config_pontuacao_itens', 'id'),
    GREATEST((SELECT COALESCE(MAX(id), 0) FROM public.config_pontuacao_itens), 1),
    TRUE
  );

  INSERT INTO public.clubes (
    programa_id, nome, nome_curto, codigo, igreja, cidade, uf,
    cor_primaria, cor_secundaria, ativo
  )
  VALUES (
    v_programa_id,
    'Clube de Aventureiros Ceuvamar',
    'Ceuvamar',
    'ceuvamar-avt',
    'Igreja do Fonseca',
    'Niterói',
    'RJ',
    '#00695c',
    '#ffb300',
    TRUE
  )
  ON CONFLICT (codigo) DO UPDATE
  SET programa_id = EXCLUDED.programa_id,
      nome = EXCLUDED.nome,
      nome_curto = EXCLUDED.nome_curto,
      igreja = EXCLUDED.igreja,
      cidade = EXCLUDED.cidade,
      uf = EXCLUDED.uf,
      cor_primaria = EXCLUDED.cor_primaria,
      cor_secundaria = EXCLUDED.cor_secundaria,
      ativo = TRUE,
      updated_at = NOW()
  RETURNING id INTO v_clube_id;

  -- Unidades iniciais de teste por faixa/classe de Aventureiros.
  INSERT INTO public.unidades (clube_id, nome, codigo_clube, senha_unidade, cor)
  SELECT v_clube_id, x.nome, NULL, NULL, x.cor
  FROM (
    VALUES
      ('Abelhinhas', '#f6c343'),
      ('Luminares', '#29b6f6'),
      ('Edificadores', '#66bb6a'),
      ('Mãos Ajudadoras', '#ef5350')
  ) AS x(nome, cor)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.unidades u
    WHERE u.clube_id = v_clube_id AND u.nome = x.nome
  );

  -- Documentos padrão para Aventureiros neste clube, partindo do modelo global.
  INSERT INTO public.documentos_modelo (
    programa_id, clube_id, campo, nome, obrigatorio, permite_anexo, limite_anexos, ordem, ativo
  )
  SELECT programa_id, v_clube_id, campo, nome, obrigatorio, permite_anexo, limite_anexos, ordem, TRUE
  FROM public.documentos_modelo dm
  WHERE dm.programa_id = v_programa_id
    AND dm.clube_id IS NULL
  ON CONFLICT (programa_id, clube_id, campo) DO UPDATE
  SET nome = EXCLUDED.nome,
      obrigatorio = EXCLUDED.obrigatorio,
      permite_anexo = EXCLUDED.permite_anexo,
      limite_anexos = EXCLUDED.limite_anexos,
      ordem = EXCLUDED.ordem,
      ativo = TRUE;

  -- Se não houver modelo global de documentos de Aventureiros, usa o padrão DBV conservador.
  IF NOT EXISTS (
    SELECT 1 FROM public.documentos_modelo
    WHERE programa_id = v_programa_id AND clube_id = v_clube_id
  ) THEN
    INSERT INTO public.documentos_modelo (programa_id, clube_id, campo, nome, obrigatorio, permite_anexo, limite_anexos, ordem, ativo)
    VALUES
      (v_programa_id, v_clube_id, 'certidao_nascimento', 'Certidão de Nascimento', TRUE, TRUE, 1, 1, TRUE),
      (v_programa_id, v_clube_id, 'cartao_sus', 'Cartão SUS', TRUE, TRUE, 1, 2, TRUE),
      (v_programa_id, v_clube_id, 'ficha_saude', 'Ficha de Saúde', TRUE, TRUE, 1, 3, TRUE),
      (v_programa_id, v_clube_id, 'carteira_vacinacao', 'Carteira de Vacinação', TRUE, TRUE, 1, 4, TRUE),
      (v_programa_id, v_clube_id, 'autorizacao_responsavel', 'Autorização do Responsável', TRUE, TRUE, 1, 5, TRUE),
      (v_programa_id, v_clube_id, 'comp_residencia', 'Comp. Residência', TRUE, TRUE, 1, 6, TRUE),
      (v_programa_id, v_clube_id, 'foto', 'Foto 3x4', TRUE, TRUE, 1, 7, TRUE)
    ON CONFLICT (programa_id, clube_id, campo) DO NOTHING;
  END IF;

  -- Pontuações padrão do clube.
  INSERT INTO public.config_pontuacao_itens (clube_id, nome, valor, ativo)
  SELECT v_clube_id, x.nome, x.valor, TRUE
  FROM (
    VALUES
      ('Presença', 25),
      ('Pontualidade', 100),
      ('Material', 25),
      ('Uniforme', 25)
  ) AS x(nome, valor)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.config_pontuacao_itens p
    WHERE p.clube_id = v_clube_id AND lower(p.nome) = lower(x.nome)
  );

  INSERT INTO public.pontuacao_itens (clube_id, programa_id, titulo, sigla, valor, ativo, ordem, padrao)
  VALUES
    (v_clube_id, v_programa_id, 'Presença', 'PR', 25, TRUE, 1, TRUE),
    (v_clube_id, v_programa_id, 'Pontualidade', 'PO', 100, TRUE, 2, TRUE),
    (v_clube_id, v_programa_id, 'Material', 'MA', 25, TRUE, 3, TRUE),
    (v_clube_id, v_programa_id, 'Uniforme', 'UN', 25, TRUE, 4, TRUE)
  ON CONFLICT (clube_id, sigla) DO UPDATE
  SET titulo = EXCLUDED.titulo,
      valor = EXCLUDED.valor,
      ativo = TRUE,
      ordem = EXCLUDED.ordem,
      padrao = TRUE,
      updated_at = NOW();

  -- Link de pré-cadastro do clube.
  INSERT INTO public.pre_cadastro_links (clube_id, token, titulo, ativo)
  VALUES (v_clube_id, 'clube-' || v_clube_id::TEXT, 'Pré-cadastro Ceuvamar', TRUE)
  ON CONFLICT (token) DO UPDATE
  SET clube_id = EXCLUDED.clube_id,
      titulo = EXCLUDED.titulo,
      ativo = TRUE,
      updated_at = NOW();

  -- Marca onboarding como preparado.
  INSERT INTO public.clubes_onboarding_status (
    clube_id, modelos_clonados, unidades_criadas, admin_convidado,
    primeiro_import_realizado, finalizado, observacoes, updated_at
  )
  VALUES (
    v_clube_id, TRUE, TRUE, TRUE, FALSE, FALSE,
    'Bootstrap inicial do Clube de Aventureiros Ceuvamar.',
    NOW()
  )
  ON CONFLICT (clube_id) DO UPDATE
  SET modelos_clonados = TRUE,
      unidades_criadas = TRUE,
      admin_convidado = TRUE,
      observacoes = EXCLUDED.observacoes,
      updated_at = NOW();

  -- Sloan como admin_ti inicial da plataforma.
  SELECT id INTO v_sloan_id
  FROM public.usuarios
  WHERE lower(email) = 'sloan.nascimento@gmail.com'
  LIMIT 1;

  IF v_sloan_id IS NOT NULL THEN
    UPDATE public.usuarios
    SET perfil = 'admin_ti'
    WHERE id = v_sloan_id;

    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('perfil', 'admin_ti')
    WHERE id = v_sloan_id;

    INSERT INTO public.usuario_clubes (usuario_id, clube_id, perfil, ativo)
    VALUES
      (v_sloan_id, 1, 'admin_ti', TRUE),
      (v_sloan_id, v_clube_id, 'admin_ti', TRUE)
    ON CONFLICT (usuario_id, clube_id, perfil, COALESCE(membro_id, 0), COALESCE(unidade_id, 0))
    DO UPDATE SET ativo = TRUE, updated_at = NOW();
  END IF;
END $$;
