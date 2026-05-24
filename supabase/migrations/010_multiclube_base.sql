-- Base multi-clube - Fase 1
-- Conservadora: adiciona estrutura nova sem remover/renomear tabelas atuais.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Programas suportados inicialmente.
CREATE TABLE IF NOT EXISTS public.programas (
  id SERIAL PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  idade_minima_membro INTEGER NOT NULL,
  idade_maxima_membro INTEGER NOT NULL,
  idade_minima_diretoria INTEGER NOT NULL DEFAULT 16,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.programas (id, codigo, nome, idade_minima_membro, idade_maxima_membro, idade_minima_diretoria, ativo)
VALUES
  (1, 'desbravadores', 'Desbravadores', 10, 15, 16, TRUE),
  (2, 'aventureiros', 'Aventureiros', 6, 9, 16, TRUE)
ON CONFLICT (codigo) DO UPDATE
SET nome = EXCLUDED.nome,
    idade_minima_membro = EXCLUDED.idade_minima_membro,
    idade_maxima_membro = EXCLUDED.idade_maxima_membro,
    idade_minima_diretoria = EXCLUDED.idade_minima_diretoria,
    ativo = TRUE,
    updated_at = NOW();

SELECT setval(pg_get_serial_sequence('public.programas', 'id'), GREATEST((SELECT MAX(id) FROM public.programas), 1), TRUE);

-- Clubes da plataforma.
CREATE TABLE IF NOT EXISTS public.clubes (
  id SERIAL PRIMARY KEY,
  programa_id INTEGER NOT NULL REFERENCES public.programas(id),
  nome TEXT NOT NULL,
  nome_curto TEXT,
  codigo TEXT UNIQUE,
  igreja TEXT,
  distrito TEXT,
  regional TEXT,
  cidade TEXT,
  uf TEXT,
  logo_url TEXT,
  cor_primaria TEXT DEFAULT '#1a3a5c',
  cor_secundaria TEXT DEFAULT '#f5a623',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.clubes (
  id, programa_id, nome, nome_curto, codigo, igreja, cidade, uf,
  cor_primaria, cor_secundaria, ativo
)
VALUES (
  1, 1, 'Clube de Desbravadores Fonseca', 'Fonseca', 'fonseca-dbv',
  'Igreja do Fonseca', NULL, 'RJ', '#1a3a5c', '#f5a623', TRUE
)
ON CONFLICT (id) DO UPDATE
SET programa_id = EXCLUDED.programa_id,
    nome = EXCLUDED.nome,
    nome_curto = EXCLUDED.nome_curto,
    codigo = EXCLUDED.codigo,
    igreja = EXCLUDED.igreja,
    cor_primaria = EXCLUDED.cor_primaria,
    cor_secundaria = EXCLUDED.cor_secundaria,
    ativo = TRUE,
    updated_at = NOW();

SELECT setval(pg_get_serial_sequence('public.clubes', 'id'), GREATEST((SELECT MAX(id) FROM public.clubes), 1), TRUE);

-- Perfis conhecidos da plataforma.
CREATE TABLE IF NOT EXISTS public.perfis_acesso (
  codigo TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  escopo TEXT NOT NULL CHECK (escopo IN ('plataforma', 'clube', 'unidade', 'proprio', 'responsavel')),
  ordem INTEGER DEFAULT 100,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  permissoes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.perfis_acesso (codigo, nome, descricao, escopo, ordem, permissoes)
VALUES
  ('admin_ti', 'Admin TI', 'Controle total da plataforma e de todos os clubes.', 'plataforma', 1, '{"tudo": true}'::jsonb),
  ('admin_clube', 'Admin do Clube', 'Controle administrativo completo dentro de um clube.', 'clube', 2, '{"clube": "total"}'::jsonb),
  ('usuario_secretaria', 'Secretaria', 'Cadastros, documentos e relatórios do clube.', 'clube', 10, '{"membros": "total", "documentos": "total", "relatorios": "total"}'::jsonb),
  ('usuario_tesouraria', 'Tesouraria', 'Acesso financeiro e relatórios financeiros.', 'clube', 20, '{"financeiro": "total"}'::jsonb),
  ('usuario_conselheiro', 'Conselheiro(a)', 'Acompanhamento de membros da unidade vinculada.', 'unidade', 30, '{"unidade": "acompanhar"}'::jsonb),
  ('usuario_diretoria', 'Diretoria', 'Acesso amplo de diretoria dentro do clube.', 'clube', 40, '{"pontuacao": "total", "atividades": "total", "membros": "editar"}'::jsonb),
  ('usuario_desbravador', 'Desbravador', 'Acesso próprio do membro desbravador.', 'proprio', 50, '{"proprio": true}'::jsonb),
  ('usuario_aventureiro', 'Aventureiro', 'Acesso próprio do membro aventureiro.', 'proprio', 51, '{"proprio": true}'::jsonb),
  ('usuario_regional', 'Regional', 'Acompanhamento de clubes por regional.', 'clube', 60, '{"relatorios": "agregado"}'::jsonb),
  ('usuario_distrital', 'Distrital', 'Acompanhamento de clubes por distrito.', 'clube', 61, '{"relatorios": "agregado"}'::jsonb),
  ('usuario_pastor', 'Pastor', 'Acompanhamento pastoral dos clubes vinculados.', 'clube', 70, '{"acompanhar": true}'::jsonb),
  ('usuario_capelao', 'Capelão', 'Acompanhamento espiritual/devocional permitido pelo clube.', 'clube', 80, '{"capelania": true}'::jsonb)
ON CONFLICT (codigo) DO UPDATE
SET nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao,
    escopo = EXCLUDED.escopo,
    ordem = EXCLUDED.ordem,
    ativo = TRUE,
    permissoes = EXCLUDED.permissoes;

-- Usuário legado: manter coluna perfil, mas liberar novos valores.
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
      'usuario_pastor', 'usuario_capelao'
    )
  );

-- Vínculos operacionais com clubes.
CREATE TABLE IF NOT EXISTS public.usuario_clubes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clube_id INTEGER NOT NULL REFERENCES public.clubes(id) ON DELETE CASCADE,
  membro_id INTEGER REFERENCES public.desbravadores(id) ON DELETE SET NULL,
  perfil TEXT NOT NULL REFERENCES public.perfis_acesso(codigo),
  unidade_id INTEGER REFERENCES public.unidades(id) ON DELETE SET NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS usuario_clubes_unique_idx
  ON public.usuario_clubes (usuario_id, clube_id, perfil, COALESCE(membro_id, 0), COALESCE(unidade_id, 0));

-- Vínculos familiares/responsáveis com membros.
CREATE TABLE IF NOT EXISTS public.responsavel_membros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  membro_id INTEGER NOT NULL REFERENCES public.desbravadores(id) ON DELETE CASCADE,
  clube_id INTEGER NOT NULL REFERENCES public.clubes(id) ON DELETE CASCADE,
  programa_id INTEGER NOT NULL REFERENCES public.programas(id),
  parentesco TEXT,
  responsavel_principal BOOLEAN NOT NULL DEFAULT FALSE,
  pode_visualizar BOOLEAN NOT NULL DEFAULT TRUE,
  pode_visualizar_documentos BOOLEAN NOT NULL DEFAULT FALSE,
  pode_enviar_documentos BOOLEAN NOT NULL DEFAULT TRUE,
  pode_responder_atividades BOOLEAN NOT NULL DEFAULT TRUE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, membro_id)
);

-- Modelos por programa/clube.
CREATE TABLE IF NOT EXISTS public.classes_modelo (
  id SERIAL PRIMARY KEY,
  programa_id INTEGER NOT NULL REFERENCES public.programas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT,
  idade_indicada INTEGER,
  ordem INTEGER NOT NULL DEFAULT 100,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (programa_id, nome)
);

CREATE TABLE IF NOT EXISTS public.cargos_modelo (
  id SERIAL PRIMARY KEY,
  programa_id INTEGER REFERENCES public.programas(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  nome_masculino TEXT NOT NULL,
  nome_feminino TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'diretoria',
  idade_minima INTEGER,
  idade_maxima INTEGER,
  perfil_sugerido TEXT REFERENCES public.perfis_acesso(codigo),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (programa_id, codigo)
);

CREATE TABLE IF NOT EXISTS public.documentos_modelo (
  id SERIAL PRIMARY KEY,
  programa_id INTEGER REFERENCES public.programas(id) ON DELETE CASCADE,
  clube_id INTEGER REFERENCES public.clubes(id) ON DELETE CASCADE,
  campo TEXT NOT NULL,
  nome TEXT NOT NULL,
  obrigatorio BOOLEAN NOT NULL DEFAULT TRUE,
  permite_anexo BOOLEAN NOT NULL DEFAULT TRUE,
  limite_anexos INTEGER NOT NULL DEFAULT 1,
  ordem INTEGER NOT NULL DEFAULT 100,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (programa_id, clube_id, campo)
);

CREATE TABLE IF NOT EXISTS public.especialidades_modelo (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  programa_id INTEGER NOT NULL REFERENCES public.programas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  codigo TEXT,
  categoria TEXT,
  tipo_nivel TEXT,
  ano_criacao INTEGER,
  ano_revisao INTEGER,
  idade_indicada INTEGER,
  pre_requisitos TEXT,
  requisitos TEXT,
  quantidade_requisitos INTEGER,
  insignia_url TEXT,
  mestrado_relacionado TEXT,
  materiais_necessarios TEXT,
  observacoes TEXT,
  fonte_oficial TEXT,
  status TEXT NOT NULL DEFAULT 'Ativa' CHECK (status IN ('Ativa', 'Revisada', 'Substituída', 'Descontinuada')),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (programa_id, nome)
);

CREATE TABLE IF NOT EXISTS public.pontuacao_itens (
  id SERIAL PRIMARY KEY,
  clube_id INTEGER NOT NULL REFERENCES public.clubes(id) ON DELETE CASCADE,
  programa_id INTEGER REFERENCES public.programas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  sigla TEXT NOT NULL,
  valor INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  ordem INTEGER NOT NULL DEFAULT 100,
  padrao BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (clube_id, sigla)
);

-- Classes oficiais iniciais.
INSERT INTO public.classes_modelo (programa_id, nome, tipo, idade_indicada, ordem, ativo)
VALUES
  (1, 'Amigo', 'regular', NULL, 1, TRUE),
  (1, 'Amigo da Natureza', 'avançada', NULL, 2, TRUE),
  (1, 'Companheiro', 'regular', NULL, 3, TRUE),
  (1, 'Companheiro de Excursionismo', 'avançada', NULL, 4, TRUE),
  (1, 'Pesquisador', 'regular', NULL, 5, TRUE),
  (1, 'Pesquisador de Campo e Bosque', 'avançada', NULL, 6, TRUE),
  (1, 'Pioneiro', 'regular', NULL, 7, TRUE),
  (1, 'Pioneiro de Novas Fronteiras', 'avançada', NULL, 8, TRUE),
  (1, 'Excursionista', 'regular', NULL, 9, TRUE),
  (1, 'Excursionista na Mata', 'avançada', NULL, 10, TRUE),
  (1, 'Guia', 'regular', NULL, 11, TRUE),
  (1, 'Guia de Exploração', 'avançada', NULL, 12, TRUE),
  (2, 'Abelhinhas Laboriosas', 'regular', 6, 1, TRUE),
  (2, 'Luminares', 'regular', 7, 2, TRUE),
  (2, 'Edificadores', 'regular', 8, 3, TRUE),
  (2, 'Mãos Ajudadoras', 'regular', 9, 4, TRUE)
ON CONFLICT (programa_id, nome) DO UPDATE
SET tipo = EXCLUDED.tipo,
    idade_indicada = EXCLUDED.idade_indicada,
    ordem = EXCLUDED.ordem,
    ativo = TRUE;

-- Cargos oficiais iniciais.
INSERT INTO public.cargos_modelo (
  programa_id, codigo, nome_masculino, nome_feminino, tipo,
  idade_minima, idade_maxima, perfil_sugerido, ativo
)
VALUES
  (1, 'desbravador', 'Desbravador', 'Desbravadora', 'membro', 10, 15, 'usuario_desbravador', TRUE),
  (2, 'aventureiro', 'Aventureiro', 'Aventureira', 'membro', 6, 9, 'usuario_aventureiro', TRUE),
  (1, 'diretor', 'Diretor', 'Diretora', 'diretoria', 16, NULL, 'usuario_diretoria', TRUE),
  (2, 'diretor', 'Diretor', 'Diretora', 'diretoria', 16, NULL, 'usuario_diretoria', TRUE),
  (1, 'diretor_associado', 'Diretor associado', 'Diretora associada', 'diretoria', 16, NULL, 'usuario_diretoria', TRUE),
  (2, 'diretor_associado', 'Diretor associado', 'Diretora associada', 'diretoria', 16, NULL, 'usuario_diretoria', TRUE),
  (1, 'secretario', 'Secretário', 'Secretária', 'diretoria', 16, NULL, 'usuario_secretaria', TRUE),
  (2, 'secretario', 'Secretário', 'Secretária', 'diretoria', 16, NULL, 'usuario_secretaria', TRUE),
  (1, 'tesoureiro', 'Tesoureiro', 'Tesoureira', 'diretoria', 16, NULL, 'usuario_tesouraria', TRUE),
  (2, 'tesoureiro', 'Tesoureiro', 'Tesoureira', 'diretoria', 16, NULL, 'usuario_tesouraria', TRUE),
  (1, 'capelao', 'Capelão', 'Capelã', 'diretoria', 16, NULL, 'usuario_capelao', TRUE),
  (2, 'capelao', 'Capelão', 'Capelã', 'diretoria', 16, NULL, 'usuario_capelao', TRUE),
  (1, 'instrutor_classes', 'Instrutor de classes', 'Instrutora de classes', 'diretoria', 16, NULL, 'usuario_diretoria', TRUE),
  (2, 'instrutor_classes', 'Instrutor de classes', 'Instrutora de classes', 'diretoria', 16, NULL, 'usuario_diretoria', TRUE),
  (1, 'instrutor_especialidades', 'Instrutor de especialidades', 'Instrutora de especialidades', 'diretoria', 16, NULL, 'usuario_diretoria', TRUE),
  (2, 'instrutor_especialidades', 'Instrutor de especialidades', 'Instrutora de especialidades', 'diretoria', 16, NULL, 'usuario_diretoria', TRUE),
  (1, 'conselheiro', 'Conselheiro', 'Conselheira', 'unidade', 16, NULL, 'usuario_conselheiro', TRUE),
  (2, 'conselheiro', 'Conselheiro', 'Conselheira', 'unidade', 16, NULL, 'usuario_conselheiro', TRUE),
  (1, 'capitao_unidade', 'Capitão de unidade', 'Capitã de unidade', 'unidade', 10, 15, 'usuario_desbravador', TRUE),
  (1, 'secretario_unidade', 'Secretário de unidade', 'Secretária de unidade', 'unidade', 10, 15, 'usuario_desbravador', TRUE),
  (1, 'comunicacao', 'Comunicação', 'Comunicação', 'diretoria', 16, NULL, 'usuario_diretoria', TRUE),
  (2, 'comunicacao', 'Comunicação', 'Comunicação', 'diretoria', 16, NULL, 'usuario_diretoria', TRUE)
ON CONFLICT (programa_id, codigo) DO UPDATE
SET nome_masculino = EXCLUDED.nome_masculino,
    nome_feminino = EXCLUDED.nome_feminino,
    tipo = EXCLUDED.tipo,
    idade_minima = EXCLUDED.idade_minima,
    idade_maxima = EXCLUDED.idade_maxima,
    perfil_sugerido = EXCLUDED.perfil_sugerido,
    ativo = TRUE;

-- Documentos DBV iniciais baseados no Fonseca atual.
INSERT INTO public.documentos_modelo (programa_id, clube_id, campo, nome, obrigatorio, permite_anexo, limite_anexos, ordem, ativo)
VALUES
  (1, 1, 'rg', 'RG', TRUE, TRUE, 1, 1, TRUE),
  (1, 1, 'cpf', 'CPF', TRUE, TRUE, 1, 2, TRUE),
  (1, 1, 'rg_resp', 'RG Responsável', TRUE, TRUE, 1, 3, TRUE),
  (1, 1, 'cartao_sus', 'Cartão SUS', TRUE, TRUE, 1, 4, TRUE),
  (1, 1, 'cartao_plano', 'Cartão de Plano', FALSE, TRUE, 1, 5, TRUE),
  (1, 1, 'ficha_saude', 'Ficha de Saúde', TRUE, TRUE, 1, 6, TRUE),
  (1, 1, 'carteira_vacinacao', 'Carteira de Vacinação', TRUE, TRUE, 1, 7, TRUE),
  (1, 1, 'laudo_medico', 'Laudo Médico', FALSE, TRUE, 1, 8, TRUE),
  (1, 1, 'ficha_reg', 'Ficha de Reg. Atualizada', TRUE, TRUE, 1, 9, TRUE),
  (1, 1, 'comp_residencia', 'Comp. Residência', TRUE, TRUE, 1, 10, TRUE),
  (1, 1, 'aut_saida', 'Aut. Saída', TRUE, TRUE, 1, 11, TRUE),
  (1, 1, 'aut_viagem', 'Aut. Viagem Autenticada', TRUE, TRUE, 1, 12, TRUE),
  (1, 1, 'ri_assinado', 'RI Assinado', TRUE, TRUE, 1, 13, TRUE),
  (1, 1, 'foto', 'Foto', TRUE, TRUE, 1, 14, TRUE),
  (1, 1, 'ant_criminais', 'Ant. Criminais', FALSE, TRUE, 1, 15, TRUE)
ON CONFLICT (programa_id, clube_id, campo) DO UPDATE
SET nome = EXCLUDED.nome,
    obrigatorio = EXCLUDED.obrigatorio,
    permite_anexo = EXCLUDED.permite_anexo,
    limite_anexos = EXCLUDED.limite_anexos,
    ordem = EXCLUDED.ordem,
    ativo = TRUE;

-- Pontuações padrão do Clube Fonseca.
INSERT INTO public.pontuacao_itens (clube_id, programa_id, titulo, sigla, valor, ativo, ordem, padrao)
VALUES
  (1, 1, 'Presença', 'PR', 25, TRUE, 1, TRUE),
  (1, 1, 'Pontualidade', 'PO', 100, TRUE, 2, TRUE),
  (1, 1, 'Material', 'MA', 25, TRUE, 3, TRUE),
  (1, 1, 'Uniforme', 'UN', 25, TRUE, 4, TRUE)
ON CONFLICT (clube_id, sigla) DO UPDATE
SET titulo = EXCLUDED.titulo,
    valor = EXCLUDED.valor,
    ativo = TRUE,
    ordem = EXCLUDED.ordem,
    padrao = TRUE,
    updated_at = NOW();

-- Adiciona clube_id às tabelas atuais sem quebrar compatibilidade.
ALTER TABLE IF EXISTS public.unidades ADD COLUMN IF NOT EXISTS clube_id INTEGER REFERENCES public.clubes(id);
ALTER TABLE IF EXISTS public.desbravadores ADD COLUMN IF NOT EXISTS clube_id INTEGER REFERENCES public.clubes(id);
ALTER TABLE IF EXISTS public.documentos ADD COLUMN IF NOT EXISTS clube_id INTEGER REFERENCES public.clubes(id);
ALTER TABLE IF EXISTS public.documento_tipos ADD COLUMN IF NOT EXISTS clube_id INTEGER REFERENCES public.clubes(id);
ALTER TABLE IF EXISTS public.documento_status ADD COLUMN IF NOT EXISTS clube_id INTEGER REFERENCES public.clubes(id);
ALTER TABLE IF EXISTS public.documento_imagens ADD COLUMN IF NOT EXISTS clube_id INTEGER REFERENCES public.clubes(id);
ALTER TABLE IF EXISTS public.progresso_classes ADD COLUMN IF NOT EXISTS clube_id INTEGER REFERENCES public.clubes(id);
ALTER TABLE IF EXISTS public.especialidades ADD COLUMN IF NOT EXISTS clube_id INTEGER REFERENCES public.clubes(id);
ALTER TABLE IF EXISTS public.eventos ADD COLUMN IF NOT EXISTS clube_id INTEGER REFERENCES public.clubes(id);
ALTER TABLE IF EXISTS public.pontuacoes ADD COLUMN IF NOT EXISTS clube_id INTEGER REFERENCES public.clubes(id);
ALTER TABLE IF EXISTS public.pontuacoes_custom ADD COLUMN IF NOT EXISTS clube_id INTEGER REFERENCES public.clubes(id);
ALTER TABLE IF EXISTS public.config_pontuacao ADD COLUMN IF NOT EXISTS clube_id INTEGER REFERENCES public.clubes(id);
ALTER TABLE IF EXISTS public.config_pontuacao_itens ADD COLUMN IF NOT EXISTS clube_id INTEGER REFERENCES public.clubes(id);
ALTER TABLE IF EXISTS public.mensagens_clube ADD COLUMN IF NOT EXISTS clube_id INTEGER REFERENCES public.clubes(id);
ALTER TABLE IF EXISTS public.atividades ADD COLUMN IF NOT EXISTS clube_id INTEGER REFERENCES public.clubes(id);
ALTER TABLE IF EXISTS public.atividades_anexos ADD COLUMN IF NOT EXISTS clube_id INTEGER REFERENCES public.clubes(id);
ALTER TABLE IF EXISTS public.atividades_respostas ADD COLUMN IF NOT EXISTS clube_id INTEGER REFERENCES public.clubes(id);
ALTER TABLE IF EXISTS public.lgpd_termos ADD COLUMN IF NOT EXISTS clube_id INTEGER REFERENCES public.clubes(id);
ALTER TABLE IF EXISTS public.lgpd_termos ADD COLUMN IF NOT EXISTS programa_id INTEGER REFERENCES public.programas(id);
ALTER TABLE IF EXISTS public.lgpd_aceites ADD COLUMN IF NOT EXISTS clube_id INTEGER REFERENCES public.clubes(id);
ALTER TABLE IF EXISTS public.lgpd_aceites ADD COLUMN IF NOT EXISTS programa_id INTEGER REFERENCES public.programas(id);

UPDATE public.unidades SET clube_id = 1 WHERE clube_id IS NULL;
UPDATE public.desbravadores SET clube_id = 1 WHERE clube_id IS NULL;
UPDATE public.eventos SET clube_id = 1 WHERE clube_id IS NULL;
UPDATE public.config_pontuacao SET clube_id = 1 WHERE clube_id IS NULL;
UPDATE public.config_pontuacao_itens SET clube_id = 1 WHERE clube_id IS NULL;
UPDATE public.mensagens_clube SET clube_id = 1 WHERE clube_id IS NULL;
UPDATE public.atividades SET clube_id = 1 WHERE clube_id IS NULL;
UPDATE public.lgpd_termos SET clube_id = 1, programa_id = 1 WHERE clube_id IS NULL;
UPDATE public.lgpd_aceites SET clube_id = 1, programa_id = 1 WHERE clube_id IS NULL;

UPDATE public.documentos d
SET clube_id = COALESCE(d.clube_id, dbv.clube_id, 1)
FROM public.desbravadores dbv
WHERE d.dbv_id = dbv.id AND d.clube_id IS NULL;

UPDATE public.documento_status ds
SET clube_id = COALESCE(ds.clube_id, dbv.clube_id, 1)
FROM public.desbravadores dbv
WHERE ds.dbv_id = dbv.id AND ds.clube_id IS NULL;

UPDATE public.documento_imagens di
SET clube_id = COALESCE(di.clube_id, dbv.clube_id, 1)
FROM public.desbravadores dbv
WHERE di.dbv_id = dbv.id AND di.clube_id IS NULL;

UPDATE public.progresso_classes pc
SET clube_id = COALESCE(pc.clube_id, dbv.clube_id, 1)
FROM public.desbravadores dbv
WHERE pc.dbv_id = dbv.id AND pc.clube_id IS NULL;

UPDATE public.especialidades e
SET clube_id = COALESCE(e.clube_id, dbv.clube_id, 1)
FROM public.desbravadores dbv
WHERE e.dbv_id = dbv.id AND e.clube_id IS NULL;

UPDATE public.pontuacoes p
SET clube_id = COALESCE(p.clube_id, dbv.clube_id, 1)
FROM public.desbravadores dbv
WHERE p.dbv_id = dbv.id AND p.clube_id IS NULL;

UPDATE public.pontuacoes_custom pc
SET clube_id = COALESCE(pc.clube_id, dbv.clube_id, 1)
FROM public.desbravadores dbv
WHERE pc.dbv_id = dbv.id AND pc.clube_id IS NULL;

UPDATE public.atividades_anexos aa
SET clube_id = COALESCE(aa.clube_id, a.clube_id, 1)
FROM public.atividades a
WHERE aa.atividade_id = a.id AND aa.clube_id IS NULL;

UPDATE public.atividades_respostas ar
SET clube_id = COALESCE(ar.clube_id, a.clube_id, 1)
FROM public.atividades a
WHERE ar.atividade_id = a.id AND ar.clube_id IS NULL;

-- Vínculo inicial admin_ti para a plataforma/clube atual, sem alterar o perfil legado do app.
INSERT INTO public.usuario_clubes (usuario_id, clube_id, membro_id, perfil, unidade_id, ativo)
SELECT u.id, 1, u.dbv_id, 'admin_ti', u.unidade_id, TRUE
FROM public.usuarios u
WHERE lower(u.email) = lower('sloan.nascimento@gmail.com')
ON CONFLICT DO NOTHING;

-- Índices úteis.
CREATE INDEX IF NOT EXISTS idx_usuario_clubes_usuario ON public.usuario_clubes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuario_clubes_clube ON public.usuario_clubes(clube_id);
CREATE INDEX IF NOT EXISTS idx_responsavel_membros_usuario ON public.responsavel_membros(usuario_id);
CREATE INDEX IF NOT EXISTS idx_responsavel_membros_membro ON public.responsavel_membros(membro_id);
CREATE INDEX IF NOT EXISTS idx_desbravadores_clube ON public.desbravadores(clube_id);
CREATE INDEX IF NOT EXISTS idx_pontuacoes_clube ON public.pontuacoes(clube_id);
CREATE INDEX IF NOT EXISTS idx_eventos_clube ON public.eventos(clube_id);

-- Funções auxiliares para futuras policies multi-clube.
CREATE OR REPLACE FUNCTION public.current_user_is_admin_ti()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid()
      AND uc.perfil = 'admin_ti'
      AND uc.ativo = TRUE
  )
  OR EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.perfil IN ('admin_ti', 'admin_total')
  )
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_clube(target_clube_id INTEGER)
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
  )
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_responsavel_membro(target_membro_id INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.responsavel_membros rm
    WHERE rm.usuario_id = auth.uid()
      AND rm.membro_id = target_membro_id
      AND rm.ativo = TRUE
      AND rm.pode_visualizar = TRUE
  )
$$;

-- Atualiza is_admin legado para considerar novos perfis sem quebrar policies antigas.
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
    'usuario_secretaria'
  )
  OR public.current_user_is_admin_ti()
$$;

-- RLS nas tabelas novas.
ALTER TABLE public.programas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis_acesso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_clubes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responsavel_membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes_modelo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargos_modelo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_modelo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.especialidades_modelo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pontuacao_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "programas_select_authenticated" ON public.programas;
DROP POLICY IF EXISTS "programas_admin_ti_all" ON public.programas;
DROP POLICY IF EXISTS "clubes_select_vinculados" ON public.clubes;
DROP POLICY IF EXISTS "clubes_admin_ti_all" ON public.clubes;
DROP POLICY IF EXISTS "perfis_select_authenticated" ON public.perfis_acesso;
DROP POLICY IF EXISTS "perfis_admin_ti_all" ON public.perfis_acesso;
DROP POLICY IF EXISTS "usuario_clubes_select_self_or_admin" ON public.usuario_clubes;
DROP POLICY IF EXISTS "usuario_clubes_admin_all" ON public.usuario_clubes;
DROP POLICY IF EXISTS "responsavel_membros_select_self_or_admin" ON public.responsavel_membros;
DROP POLICY IF EXISTS "responsavel_membros_admin_all" ON public.responsavel_membros;
DROP POLICY IF EXISTS "classes_modelo_select_authenticated" ON public.classes_modelo;
DROP POLICY IF EXISTS "classes_modelo_admin_all" ON public.classes_modelo;
DROP POLICY IF EXISTS "cargos_modelo_select_authenticated" ON public.cargos_modelo;
DROP POLICY IF EXISTS "cargos_modelo_admin_all" ON public.cargos_modelo;
DROP POLICY IF EXISTS "documentos_modelo_select_authenticated" ON public.documentos_modelo;
DROP POLICY IF EXISTS "documentos_modelo_admin_all" ON public.documentos_modelo;
DROP POLICY IF EXISTS "especialidades_modelo_select_authenticated" ON public.especialidades_modelo;
DROP POLICY IF EXISTS "especialidades_modelo_admin_all" ON public.especialidades_modelo;
DROP POLICY IF EXISTS "pontuacao_itens_select_clube" ON public.pontuacao_itens;
DROP POLICY IF EXISTS "pontuacao_itens_admin_all" ON public.pontuacao_itens;

CREATE POLICY "programas_select_authenticated"
ON public.programas FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "programas_admin_ti_all"
ON public.programas FOR ALL
USING (public.current_user_is_admin_ti())
WITH CHECK (public.current_user_is_admin_ti());

CREATE POLICY "clubes_select_vinculados"
ON public.clubes FOR SELECT
USING (public.current_user_has_clube(id));

CREATE POLICY "clubes_admin_ti_all"
ON public.clubes FOR ALL
USING (public.current_user_is_admin_ti())
WITH CHECK (public.current_user_is_admin_ti());

CREATE POLICY "perfis_select_authenticated"
ON public.perfis_acesso FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "perfis_admin_ti_all"
ON public.perfis_acesso FOR ALL
USING (public.current_user_is_admin_ti())
WITH CHECK (public.current_user_is_admin_ti());

CREATE POLICY "usuario_clubes_select_self_or_admin"
ON public.usuario_clubes FOR SELECT
USING (usuario_id = auth.uid() OR public.current_user_has_clube(clube_id));

CREATE POLICY "usuario_clubes_admin_all"
ON public.usuario_clubes FOR ALL
USING (public.current_user_is_admin_ti() OR public.current_user_has_clube(clube_id))
WITH CHECK (public.current_user_is_admin_ti() OR public.current_user_has_clube(clube_id));

CREATE POLICY "responsavel_membros_select_self_or_admin"
ON public.responsavel_membros FOR SELECT
USING (usuario_id = auth.uid() OR public.current_user_has_clube(clube_id));

CREATE POLICY "responsavel_membros_admin_all"
ON public.responsavel_membros FOR ALL
USING (public.current_user_is_admin_ti() OR public.current_user_has_clube(clube_id))
WITH CHECK (public.current_user_is_admin_ti() OR public.current_user_has_clube(clube_id));

CREATE POLICY "classes_modelo_select_authenticated"
ON public.classes_modelo FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "classes_modelo_admin_all"
ON public.classes_modelo FOR ALL
USING (public.current_user_is_admin_ti())
WITH CHECK (public.current_user_is_admin_ti());

CREATE POLICY "cargos_modelo_select_authenticated"
ON public.cargos_modelo FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "cargos_modelo_admin_all"
ON public.cargos_modelo FOR ALL
USING (public.current_user_is_admin_ti())
WITH CHECK (public.current_user_is_admin_ti());

CREATE POLICY "documentos_modelo_select_authenticated"
ON public.documentos_modelo FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "documentos_modelo_admin_all"
ON public.documentos_modelo FOR ALL
USING (public.current_user_is_admin_ti() OR public.current_user_has_clube(COALESCE(clube_id, 1)))
WITH CHECK (public.current_user_is_admin_ti() OR clube_id IS NULL OR public.current_user_has_clube(clube_id));

CREATE POLICY "especialidades_modelo_select_authenticated"
ON public.especialidades_modelo FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "especialidades_modelo_admin_all"
ON public.especialidades_modelo FOR ALL
USING (public.current_user_is_admin_ti())
WITH CHECK (public.current_user_is_admin_ti());

CREATE POLICY "pontuacao_itens_select_clube"
ON public.pontuacao_itens FOR SELECT
USING (public.current_user_has_clube(clube_id));

CREATE POLICY "pontuacao_itens_admin_all"
ON public.pontuacao_itens FOR ALL
USING (public.current_user_has_clube(clube_id))
WITH CHECK (public.current_user_has_clube(clube_id));
