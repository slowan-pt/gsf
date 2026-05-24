-- Preparacao para prioridades 5 a 12.
-- Conservadora: cria estruturas de apoio sem trocar telas atuais para as novas tabelas.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 5. Tabela sombra para normalizacao futura de desbravadores/aventureiros em membros.
CREATE TABLE IF NOT EXISTS public.membros (
  id SERIAL PRIMARY KEY,
  clube_id INTEGER NOT NULL REFERENCES public.clubes(id) ON DELETE CASCADE,
  programa_id INTEGER NOT NULL REFERENCES public.programas(id) ON DELETE RESTRICT,
  legacy_desbravador_id INTEGER UNIQUE REFERENCES public.desbravadores(id) ON DELETE SET NULL,
  idx INTEGER,
  id_sgc TEXT,
  nome TEXT NOT NULL,
  data_nascimento DATE,
  idade INTEGER,
  genero TEXT,
  unidade_id INTEGER REFERENCES public.unidades(id) ON DELETE SET NULL,
  unidade_nome TEXT,
  cargo TEXT,
  email TEXT,
  contato TEXT,
  camisa TEXT,
  foto_url TEXT,
  nome_responsavel TEXT,
  contato_responsavel TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS membros_clube_nome_idx ON public.membros (clube_id, nome);
CREATE INDEX IF NOT EXISTS membros_programa_idx ON public.membros (programa_id);
CREATE INDEX IF NOT EXISTS membros_unidade_idx ON public.membros (clube_id, unidade_id);

INSERT INTO public.membros (
  clube_id, programa_id, legacy_desbravador_id, idx, id_sgc, nome,
  data_nascimento, idade, genero, unidade_id, unidade_nome, cargo,
  email, contato, camisa, foto_url, nome_responsavel, contato_responsavel,
  ativo, created_at, updated_at
)
SELECT
  COALESCE(d.clube_id, 1),
  c.programa_id,
  d.id,
  d.idx,
  d.id_sgc,
  d.nome,
  d.data_nascimento,
  d.idade,
  d.genero,
  d.unidade_id,
  d.unidade_nome,
  d.cargo,
  d.email,
  d.contato,
  d.camisa,
  d.foto_url,
  d.nome_responsavel,
  d.contato_responsavel,
  TRUE,
  COALESCE(d.created_at, NOW()),
  COALESCE(d.updated_at, NOW())
FROM public.desbravadores d
JOIN public.clubes c ON c.id = COALESCE(d.clube_id, 1)
ON CONFLICT (legacy_desbravador_id) DO UPDATE
SET clube_id = EXCLUDED.clube_id,
    programa_id = EXCLUDED.programa_id,
    idx = EXCLUDED.idx,
    id_sgc = EXCLUDED.id_sgc,
    nome = EXCLUDED.nome,
    data_nascimento = EXCLUDED.data_nascimento,
    idade = EXCLUDED.idade,
    genero = EXCLUDED.genero,
    unidade_id = EXCLUDED.unidade_id,
    unidade_nome = EXCLUDED.unidade_nome,
    cargo = EXCLUDED.cargo,
    email = EXCLUDED.email,
    contato = EXCLUDED.contato,
    camisa = EXCLUDED.camisa,
    foto_url = EXCLUDED.foto_url,
    nome_responsavel = EXCLUDED.nome_responsavel,
    contato_responsavel = EXCLUDED.contato_responsavel,
    ativo = TRUE,
    updated_at = NOW();

CREATE OR REPLACE VIEW public.v_membros AS
SELECT
  m.*,
  p.codigo AS programa_codigo,
  p.nome AS programa_nome,
  c.nome AS clube_nome,
  c.nome_curto AS clube_nome_curto
FROM public.membros m
JOIN public.programas p ON p.id = m.programa_id
JOIN public.clubes c ON c.id = m.clube_id;

-- 7. Controle de onboarding de clube.
CREATE TABLE IF NOT EXISTS public.clubes_onboarding_status (
  clube_id INTEGER PRIMARY KEY REFERENCES public.clubes(id) ON DELETE CASCADE,
  modelos_clonados BOOLEAN NOT NULL DEFAULT FALSE,
  unidades_criadas BOOLEAN NOT NULL DEFAULT FALSE,
  admin_convidado BOOLEAN NOT NULL DEFAULT FALSE,
  primeiro_import_realizado BOOLEAN NOT NULL DEFAULT FALSE,
  finalizado BOOLEAN NOT NULL DEFAULT FALSE,
  observacoes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Importacao em lote.
CREATE TABLE IF NOT EXISTS public.importacoes_lote (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clube_id INTEGER NOT NULL REFERENCES public.clubes(id) ON DELETE CASCADE,
  programa_id INTEGER NOT NULL REFERENCES public.programas(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL CHECK (tipo IN ('membros', 'agenda', 'pontuacao', 'documentos', 'especialidades')),
  nome_arquivo TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'validando', 'validado', 'processando', 'concluido', 'erro', 'cancelado')),
  total_linhas INTEGER NOT NULL DEFAULT 0,
  linhas_ok INTEGER NOT NULL DEFAULT 0,
  linhas_erro INTEGER NOT NULL DEFAULT 0,
  resumo JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.importacoes_lote_itens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lote_id UUID NOT NULL REFERENCES public.importacoes_lote(id) ON DELETE CASCADE,
  linha INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'ok', 'erro', 'ignorado')),
  dados JSONB NOT NULL DEFAULT '{}'::jsonb,
  erros JSONB NOT NULL DEFAULT '[]'::jsonb,
  entidade_tipo TEXT,
  entidade_id TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lote_id, linha)
);

-- 9. Modelos de relatorio.
CREATE TABLE IF NOT EXISTS public.relatorios_modelo (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  escopo TEXT NOT NULL DEFAULT 'clube' CHECK (escopo IN ('plataforma', 'programa', 'clube', 'unidade', 'proprio')),
  programa_id INTEGER REFERENCES public.programas(id) ON DELETE CASCADE,
  clube_id INTEGER REFERENCES public.clubes(id) ON DELETE CASCADE,
  configuracao JSONB NOT NULL DEFAULT '{}'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  ordem INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS relatorios_modelo_escopo_unique_idx
  ON public.relatorios_modelo (codigo, COALESCE(programa_id, 0), COALESCE(clube_id, 0));

INSERT INTO public.relatorios_modelo (codigo, nome, descricao, escopo, programa_id, clube_id, configuracao, ordem)
VALUES
  ('membros_geral', 'Membros do clube - geral', 'Lista completa de membros do clube.', 'clube', NULL, NULL, '{"tipo":"membros","inclui_diretoria":true}'::jsonb, 1),
  ('membros_sem_diretoria', 'Membros do clube - sem diretoria', 'Lista de membros sem diretoria.', 'clube', NULL, NULL, '{"tipo":"membros","inclui_diretoria":false}'::jsonb, 2),
  ('documentos_status', 'Documentação entregue ou pendente', 'Resumo de documentação por membro.', 'clube', NULL, NULL, '{"tipo":"documentos"}'::jsonb, 3),
  ('pontuacao_ranking', 'Pontuação e ranking', 'Pontuação por período e ranking.', 'clube', NULL, NULL, '{"tipo":"pontuacao"}'::jsonb, 4)
ON CONFLICT (codigo, COALESCE(programa_id, 0), COALESCE(clube_id, 0)) DO UPDATE
SET nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao,
    configuracao = EXCLUDED.configuracao,
    ordem = EXCLUDED.ordem,
    ativo = TRUE,
    updated_at = NOW();

-- 10. Registro padronizado de arquivos. O Storage continua sendo a fonte do binario.
CREATE TABLE IF NOT EXISTS public.arquivos_registro (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clube_id INTEGER NOT NULL REFERENCES public.clubes(id) ON DELETE CASCADE,
  programa_id INTEGER REFERENCES public.programas(id) ON DELETE SET NULL,
  membro_id INTEGER REFERENCES public.desbravadores(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL,
  path TEXT NOT NULL,
  nome_original TEXT,
  mime_type TEXT,
  tamanho_bytes BIGINT,
  tipo_entidade TEXT NOT NULL,
  entidade_id TEXT,
  campo TEXT,
  confidencial BOOLEAN NOT NULL DEFAULT TRUE,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (bucket, path)
);

CREATE INDEX IF NOT EXISTS arquivos_registro_clube_idx ON public.arquivos_registro (clube_id, tipo_entidade);
CREATE INDEX IF NOT EXISTS arquivos_registro_membro_idx ON public.arquivos_registro (membro_id, campo);

-- 11. Auditoria.
CREATE TABLE IF NOT EXISTS public.auditoria_eventos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clube_id INTEGER REFERENCES public.clubes(id) ON DELETE SET NULL,
  programa_id INTEGER REFERENCES public.programas(id) ON DELETE SET NULL,
  ator_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  alvo_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  membro_id INTEGER REFERENCES public.desbravadores(id) ON DELETE SET NULL,
  acao TEXT NOT NULL,
  entidade TEXT,
  entidade_id TEXT,
  antes JSONB,
  depois JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auditoria_eventos_clube_idx ON public.auditoria_eventos (clube_id, created_at DESC);
CREATE INDEX IF NOT EXISTS auditoria_eventos_ator_idx ON public.auditoria_eventos (ator_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS auditoria_eventos_membro_idx ON public.auditoria_eventos (membro_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.registrar_auditoria(
  p_clube_id INTEGER,
  p_acao TEXT,
  p_entidade TEXT DEFAULT NULL,
  p_entidade_id TEXT DEFAULT NULL,
  p_membro_id INTEGER DEFAULT NULL,
  p_alvo_user_id UUID DEFAULT NULL,
  p_antes JSONB DEFAULT NULL,
  p_depois JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  novo_id UUID;
  p_programa_id INTEGER;
BEGIN
  SELECT programa_id INTO p_programa_id FROM public.clubes WHERE id = p_clube_id;

  INSERT INTO public.auditoria_eventos (
    clube_id, programa_id, ator_user_id, alvo_user_id, membro_id,
    acao, entidade, entidade_id, antes, depois, metadata
  )
  VALUES (
    p_clube_id, p_programa_id, auth.uid(), p_alvo_user_id, p_membro_id,
    p_acao, p_entidade, p_entidade_id, p_antes, p_depois, COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO novo_id;

  RETURN novo_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_auditoria(INTEGER, TEXT, TEXT, TEXT, INTEGER, UUID, JSONB, JSONB, JSONB) TO authenticated;

-- RLS.
ALTER TABLE public.membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubes_onboarding_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importacoes_lote ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importacoes_lote_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorios_modelo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arquivos_registro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "membros_select_contexto" ON public.membros;
CREATE POLICY "membros_select_contexto"
ON public.membros
FOR SELECT
TO authenticated
USING (
  public.current_user_is_admin_ti()
  OR public.current_user_has_clube(clube_id)
  OR EXISTS (
    SELECT 1 FROM public.responsavel_membros rm
    WHERE rm.usuario_id = auth.uid()
      AND rm.membro_id = membros.legacy_desbravador_id
      AND rm.ativo = TRUE
      AND rm.pode_visualizar = TRUE
  )
);

DROP POLICY IF EXISTS "membros_admin_all" ON public.membros;
CREATE POLICY "membros_admin_all"
ON public.membros
FOR ALL
TO authenticated
USING (public.current_user_can_admin_clube(clube_id))
WITH CHECK (public.current_user_can_admin_clube(clube_id));

DROP POLICY IF EXISTS "clubes_onboarding_admin_all" ON public.clubes_onboarding_status;
CREATE POLICY "clubes_onboarding_admin_all"
ON public.clubes_onboarding_status
FOR ALL
TO authenticated
USING (public.current_user_can_admin_clube(clube_id))
WITH CHECK (public.current_user_can_admin_clube(clube_id));

DROP POLICY IF EXISTS "importacoes_lote_admin_all" ON public.importacoes_lote;
CREATE POLICY "importacoes_lote_admin_all"
ON public.importacoes_lote
FOR ALL
TO authenticated
USING (public.current_user_can_admin_clube(clube_id))
WITH CHECK (public.current_user_can_admin_clube(clube_id));

DROP POLICY IF EXISTS "importacoes_lote_itens_admin_all" ON public.importacoes_lote_itens;
CREATE POLICY "importacoes_lote_itens_admin_all"
ON public.importacoes_lote_itens
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.importacoes_lote l
    WHERE l.id = importacoes_lote_itens.lote_id
      AND public.current_user_can_admin_clube(l.clube_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.importacoes_lote l
    WHERE l.id = importacoes_lote_itens.lote_id
      AND public.current_user_can_admin_clube(l.clube_id)
  )
);

DROP POLICY IF EXISTS "relatorios_modelo_select_contexto" ON public.relatorios_modelo;
CREATE POLICY "relatorios_modelo_select_contexto"
ON public.relatorios_modelo
FOR SELECT
TO authenticated
USING (
  public.current_user_is_admin_ti()
  OR clube_id IS NULL
  OR public.current_user_has_clube(clube_id)
);

DROP POLICY IF EXISTS "relatorios_modelo_admin_all" ON public.relatorios_modelo;
CREATE POLICY "relatorios_modelo_admin_all"
ON public.relatorios_modelo
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

DROP POLICY IF EXISTS "arquivos_registro_select_contexto" ON public.arquivos_registro;
CREATE POLICY "arquivos_registro_select_contexto"
ON public.arquivos_registro
FOR SELECT
TO authenticated
USING (
  public.current_user_can_admin_clube(clube_id)
  OR EXISTS (
    SELECT 1 FROM public.responsavel_membros rm
    WHERE rm.usuario_id = auth.uid()
      AND rm.membro_id = arquivos_registro.membro_id
      AND rm.ativo = TRUE
      AND rm.pode_visualizar_documentos = TRUE
  )
);

DROP POLICY IF EXISTS "arquivos_registro_admin_all" ON public.arquivos_registro;
CREATE POLICY "arquivos_registro_admin_all"
ON public.arquivos_registro
FOR ALL
TO authenticated
USING (public.current_user_can_admin_clube(clube_id))
WITH CHECK (public.current_user_can_admin_clube(clube_id));

DROP POLICY IF EXISTS "auditoria_eventos_select_admin" ON public.auditoria_eventos;
CREATE POLICY "auditoria_eventos_select_admin"
ON public.auditoria_eventos
FOR SELECT
TO authenticated
USING (
  public.current_user_is_admin_ti()
  OR (clube_id IS NOT NULL AND public.current_user_can_admin_clube(clube_id))
);

DROP POLICY IF EXISTS "auditoria_eventos_insert_self" ON public.auditoria_eventos;
CREATE POLICY "auditoria_eventos_insert_self"
ON public.auditoria_eventos
FOR INSERT
TO authenticated
WITH CHECK (
  ator_user_id = auth.uid()
  OR public.current_user_is_admin_ti()
  OR (clube_id IS NOT NULL AND public.current_user_can_admin_clube(clube_id))
);
