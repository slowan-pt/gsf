-- Requisitos das classes regulares/avancadas + progresso gamificado por membro.
-- O catalogo e global (conteudo oficial), o progresso e por clube/membro.

CREATE TABLE IF NOT EXISTS public.classes_requisitos_catalogo (
  id BIGSERIAL PRIMARY KEY,
  classe_nome TEXT NOT NULL,
  secao TEXT NOT NULL,
  secao_ordem INTEGER NOT NULL DEFAULT 1,
  ordem INTEGER NOT NULL DEFAULT 1,
  codigo TEXT NOT NULL,
  codigo_raiz TEXT NOT NULL DEFAULT '',
  subitem TEXT,
  texto TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'Requisito',
  pagina INTEGER,
  especialidade_nome TEXT,
  avancada BOOLEAN NOT NULL DEFAULT FALSE,
  pontua BOOLEAN NOT NULL DEFAULT TRUE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_classes_req_catalogo_unico
  ON public.classes_requisitos_catalogo (classe_nome, secao, codigo, COALESCE(subitem, ''));

CREATE INDEX IF NOT EXISTS idx_classes_req_catalogo_classe
  ON public.classes_requisitos_catalogo (classe_nome, secao_ordem, ordem)
  WHERE ativo = TRUE;

CREATE INDEX IF NOT EXISTS idx_classes_req_catalogo_especialidade
  ON public.classes_requisitos_catalogo (especialidade_nome)
  WHERE especialidade_nome IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.classes_requisitos_progresso (
  id BIGSERIAL PRIMARY KEY,
  clube_id INTEGER NOT NULL REFERENCES public.clubes(id) ON DELETE CASCADE,
  dbv_id INTEGER NOT NULL REFERENCES public.desbravadores(id) ON DELETE CASCADE,
  requisito_id BIGINT NOT NULL REFERENCES public.classes_requisitos_catalogo(id) ON DELETE CASCADE,
  classe_nome TEXT NOT NULL,
  concluido BOOLEAN NOT NULL DEFAULT TRUE,
  origem TEXT NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'atividade', 'especialidade')),
  atividade_id BIGINT REFERENCES public.atividades(id) ON DELETE SET NULL,
  observacao TEXT,
  concluido_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  concluido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clube_id, dbv_id, requisito_id)
);

CREATE INDEX IF NOT EXISTS idx_classes_req_progresso_dbv
  ON public.classes_requisitos_progresso (clube_id, dbv_id, classe_nome)
  WHERE concluido = TRUE;

-- Permite que um requisito vire modelo de atividade avaliavel.
ALTER TABLE public.atividades
  ADD COLUMN IF NOT EXISTS classe_requisito_id BIGINT REFERENCES public.classes_requisitos_catalogo(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_atividades_classe_requisito
  ON public.atividades (clube_id, classe_requisito_id)
  WHERE classe_requisito_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Cruzamento especialidade <-> requisito
-- ---------------------------------------------------------------------------

-- Normalizador simples (sem depender da extensao unaccent).
CREATE OR REPLACE FUNCTION public.unaccent_simples(txt TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT translate(
    trim(coalesce(txt, '')),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
  );
$$;

-- Especialidade concluida marca automaticamente todo requisito que a exige.
CREATE OR REPLACE FUNCTION public.sync_requisitos_por_especialidade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'OK' OR NEW.clube_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Ja estava OK: nada mudou. Corta a recursao com o trigger inverso.
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM 'OK' THEN
    RETURN NEW;
  END IF;

  -- Marca a linha da especialidade e tambem o requisito-raiz a que ela pertence
  -- ("Completar uma das seguintes especialidades: ..." e satisfeito por qualquer uma).
  INSERT INTO public.classes_requisitos_progresso
    (clube_id, dbv_id, requisito_id, classe_nome, concluido, origem, concluido_em, updated_at)
  SELECT DISTINCT NEW.clube_id, NEW.dbv_id, alvo.id, alvo.classe_nome, TRUE, 'especialidade', now(), now()
  FROM public.classes_requisitos_catalogo c
  JOIN public.classes_requisitos_catalogo alvo
    ON alvo.ativo = TRUE
   AND (
     alvo.id = c.id
     OR (alvo.classe_nome = c.classe_nome
         AND alvo.secao = c.secao
         AND alvo.codigo = c.codigo_raiz
         AND alvo.subitem IS NULL)
   )
  WHERE c.ativo = TRUE
    AND c.especialidade_nome IS NOT NULL
    AND lower(public.unaccent_simples(c.especialidade_nome)) = lower(public.unaccent_simples(NEW.nome))
  ON CONFLICT (clube_id, dbv_id, requisito_id) DO UPDATE
    SET concluido = TRUE,
        origem = CASE WHEN classes_requisitos_progresso.origem = 'manual'
                      THEN classes_requisitos_progresso.origem
                      ELSE 'especialidade' END,
        updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_requisitos_especialidade ON public.especialidades;
CREATE TRIGGER trg_sync_requisitos_especialidade
AFTER INSERT OR UPDATE OF status ON public.especialidades
FOR EACH ROW
EXECUTE FUNCTION public.sync_requisitos_por_especialidade();

-- Requisito de especialidade marcado manualmente registra a especialidade do membro.
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_especialidade_requisito ON public.classes_requisitos_progresso;
CREATE TRIGGER trg_sync_especialidade_requisito
AFTER INSERT OR UPDATE OF concluido ON public.classes_requisitos_progresso
FOR EACH ROW
EXECUTE FUNCTION public.sync_especialidade_por_requisito();

-- Atividade aprovada conclui o requisito que ela representa.
CREATE OR REPLACE FUNCTION public.sync_requisito_por_resposta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requisito BIGINT;
  v_classe TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM 'aprovada' OR NEW.clube_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT a.classe_requisito_id INTO v_requisito
  FROM public.atividades a
  WHERE a.id = NEW.atividade_id;

  IF v_requisito IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.classe_nome INTO v_classe
  FROM public.classes_requisitos_catalogo c
  WHERE c.id = v_requisito;

  INSERT INTO public.classes_requisitos_progresso
    (clube_id, dbv_id, requisito_id, classe_nome, concluido, origem, atividade_id, concluido_em, updated_at)
  VALUES (NEW.clube_id, NEW.dbv_id, v_requisito, v_classe, TRUE, 'atividade', NEW.atividade_id, now(), now())
  ON CONFLICT (clube_id, dbv_id, requisito_id) DO UPDATE
    SET concluido = TRUE,
        origem = CASE WHEN classes_requisitos_progresso.origem = 'manual'
                      THEN classes_requisitos_progresso.origem
                      ELSE 'atividade' END,
        atividade_id = EXCLUDED.atividade_id,
        updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_requisito_resposta ON public.atividades_respostas;
CREATE TRIGGER trg_sync_requisito_resposta
AFTER INSERT OR UPDATE OF status ON public.atividades_respostas
FOR EACH ROW
EXECUTE FUNCTION public.sync_requisito_por_resposta();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.classes_requisitos_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes_requisitos_progresso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "classes_req_catalogo_select" ON public.classes_requisitos_catalogo;
CREATE POLICY "classes_req_catalogo_select"
ON public.classes_requisitos_catalogo
FOR SELECT TO authenticated
USING (TRUE);

DROP POLICY IF EXISTS "classes_req_catalogo_admin" ON public.classes_requisitos_catalogo;
CREATE POLICY "classes_req_catalogo_admin"
ON public.classes_requisitos_catalogo
FOR ALL TO authenticated
USING (public.current_user_is_admin_ti())
WITH CHECK (public.current_user_is_admin_ti());

-- Ve o progresso: quem administra o clube, o proprio membro, o responsavel do
-- membro e qualquer usuario com vinculo ativo no clube (conselheiro/diretoria).
DROP POLICY IF EXISTS "classes_req_progresso_select" ON public.classes_requisitos_progresso;
CREATE POLICY "classes_req_progresso_select"
ON public.classes_requisitos_progresso
FOR SELECT TO authenticated
USING (
  public.current_user_has_clube(clube_id)
  OR public.current_user_dbv_id() = dbv_id
  OR public.current_user_is_responsavel_membro(dbv_id)
);

-- Marca/desmarca requisito: somente admin TI, admin do clube e secretaria.
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

GRANT SELECT ON public.classes_requisitos_catalogo TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.classes_requisitos_catalogo TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes_requisitos_progresso TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.classes_requisitos_catalogo_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.classes_requisitos_progresso_id_seq TO authenticated;
