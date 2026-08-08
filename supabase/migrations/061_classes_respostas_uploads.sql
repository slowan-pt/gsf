-- Respostas (texto/arquivo) dos requisitos de classe, replicacao por idade e
-- acesso do perfil Regional.

-- ---------------------------------------------------------------------------
-- Comportamento de cada requisito
-- ---------------------------------------------------------------------------
ALTER TABLE public.classes_requisitos_catalogo
  ADD COLUMN IF NOT EXISTS formato_resposta TEXT NOT NULL DEFAULT 'nenhum',
  ADD COLUMN IF NOT EXISTS max_arquivos INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS idade_minima INTEGER,
  ADD COLUMN IF NOT EXISTS chave_compartilhada TEXT,
  ADD COLUMN IF NOT EXISTS grupo_escolha TEXT,
  ADD COLUMN IF NOT EXISTS escolhas_necessarias INTEGER,
  ADD COLUMN IF NOT EXISTS rotulo TEXT,
  ADD COLUMN IF NOT EXISTS documento_campo TEXT;

DO $$
BEGIN
  ALTER TABLE public.classes_requisitos_catalogo
    ADD CONSTRAINT classes_req_formato_check
    CHECK (formato_resposta IN ('nenhum', 'texto', 'upload', 'texto_upload', 'checkbox'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_classes_req_chave_compartilhada
  ON public.classes_requisitos_catalogo (chave_compartilhada, idade_minima)
  WHERE chave_compartilhada IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_classes_req_grupo_escolha
  ON public.classes_requisitos_catalogo (classe_nome, grupo_escolha)
  WHERE grupo_escolha IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Respostas em texto
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.classes_requisitos_respostas (
  id BIGSERIAL PRIMARY KEY,
  clube_id INTEGER NOT NULL REFERENCES public.clubes(id) ON DELETE CASCADE,
  dbv_id INTEGER NOT NULL REFERENCES public.desbravadores(id) ON DELETE CASCADE,
  requisito_id BIGINT NOT NULL REFERENCES public.classes_requisitos_catalogo(id) ON DELETE CASCADE,
  texto TEXT,
  atualizado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clube_id, dbv_id, requisito_id)
);

CREATE INDEX IF NOT EXISTS idx_classes_req_respostas_dbv
  ON public.classes_requisitos_respostas (clube_id, dbv_id);

-- ---------------------------------------------------------------------------
-- Arquivos anexados (foto, PDF, documento)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.classes_requisitos_arquivos (
  id BIGSERIAL PRIMARY KEY,
  clube_id INTEGER NOT NULL REFERENCES public.clubes(id) ON DELETE CASCADE,
  dbv_id INTEGER NOT NULL REFERENCES public.desbravadores(id) ON DELETE CASCADE,
  requisito_id BIGINT NOT NULL REFERENCES public.classes_requisitos_catalogo(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  url TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'outro',
  origem TEXT NOT NULL DEFAULT 'upload' CHECK (origem IN ('upload', 'documento')),
  enviado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_classes_req_arquivos_dbv
  ON public.classes_requisitos_arquivos (clube_id, dbv_id, requisito_id);

-- ---------------------------------------------------------------------------
-- Replicacao de requisitos comuns entre classes, respeitando a idade
-- ---------------------------------------------------------------------------

-- Idade do membro hoje (usa data_nascimento; cai para a coluna idade se faltar).
CREATE OR REPLACE FUNCTION public.idade_membro(p_dbv_id INTEGER)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    CASE WHEN d.data_nascimento IS NOT NULL
         THEN date_part('year', age(CURRENT_DATE, d.data_nascimento))::int END,
    d.idade
  )
  FROM public.desbravadores d
  WHERE d.id = p_dbv_id;
$$;

/*
 * Marca, em todas as classes, os requisitos que compartilham a mesma chave
 * (ex.: documento de identidade) e cuja idade minima o membro ja atingiu.
 * Um membro de 10 anos so marca o requisito de Amigo; um de 11 marca tambem o
 * de Companheiro.
 */
CREATE OR REPLACE FUNCTION public.replicar_requisito_compartilhado(
  p_clube_id INTEGER,
  p_dbv_id INTEGER,
  p_chave TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_idade INTEGER;
  v_marcados INTEGER := 0;
BEGIN
  IF p_chave IS NULL OR btrim(p_chave) = '' THEN
    RETURN 0;
  END IF;

  v_idade := public.idade_membro(p_dbv_id);

  WITH alvo AS (
    INSERT INTO public.classes_requisitos_progresso
      (clube_id, dbv_id, requisito_id, classe_nome, concluido, origem, concluido_em, updated_at)
    SELECT p_clube_id, p_dbv_id, c.id, c.classe_nome, TRUE, 'manual', now(), now()
    FROM public.classes_requisitos_catalogo c
    WHERE c.ativo = TRUE
      AND c.chave_compartilhada = p_chave
      AND (c.idade_minima IS NULL OR (v_idade IS NOT NULL AND v_idade >= c.idade_minima))
    ON CONFLICT (clube_id, dbv_id, requisito_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_marcados FROM alvo;

  RETURN v_marcados;
END;
$$;

-- Ao marcar um requisito compartilhado, replica para as demais classes elegiveis.
CREATE OR REPLACE FUNCTION public.trg_replicar_requisito_compartilhado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chave TEXT;
BEGIN
  IF NEW.concluido IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT c.chave_compartilhada INTO v_chave
  FROM public.classes_requisitos_catalogo c
  WHERE c.id = NEW.requisito_id;

  IF v_chave IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.replicar_requisito_compartilhado(NEW.clube_id, NEW.dbv_id, v_chave);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_classes_req_replicar ON public.classes_requisitos_progresso;
CREATE TRIGGER trg_classes_req_replicar
AFTER INSERT ON public.classes_requisitos_progresso
FOR EACH ROW
EXECUTE FUNCTION public.trg_replicar_requisito_compartilhado();

-- ---------------------------------------------------------------------------
-- RG entregue na ficha do membro conclui o requisito de identidade
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_requisito_documento_identidade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_idade INTEGER;
BEGIN
  IF NEW.campo IS DISTINCT FROM 'rg' OR NEW.clube_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_idade := public.idade_membro(NEW.dbv_id);

  -- Disponibiliza uma copia do arquivo dentro do requisito de cada classe elegivel.
  INSERT INTO public.classes_requisitos_arquivos
    (clube_id, dbv_id, requisito_id, nome, url, tipo, origem)
  SELECT NEW.clube_id, NEW.dbv_id, c.id, NEW.nome, NEW.url, COALESCE(NEW.tipo, 'outro'), 'documento'
  FROM public.classes_requisitos_catalogo c
  WHERE c.ativo = TRUE
    AND c.documento_campo = 'rg'
    AND (c.idade_minima IS NULL OR (v_idade IS NOT NULL AND v_idade >= c.idade_minima))
    AND NOT EXISTS (
      SELECT 1 FROM public.classes_requisitos_arquivos a
      WHERE a.clube_id = NEW.clube_id AND a.dbv_id = NEW.dbv_id
        AND a.requisito_id = c.id AND a.url = NEW.url
    );

  INSERT INTO public.classes_requisitos_progresso
    (clube_id, dbv_id, requisito_id, classe_nome, concluido, origem, concluido_em, updated_at)
  SELECT NEW.clube_id, NEW.dbv_id, c.id, c.classe_nome, TRUE, 'manual', now(), now()
  FROM public.classes_requisitos_catalogo c
  WHERE c.ativo = TRUE
    AND c.documento_campo = 'rg'
    AND (c.idade_minima IS NULL OR (v_idade IS NOT NULL AND v_idade >= c.idade_minima))
  ON CONFLICT (clube_id, dbv_id, requisito_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_requisito_documento_identidade ON public.documento_imagens;
CREATE TRIGGER trg_requisito_documento_identidade
AFTER INSERT ON public.documento_imagens
FOR EACH ROW
EXECUTE FUNCTION public.sync_requisito_documento_identidade();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.classes_requisitos_respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes_requisitos_arquivos ENABLE ROW LEVEL SECURITY;

-- Le quem tem vinculo no clube (inclui o Regional), o proprio membro e o responsavel.
DROP POLICY IF EXISTS "classes_req_respostas_select" ON public.classes_requisitos_respostas;
CREATE POLICY "classes_req_respostas_select"
ON public.classes_requisitos_respostas
FOR SELECT TO authenticated
USING (
  public.current_user_has_clube(clube_id)
  OR public.current_user_dbv_id() = dbv_id
  OR public.current_user_is_responsavel_membro(dbv_id)
);

-- Escreve: quem administra o clube, o proprio membro e o responsavel dele.
-- (O Regional apenas valida/consulta, nao escreve resposta pelo membro.)
DROP POLICY IF EXISTS "classes_req_respostas_manage" ON public.classes_requisitos_respostas;
CREATE POLICY "classes_req_respostas_manage"
ON public.classes_requisitos_respostas
FOR ALL TO authenticated
USING (
  public.current_user_can_admin_clube(clube_id)
  OR public.current_user_dbv_id() = dbv_id
  OR public.current_user_is_responsavel_membro(dbv_id)
)
WITH CHECK (
  public.current_user_can_admin_clube(clube_id)
  OR public.current_user_dbv_id() = dbv_id
  OR public.current_user_is_responsavel_membro(dbv_id)
);

DROP POLICY IF EXISTS "classes_req_arquivos_select" ON public.classes_requisitos_arquivos;
CREATE POLICY "classes_req_arquivos_select"
ON public.classes_requisitos_arquivos
FOR SELECT TO authenticated
USING (
  public.current_user_has_clube(clube_id)
  OR public.current_user_dbv_id() = dbv_id
  OR public.current_user_is_responsavel_membro(dbv_id)
);

DROP POLICY IF EXISTS "classes_req_arquivos_manage" ON public.classes_requisitos_arquivos;
CREATE POLICY "classes_req_arquivos_manage"
ON public.classes_requisitos_arquivos
FOR ALL TO authenticated
USING (
  public.current_user_can_admin_clube(clube_id)
  OR public.current_user_dbv_id() = dbv_id
  OR public.current_user_is_responsavel_membro(dbv_id)
)
WITH CHECK (
  public.current_user_can_admin_clube(clube_id)
  OR public.current_user_dbv_id() = dbv_id
  OR public.current_user_is_responsavel_membro(dbv_id)
);

-- O proprio membro e o responsavel tambem podem marcar requisitos que sao de
-- preenchimento deles (texto/upload). A marcacao de conclusao continua restrita.
DROP POLICY IF EXISTS "classes_req_progresso_manage" ON public.classes_requisitos_progresso;
CREATE POLICY "classes_req_progresso_manage"
ON public.classes_requisitos_progresso
FOR ALL TO authenticated
USING (
  public.current_user_is_admin_ti()
  OR EXISTS (
    SELECT 1 FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid()
      AND uc.clube_id = classes_requisitos_progresso.clube_id
      AND uc.ativo = TRUE
      AND uc.perfil IN ('admin_clube', 'admin_geral', 'admin_total', 'usuario_secretaria')
  )
)
WITH CHECK (
  public.current_user_is_admin_ti()
  OR EXISTS (
    SELECT 1 FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid()
      AND uc.clube_id = classes_requisitos_progresso.clube_id
      AND uc.ativo = TRUE
      AND uc.perfil IN ('admin_clube', 'admin_geral', 'admin_total', 'usuario_secretaria')
  )
);

-- ---------------------------------------------------------------------------
-- Especialidade concluida via requisito ja entra na fila de investidura
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_especialidade_por_requisito()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_especialidade TEXT;
BEGIN
  IF NEW.concluido IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT c.especialidade_nome INTO v_especialidade
  FROM public.classes_requisitos_catalogo c
  WHERE c.id = NEW.requisito_id;

  IF v_especialidade IS NULL OR btrim(v_especialidade) = '' THEN
    RETURN NEW;
  END IF;

  -- Ja registrada como OK: nao reescreve (evita recursao com o trigger inverso).
  IF EXISTS (
    SELECT 1 FROM public.especialidades e
    WHERE e.dbv_id = NEW.dbv_id AND e.nome = v_especialidade AND e.status = 'OK'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.especialidades (clube_id, dbv_id, nome, status, updated_at)
  VALUES (NEW.clube_id, NEW.dbv_id, v_especialidade, 'OK', now())
  ON CONFLICT (dbv_id, nome) DO UPDATE
    SET status = 'OK', updated_at = now();

  -- Marca como pronta para ser entregue na proxima investidura.
  INSERT INTO public.investidura_itens (clube_id, dbv_id, tipo, item_nome, marcado, entregue)
  VALUES (NEW.clube_id, NEW.dbv_id, 'especialidade', v_especialidade, TRUE, FALSE)
  ON CONFLICT (clube_id, dbv_id, tipo, item_nome) DO NOTHING;

  RETURN NEW;
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes_requisitos_respostas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes_requisitos_arquivos TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.classes_requisitos_respostas_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.classes_requisitos_arquivos_id_seq TO authenticated;
