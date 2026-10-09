-- Mestrados: reconhecimento da conclusao de um conjunto especifico de especialidades.
--
-- * Regras no banco (editaveis so pelo ADMIN TI, com versao e historico).
-- * Cada mestrado so e conquistado UMA vez por membro (unico por membro + mestrado e por membro + codigo).
-- * Quem cumpre os requisitos e encaminhado SOZINHO a diretoria, por gatilho no banco
--   (nada depende de o membro abrir uma tela).
-- * Aprovado -> vira item "aguardando investidura" (tipo 'mestrado') no fluxo de investidura existente.
-- * Tom de pele da pessoa ilustrada na faixa, salvo no perfil do membro.
--
-- As regras iniciais entram como RASCUNHO: so geram solicitacoes depois que o ADMIN TI
-- conferir a lista de especialidades de cada mestrado e ativar. Fonte e edicao ficam registradas.

-- ---------------------------------------------------------------------------
-- Nome normalizado (sem acento, minusculo, espacos simples): chave de comparacao de especialidades
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mestrado_norm(p text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT lower(btrim(regexp_replace(
    translate(coalesce(p, ''),
      'áàâãäÁÀÂÃÄéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ',
      'aaaaaAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnN'),
    '\s+', ' ', 'g')))
$$;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mestrados (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  imagem_url text,
  areas text[] NOT NULL DEFAULT '{}',
  -- Exibicao na faixa (nao altera a elegibilidade): ordem do bloco e prioridade para sobreposicoes.
  grupo_exibicao text,
  ordem_exibicao integer NOT NULL DEFAULT 100,
  prioridade_exibicao integer NOT NULL DEFAULT 100,
  quantidade_exigida integer NOT NULL DEFAULT 7 CHECK (quantidade_exigida > 0),
  fonte text,
  edicao text,
  observacoes text,
  situacao text NOT NULL DEFAULT 'rascunho' CHECK (situacao IN ('rascunho', 'ativo', 'inativo')),
  versao integer NOT NULL DEFAULT 1,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid
);

CREATE TABLE IF NOT EXISTS public.mestrado_especialidades (
  mestrado_id uuid NOT NULL REFERENCES public.mestrados(id) ON DELETE CASCADE,
  especialidade_id uuid NOT NULL REFERENCES public.especialidades_modelo(id) ON DELETE CASCADE,
  obrigatoria boolean NOT NULL DEFAULT false,
  -- Reservado para futuras regras (ex.: "2 de 3 do grupo A").
  grupo_requisito text,
  PRIMARY KEY (mestrado_id, especialidade_id)
);

CREATE TABLE IF NOT EXISTS public.mestrado_versoes (
  id bigserial PRIMARY KEY,
  mestrado_id uuid NOT NULL REFERENCES public.mestrados(id) ON DELETE CASCADE,
  versao integer NOT NULL,
  snapshot jsonb NOT NULL,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mestrado_id, versao)
);

CREATE TABLE IF NOT EXISTS public.mestrado_processos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clube_id integer NOT NULL,
  dbv_id integer NOT NULL REFERENCES public.desbravadores(id) ON DELETE CASCADE,
  mestrado_id uuid NOT NULL REFERENCES public.mestrados(id),
  codigo text NOT NULL,
  etapa text NOT NULL CHECK (etapa IN ('diretoria', 'devolvido', 'aprovado', 'investido')),
  versao_regra integer NOT NULL,
  especialidades_usadas jsonb NOT NULL DEFAULT '[]'::jsonb,
  requisitos_atendidos jsonb NOT NULL DEFAULT '{}'::jsonb,
  encaminhado_em timestamptz NOT NULL DEFAULT now(),
  reenviada boolean NOT NULL DEFAULT false,
  alerta_requisitos boolean NOT NULL DEFAULT false,
  motivo text,
  especialidades_devolvidas jsonb NOT NULL DEFAULT '[]'::jsonb,
  conjunto_na_devolucao jsonb,
  decidido_por uuid,
  decidido_em timestamptz,
  investido_em date,
  avisado_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  -- Um mestrado so pode ser conquistado uma vez por membro (nunca por area).
  CONSTRAINT mestrado_processos_membro_mestrado_uk UNIQUE (dbv_id, mestrado_id),
  CONSTRAINT mestrado_processos_membro_codigo_uk UNIQUE (dbv_id, codigo)
);

CREATE INDEX IF NOT EXISTS mestrado_processos_clube_etapa_idx ON public.mestrado_processos (clube_id, etapa);

CREATE TABLE IF NOT EXISTS public.mestrado_historico (
  id bigserial PRIMARY KEY,
  processo_id uuid NOT NULL REFERENCES public.mestrado_processos(id) ON DELETE CASCADE,
  evento text NOT NULL,
  por uuid,
  em timestamptz NOT NULL DEFAULT now(),
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS mestrado_historico_processo_idx ON public.mestrado_historico (processo_id, em);

-- Tom de pele da pessoa ilustrada na faixa (1 a 8); NULL = padrao atual.
ALTER TABLE public.desbravadores ADD COLUMN IF NOT EXISTS tom_pele smallint;
ALTER TABLE public.desbravadores DROP CONSTRAINT IF EXISTS desbravadores_tom_pele_check;
ALTER TABLE public.desbravadores ADD CONSTRAINT desbravadores_tom_pele_check CHECK (tom_pele IS NULL OR tom_pele BETWEEN 1 AND 8);

-- A investidura passa a aceitar mestrados.
ALTER TABLE public.investidura_itens DROP CONSTRAINT IF EXISTS investidura_itens_tipo_check;
ALTER TABLE public.investidura_itens ADD CONSTRAINT investidura_itens_tipo_check CHECK (tipo IN ('classe', 'especialidade', 'mestrado'));

-- ---------------------------------------------------------------------------
-- Permissoes (RLS): regras so o ADMIN TI le por completo e escreve (via funcoes).
-- ---------------------------------------------------------------------------
ALTER TABLE public.mestrados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mestrado_especialidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mestrado_versoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mestrado_processos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mestrado_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mestrados_select" ON public.mestrados;
CREATE POLICY "mestrados_select" ON public.mestrados FOR SELECT TO authenticated
  USING (situacao = 'ativo' OR public.current_user_is_admin_ti());

DROP POLICY IF EXISTS "mestrado_especialidades_select" ON public.mestrado_especialidades;
CREATE POLICY "mestrado_especialidades_select" ON public.mestrado_especialidades FOR SELECT TO authenticated
  USING (public.current_user_is_admin_ti());

DROP POLICY IF EXISTS "mestrado_versoes_select" ON public.mestrado_versoes;
CREATE POLICY "mestrado_versoes_select" ON public.mestrado_versoes FOR SELECT TO authenticated
  USING (public.current_user_is_admin_ti());

DROP POLICY IF EXISTS "mestrado_processos_select" ON public.mestrado_processos;
CREATE POLICY "mestrado_processos_select" ON public.mestrado_processos FOR SELECT TO authenticated
  USING (
    public.current_user_is_admin_ti()
    OR public.fluxo_pode_diretoria(clube_id)
    OR public.current_user_dbv_id() = dbv_id
    OR public.current_user_is_responsavel_membro(dbv_id)
  );

DROP POLICY IF EXISTS "mestrado_historico_select" ON public.mestrado_historico;
CREATE POLICY "mestrado_historico_select" ON public.mestrado_historico FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mestrado_processos p WHERE p.id = processo_id));

-- Ninguem escreve direto nas tabelas: so pelas funcoes abaixo.
REVOKE ALL ON public.mestrados, public.mestrado_especialidades, public.mestrado_versoes,
  public.mestrado_processos, public.mestrado_historico FROM anon, authenticated;
GRANT SELECT ON public.mestrados, public.mestrado_especialidades, public.mestrado_versoes,
  public.mestrado_processos, public.mestrado_historico TO authenticated;

-- ---------------------------------------------------------------------------
-- Ajudantes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mestrado_pode_ver_membro(p_dbv integer)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  -- COALESCE: sem membro vinculado, current_user_dbv_id() e NULL e a expressao nao pode virar "autorizado".
  SELECT COALESCE(
    public.current_user_is_admin_ti()
    OR public.current_user_dbv_id() = p_dbv
    OR public.current_user_is_responsavel_membro(p_dbv)
    OR EXISTS (SELECT 1 FROM public.usuario_clubes uc
               WHERE uc.usuario_id = auth.uid() AND uc.membro_id = p_dbv AND uc.ativo = TRUE)
    OR EXISTS (SELECT 1 FROM public.desbravadores d
               WHERE d.id = p_dbv AND public.fluxo_pode_diretoria(d.clube_id)),
    FALSE)
$$;

CREATE OR REPLACE FUNCTION public.mestrado_historico_add(p_processo uuid, p_evento text, p_detalhes jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO public.mestrado_historico (processo_id, evento, por, detalhes)
  VALUES (p_processo, p_evento, auth.uid(), COALESCE(p_detalhes, '{}'::jsonb))
$$;

-- Especialidades do membro que contam para o mestrado: concluidas e aprovadas (status OK),
-- da lista permitida, uma por nome (sem duplicadas). p_excluir: ids de modelo a desconsiderar.
CREATE OR REPLACE FUNCTION public.mestrado_contagem(p_dbv integer, p_mestrado uuid, p_excluir jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_qtd integer;
  v_contadas jsonb;
  v_total integer;
  v_obrig_ok integer;
  v_obrig_total integer;
BEGIN
  SELECT quantidade_exigida INTO v_qtd FROM public.mestrados WHERE id = p_mestrado;
  IF v_qtd IS NULL THEN
    RETURN jsonb_build_object('contadas', '[]'::jsonb, 'total', 0, 'necessarias', 0, 'obrigatorias_total', 0, 'obrigatorias_ok', 0, 'atende', false);
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome) ORDER BY x.nome), '[]'::jsonb),
         count(*)::integer,
         (count(*) FILTER (WHERE x.obrigatoria))::integer
    INTO v_contadas, v_total, v_obrig_ok
  FROM (
    SELECT DISTINCT ON (public.mestrado_norm(em.nome)) em.id, em.nome, me.obrigatoria
    FROM public.especialidades e
    JOIN public.especialidades_modelo em ON public.mestrado_norm(em.nome) = public.mestrado_norm(e.nome)
    JOIN public.mestrado_especialidades me ON me.especialidade_id = em.id AND me.mestrado_id = p_mestrado
    WHERE e.dbv_id = p_dbv
      AND e.status = 'OK'
      AND NOT (em.id::text IN (SELECT jsonb_array_elements_text(COALESCE(p_excluir, '[]'::jsonb))))
    ORDER BY public.mestrado_norm(em.nome), em.id
  ) x;

  SELECT count(DISTINCT public.mestrado_norm(em.nome))::integer INTO v_obrig_total
  FROM public.mestrado_especialidades me
  JOIN public.especialidades_modelo em ON em.id = me.especialidade_id
  WHERE me.mestrado_id = p_mestrado AND me.obrigatoria;

  RETURN jsonb_build_object(
    'contadas', v_contadas, 'total', v_total, 'necessarias', v_qtd,
    'obrigatorias_total', COALESCE(v_obrig_total, 0), 'obrigatorias_ok', COALESCE(v_obrig_ok, 0),
    'atende', (v_total >= v_qtd AND COALESCE(v_obrig_ok, 0) >= COALESCE(v_obrig_total, 0))
  );
END;
$$;

-- Lista (ordenada) dos ids contados, para comparar conjuntos.
CREATE OR REPLACE FUNCTION public.mestrado_ids(p_contagem jsonb)
RETURNS jsonb
LANGUAGE sql IMMUTABLE
AS $$
  SELECT COALESCE(jsonb_agg(i ORDER BY i), '[]'::jsonb)
  FROM (SELECT elem->>'id' AS i FROM jsonb_array_elements(COALESCE(p_contagem->'contadas', '[]'::jsonb)) elem) t
$$;

-- ---------------------------------------------------------------------------
-- Avaliacao automatica do membro (chamada pelos gatilhos, nunca pelo app)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mestrado_avaliar_membro(p_dbv integer)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_clube integer;
  m public.mestrados%ROWTYPE;
  p public.mestrado_processos%ROWTYPE;
  c jsonb;
  c2 jsonb;
  v_id uuid;
BEGIN
  SELECT clube_id INTO v_clube FROM public.desbravadores WHERE id = p_dbv;
  IF v_clube IS NULL THEN RETURN; END IF;

  -- Operacoes simultaneas do mesmo membro esperam a vez: nunca duas solicitacoes.
  PERFORM pg_advisory_xact_lock(hashtextextended('mestrado:' || p_dbv::text, 0));

  FOR m IN SELECT * FROM public.mestrados WHERE situacao = 'ativo' ORDER BY ordem_exibicao, nome LOOP
    c := public.mestrado_contagem(p_dbv, m.id, '[]'::jsonb);
    SELECT * INTO p FROM public.mestrado_processos WHERE dbv_id = p_dbv AND mestrado_id = m.id FOR UPDATE;

    IF NOT FOUND THEN
      IF (c->>'atende')::boolean THEN
        INSERT INTO public.mestrado_processos
          (clube_id, dbv_id, mestrado_id, codigo, etapa, versao_regra, especialidades_usadas, requisitos_atendidos)
        VALUES
          (v_clube, p_dbv, m.id, m.codigo, 'diretoria', m.versao, c->'contadas',
           c - 'contadas')
        ON CONFLICT (dbv_id, mestrado_id) DO NOTHING
        RETURNING id INTO v_id;
        IF v_id IS NOT NULL THEN
          PERFORM public.mestrado_historico_add(v_id, 'encaminhado',
            jsonb_build_object('versao_regra', m.versao, 'automatico', true));
        END IF;
      END IF;

    ELSIF p.etapa = 'diretoria' THEN
      -- Perdeu requisito enquanto pendente: sinaliza (e a aprovacao fica bloqueada).
      IF (NOT (c->>'atende')::boolean) AND NOT p.alerta_requisitos THEN
        UPDATE public.mestrado_processos SET alerta_requisitos = TRUE, atualizado_em = now() WHERE id = p.id;
        PERFORM public.mestrado_historico_add(p.id, 'sinalizado', jsonb_build_object('motivo', 'requisitos insuficientes', 'contagem', c - 'contadas'));
      ELSIF (c->>'atende')::boolean AND p.alerta_requisitos THEN
        UPDATE public.mestrado_processos
           SET alerta_requisitos = FALSE, especialidades_usadas = c->'contadas', requisitos_atendidos = c - 'contadas', atualizado_em = now()
         WHERE id = p.id;
        PERFORM public.mestrado_historico_add(p.id, 'requisitos_restabelecidos', '{}'::jsonb);
      END IF;

    ELSIF p.etapa = 'devolvido' THEN
      -- Reencaminha sozinho so quando a pendencia foi resolvida: cumpre sem as devolvidas E o conjunto mudou.
      c2 := public.mestrado_contagem(p_dbv, m.id, p.especialidades_devolvidas);
      IF (c2->>'atende')::boolean AND public.mestrado_ids(c2) IS DISTINCT FROM COALESCE(p.conjunto_na_devolucao, '[]'::jsonb) THEN
        UPDATE public.mestrado_processos
           SET etapa = 'diretoria', reenviada = TRUE, alerta_requisitos = FALSE,
               versao_regra = m.versao, especialidades_usadas = c2->'contadas', requisitos_atendidos = c2 - 'contadas',
               encaminhado_em = now(), avisado_em = NULL, atualizado_em = now()
         WHERE id = p.id;
        PERFORM public.mestrado_historico_add(p.id, 'reencaminhado', jsonb_build_object('versao_regra', m.versao, 'automatico', true));
      END IF;
    END IF;
    -- aprovado / investido: conquistado, nunca gera outro processo (preservado).
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.mestrado_trg_especialidade()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_dbv integer;
BEGIN
  IF TG_OP = 'DELETE' THEN v_dbv := OLD.dbv_id; ELSE v_dbv := NEW.dbv_id; END IF;
  BEGIN
    PERFORM public.mestrado_avaliar_membro(v_dbv);
  EXCEPTION WHEN OTHERS THEN
    -- A avaliacao nunca pode impedir o registro da especialidade.
    RAISE WARNING 'mestrado_avaliar_membro falhou: %', SQLERRM;
  END;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mestrado_especialidade ON public.especialidades;
CREATE TRIGGER trg_mestrado_especialidade
AFTER INSERT OR UPDATE OF status OR DELETE ON public.especialidades
FOR EACH ROW EXECUTE FUNCTION public.mestrado_trg_especialidade();

-- Investidura registrada pelo fluxo existente -> o processo passa a "investido".
CREATE OR REPLACE FUNCTION public.mestrado_trg_investidura()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.tipo = 'mestrado' AND NEW.entregue AND NOT COALESCE(OLD.entregue, FALSE) THEN
    UPDATE public.mestrado_processos p
       SET etapa = 'investido', investido_em = COALESCE(NEW.entregue_em, current_date), atualizado_em = now()
      FROM public.mestrados m
     WHERE m.id = p.mestrado_id AND p.dbv_id = NEW.dbv_id AND m.nome = NEW.item_nome AND p.etapa = 'aprovado';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mestrado_investidura ON public.investidura_itens;
CREATE TRIGGER trg_mestrado_investidura
AFTER UPDATE OF entregue ON public.investidura_itens
FOR EACH ROW EXECUTE FUNCTION public.mestrado_trg_investidura();

-- Reavalia quem pode ser afetado por uma regra (ao ativar ou alterar).
CREATE OR REPLACE FUNCTION public.mestrado_reavaliar_todos(p_mestrado uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_dbv integer;
  v_n integer := 0;
BEGIN
  FOR v_dbv IN
    SELECT DISTINCT e.dbv_id
    FROM public.especialidades e
    WHERE e.status = 'OK'
      AND (p_mestrado IS NULL OR EXISTS (
        SELECT 1 FROM public.mestrado_especialidades me
        JOIN public.especialidades_modelo em ON em.id = me.especialidade_id
        WHERE me.mestrado_id = p_mestrado AND public.mestrado_norm(em.nome) = public.mestrado_norm(e.nome)))
    UNION
    SELECT p.dbv_id FROM public.mestrado_processos p
    WHERE p.etapa IN ('diretoria', 'devolvido') AND (p_mestrado IS NULL OR p.mestrado_id = p_mestrado)
  LOOP
    PERFORM public.mestrado_avaliar_membro(v_dbv);
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;

-- ---------------------------------------------------------------------------
-- Gerenciamento das regras: SOMENTE ADMIN TI
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mestrado_validar(p_mestrado uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  m public.mestrados%ROWTYPE;
  v_opcoes integer;
  v_obrig integer;
BEGIN
  SELECT * INTO m FROM public.mestrados WHERE id = p_mestrado;
  IF NOT FOUND THEN RETURN 'Mestrado nao encontrado.'; END IF;
  SELECT count(DISTINCT public.mestrado_norm(em.nome))::integer,
         (count(DISTINCT public.mestrado_norm(em.nome)) FILTER (WHERE me.obrigatoria))::integer
    INTO v_opcoes, v_obrig
  FROM public.mestrado_especialidades me
  JOIN public.especialidades_modelo em ON em.id = me.especialidade_id
  WHERE me.mestrado_id = p_mestrado AND em.ativo = TRUE;
  IF m.quantidade_exigida <= 0 THEN RETURN 'A quantidade exigida deve ser maior que zero.'; END IF;
  IF COALESCE(v_obrig, 0) > m.quantidade_exigida THEN
    RETURN format('Ha %s especialidades obrigatorias, mais que a quantidade exigida (%s).', v_obrig, m.quantidade_exigida);
  END IF;
  IF COALESCE(v_opcoes, 0) < m.quantidade_exigida THEN
    RETURN format('A regra exige %s especialidades, mas a lista tem apenas %s opcoes validas.', m.quantidade_exigida, COALESCE(v_opcoes, 0));
  END IF;
  IF m.imagem_url IS NULL OR btrim(m.imagem_url) = '' THEN
    RETURN 'Falta a imagem do mestrado.';
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.mestrado_salvar(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid := NULLIF(p->>'id', '')::uuid;
  m public.mestrados%ROWTYPE;
  v_novo boolean := FALSE;
  v_situacao_antes text;
  v_tem_processos boolean;
  v_situacao text := COALESCE(NULLIF(p->>'situacao', ''), 'rascunho');
  v_qtd integer := COALESCE(NULLIF(p->>'quantidade_exigida', '')::integer, 7);
  v_areas text[];
  v_ids_antes jsonb;
  v_ids_depois jsonb;
  v_mudou_regra boolean;
  v_erro text;
  v_afetados integer := 0;
  v_snapshot jsonb;
BEGIN
  IF NOT public.current_user_is_admin_ti() THEN
    RAISE EXCEPTION 'Somente o ADMIN TI pode alterar as regras dos mestrados.' USING ERRCODE = '42501';
  END IF;
  IF v_situacao NOT IN ('rascunho', 'ativo', 'inativo') THEN RAISE EXCEPTION 'Situacao invalida.'; END IF;
  IF btrim(COALESCE(p->>'codigo', '')) = '' OR btrim(COALESCE(p->>'nome', '')) = '' THEN
    RAISE EXCEPTION 'Informe o codigo e o nome do mestrado.';
  END IF;
  IF v_qtd <= 0 THEN RAISE EXCEPTION 'A quantidade exigida deve ser maior que zero.'; END IF;
  v_areas := COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p->'areas', '[]'::jsonb))), '{}');

  IF v_id IS NULL THEN
    v_novo := TRUE;
    INSERT INTO public.mestrados (codigo, nome, quantidade_exigida, situacao)
    VALUES (btrim(p->>'codigo'), btrim(p->>'nome'), v_qtd, 'rascunho')
    RETURNING id INTO v_id;
  END IF;

  SELECT * INTO m FROM public.mestrados WHERE id = v_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mestrado nao encontrado.'; END IF;

  v_situacao_antes := m.situacao;
  v_tem_processos := EXISTS (SELECT 1 FROM public.mestrado_processos WHERE mestrado_id = v_id);

  IF m.codigo <> btrim(p->>'codigo') AND v_tem_processos THEN
    RAISE EXCEPTION 'O codigo nao pode mudar: ja existem processos deste mestrado.';
  END IF;

  SELECT COALESCE(jsonb_agg(especialidade_id::text || ':' || obrigatoria::text ORDER BY especialidade_id::text), '[]'::jsonb)
    INTO v_ids_antes FROM public.mestrado_especialidades WHERE mestrado_id = v_id;

  -- Lista de especialidades (por ID, nunca por nome digitado).
  DELETE FROM public.mestrado_especialidades
   WHERE mestrado_id = v_id
     AND especialidade_id::text NOT IN (SELECT e->>'id' FROM jsonb_array_elements(COALESCE(p->'especialidades', '[]'::jsonb)) e);
  INSERT INTO public.mestrado_especialidades (mestrado_id, especialidade_id, obrigatoria, grupo_requisito)
  SELECT v_id, (e->>'id')::uuid, COALESCE((e->>'obrigatoria')::boolean, FALSE), NULLIF(e->>'grupo_requisito', '')
    FROM jsonb_array_elements(COALESCE(p->'especialidades', '[]'::jsonb)) e
    JOIN public.especialidades_modelo em ON em.id = (e->>'id')::uuid
  ON CONFLICT (mestrado_id, especialidade_id)
  DO UPDATE SET obrigatoria = EXCLUDED.obrigatoria, grupo_requisito = EXCLUDED.grupo_requisito;

  SELECT COALESCE(jsonb_agg(especialidade_id::text || ':' || obrigatoria::text ORDER BY especialidade_id::text), '[]'::jsonb)
    INTO v_ids_depois FROM public.mestrado_especialidades WHERE mestrado_id = v_id;

  v_mudou_regra := v_novo OR v_ids_antes IS DISTINCT FROM v_ids_depois OR m.quantidade_exigida <> v_qtd;

  UPDATE public.mestrados SET
    codigo = btrim(p->>'codigo'), nome = btrim(p->>'nome'),
    imagem_url = NULLIF(btrim(COALESCE(p->>'imagem_url', '')), ''),
    areas = v_areas,
    grupo_exibicao = NULLIF(btrim(COALESCE(p->>'grupo_exibicao', '')), ''),
    ordem_exibicao = COALESCE(NULLIF(p->>'ordem_exibicao', '')::integer, 100),
    prioridade_exibicao = COALESCE(NULLIF(p->>'prioridade_exibicao', '')::integer, 100),
    quantidade_exigida = v_qtd,
    fonte = NULLIF(btrim(COALESCE(p->>'fonte', '')), ''),
    edicao = NULLIF(btrim(COALESCE(p->>'edicao', '')), ''),
    observacoes = NULLIF(btrim(COALESCE(p->>'observacoes', '')), ''),
    situacao = 'rascunho',
    atualizado_em = now(), atualizado_por = auth.uid()
  WHERE id = v_id;

  IF v_situacao = 'ativo' THEN
    v_erro := public.mestrado_validar(v_id);
    IF v_erro IS NOT NULL THEN RAISE EXCEPTION 'Nao e possivel ativar: %', v_erro; END IF;
  END IF;

  -- Rascunho nunca ativado muda livremente (continua na versao 1); depois disso cada mudanca de regra e uma nova versao.
  IF v_mudou_regra AND NOT v_novo AND (v_situacao_antes <> 'rascunho' OR v_tem_processos) THEN
    UPDATE public.mestrados SET versao = versao + 1 WHERE id = v_id;
  END IF;

  UPDATE public.mestrados SET situacao = v_situacao WHERE id = v_id;
  SELECT * INTO m FROM public.mestrados WHERE id = v_id;

  -- Nova versao registrada (inclui a primeira) com quem alterou e quando.
  IF v_mudou_regra OR NOT EXISTS (SELECT 1 FROM public.mestrado_versoes WHERE mestrado_id = v_id AND versao = m.versao) THEN
    v_snapshot := jsonb_build_object(
      'codigo', m.codigo, 'nome', m.nome, 'quantidade_exigida', m.quantidade_exigida, 'areas', m.areas,
      'fonte', m.fonte, 'edicao', m.edicao, 'observacoes', m.observacoes, 'situacao', m.situacao,
      'especialidades', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', me.especialidade_id, 'obrigatoria', me.obrigatoria, 'grupo_requisito', me.grupo_requisito)), '[]'::jsonb)
                          FROM public.mestrado_especialidades me WHERE me.mestrado_id = v_id));
    INSERT INTO public.mestrado_versoes (mestrado_id, versao, snapshot, criado_por)
    VALUES (v_id, m.versao, v_snapshot, auth.uid())
    ON CONFLICT (mestrado_id, versao) DO UPDATE SET snapshot = EXCLUDED.snapshot, criado_por = EXCLUDED.criado_por, criado_em = now();
  END IF;

  -- Reavalia os membros afetados (sem duplicar solicitacoes nem tocar em conquistas).
  IF m.situacao = 'ativo' THEN
    v_afetados := public.mestrado_reavaliar_todos(v_id);
  END IF;

  RETURN jsonb_build_object('id', v_id, 'versao', m.versao, 'situacao', m.situacao, 'reavaliados', v_afetados);
END;
$$;

-- ---------------------------------------------------------------------------
-- Diretoria: fila, aprovar, devolver, avisos
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mestrado_fila(p_clube_id integer)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT COALESCE(public.fluxo_pode_diretoria(p_clube_id), FALSE) THEN
    RAISE EXCEPTION 'Sem permissao para ver as aprovacoes de mestrado.' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', p.id, 'dbv_id', p.dbv_id, 'dbv_nome', d.nome, 'unidade_nome', d.unidade_nome,
      'clube_id', p.clube_id, 'etapa', p.etapa,
      'mestrado', jsonb_build_object('id', m.id, 'codigo', m.codigo, 'nome', m.nome, 'imagem_url', m.imagem_url),
      'versao_regra', p.versao_regra, 'encaminhado_em', p.encaminhado_em, 'reenviada', p.reenviada,
      'alerta_requisitos', p.alerta_requisitos, 'motivo', p.motivo,
      'especialidades_usadas', p.especialidades_usadas, 'requisitos_atendidos', p.requisitos_atendidos,
      'historico', COALESCE((SELECT jsonb_agg(jsonb_build_object('evento', h.evento, 'em', h.em, 'por', h.por, 'detalhes', h.detalhes) ORDER BY h.em)
                              FROM public.mestrado_historico h WHERE h.processo_id = p.id), '[]'::jsonb)
    ) ORDER BY p.encaminhado_em)
    FROM public.mestrado_processos p
    JOIN public.mestrados m ON m.id = p.mestrado_id
    JOIN public.desbravadores d ON d.id = p.dbv_id
    WHERE p.clube_id = p_clube_id AND p.etapa IN ('diretoria', 'devolvido')
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.mestrado_aprovar(p_processo uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p public.mestrado_processos%ROWTYPE;
  m public.mestrados%ROWTYPE;
  c jsonb;
  v_nome text;
BEGIN
  SELECT * INTO p FROM public.mestrado_processos WHERE id = p_processo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitacao nao encontrada.'; END IF;
  IF NOT COALESCE(public.fluxo_pode_diretoria(p.clube_id), FALSE) THEN
    RAISE EXCEPTION 'Sem permissao para aprovar.' USING ERRCODE = '42501';
  END IF;
  IF p.etapa <> 'diretoria' THEN RAISE EXCEPTION 'Esta solicitacao nao esta aguardando a diretoria (etapa: %).', p.etapa; END IF;
  SELECT * INTO m FROM public.mestrados WHERE id = p.mestrado_id;

  -- Nunca aprova sem requisitos suficientes agora.
  c := public.mestrado_contagem(p.dbv_id, p.mestrado_id, '[]'::jsonb);
  IF NOT (c->>'atende')::boolean THEN
    UPDATE public.mestrado_processos SET alerta_requisitos = TRUE, atualizado_em = now() WHERE id = p.id;
    RAISE EXCEPTION 'Requisitos insuficientes: alguma especialidade deixou de contar. Confira a solicitacao.';
  END IF;

  UPDATE public.mestrado_processos
     SET etapa = 'aprovado', decidido_por = auth.uid(), decidido_em = now(), alerta_requisitos = FALSE,
         especialidades_usadas = c->'contadas', requisitos_atendidos = c - 'contadas', atualizado_em = now()
   WHERE id = p.id;
  PERFORM public.mestrado_historico_add(p.id, 'aprovado', jsonb_build_object('versao_regra', p.versao_regra));

  -- Fica pronto para a proxima investidura (aguardando agendamento enquanto nao houver evento).
  INSERT INTO public.investidura_itens (clube_id, dbv_id, tipo, item_nome, marcado, entregue, aguardando, aprovado_em, origem)
  VALUES (p.clube_id, p.dbv_id, 'mestrado', m.nome, TRUE, FALSE, TRUE, now(), 'mestrado')
  ON CONFLICT (clube_id, dbv_id, tipo, item_nome) DO NOTHING;

  SELECT nome INTO v_nome FROM public.desbravadores WHERE id = p.dbv_id;
  RETURN jsonb_build_object('avisos', jsonb_build_array(jsonb_build_object(
    'tokens', public.fluxo_tokens(p.clube_id, p.dbv_id, 'membro'),
    'titulo', 'Mestrado aprovado',
    'corpo', 'Parabens! Seu mestrado em ' || m.nome || ' foi aprovado e aguarda a investidura.',
    'dados', jsonb_build_object('tela', 'rota', 'rota', '/')
  )));
END;
$$;

CREATE OR REPLACE FUNCTION public.mestrado_devolver(p_processo uuid, p_motivo text, p_especialidades jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p public.mestrado_processos%ROWTYPE;
  m public.mestrados%ROWTYPE;
  c jsonb;
BEGIN
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN RAISE EXCEPTION 'Informe o motivo da devolucao.'; END IF;
  SELECT * INTO p FROM public.mestrado_processos WHERE id = p_processo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitacao nao encontrada.'; END IF;
  IF NOT COALESCE(public.fluxo_pode_diretoria(p.clube_id), FALSE) THEN
    RAISE EXCEPTION 'Sem permissao para devolver.' USING ERRCODE = '42501';
  END IF;
  IF p.etapa <> 'diretoria' THEN RAISE EXCEPTION 'Esta solicitacao nao esta aguardando a diretoria (etapa: %).', p.etapa; END IF;
  SELECT * INTO m FROM public.mestrados WHERE id = p.mestrado_id;
  c := public.mestrado_contagem(p.dbv_id, p.mestrado_id, '[]'::jsonb);

  -- Mantem o mesmo processo e o historico; so volta a ser encaminhado quando a pendencia for resolvida.
  UPDATE public.mestrado_processos
     SET etapa = 'devolvido', motivo = btrim(p_motivo), decidido_por = auth.uid(), decidido_em = now(),
         especialidades_devolvidas = COALESCE(p_especialidades, '[]'::jsonb),
         conjunto_na_devolucao = public.mestrado_ids(c), atualizado_em = now()
   WHERE id = p.id;
  PERFORM public.mestrado_historico_add(p.id, 'devolvido', jsonb_build_object('motivo', btrim(p_motivo), 'especialidades', COALESCE(p_especialidades, '[]'::jsonb)));

  RETURN jsonb_build_object('avisos', jsonb_build_array(jsonb_build_object(
    'tokens', public.fluxo_tokens(p.clube_id, p.dbv_id, 'membro'),
    'titulo', 'Mestrado devolvido',
    'corpo', 'Seu mestrado em ' || m.nome || ' foi devolvido: ' || btrim(p_motivo),
    'dados', jsonb_build_object('tela', 'rota', 'rota', '/')
  )));
END;
$$;

-- Aviso (push) a diretoria das solicitacoes novas; idempotente via avisado_em.
CREATE OR REPLACE FUNCTION public.mestrado_avisar_diretoria(p_clube_id integer)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r record;
  v_avisos jsonb := '[]'::jsonb;
BEGIN
  IF NOT COALESCE(public.fluxo_pode_diretoria(p_clube_id), FALSE) THEN
    RETURN jsonb_build_object('avisos', '[]'::jsonb);
  END IF;
  FOR r IN
    SELECT p.id, p.dbv_id, p.reenviada, m.nome AS mestrado, d.nome AS membro
    FROM public.mestrado_processos p
    JOIN public.mestrados m ON m.id = p.mestrado_id
    JOIN public.desbravadores d ON d.id = p.dbv_id
    WHERE p.clube_id = p_clube_id AND p.etapa = 'diretoria' AND p.avisado_em IS NULL
    FOR UPDATE OF p SKIP LOCKED
  LOOP
    UPDATE public.mestrado_processos SET avisado_em = now() WHERE id = r.id;
    v_avisos := v_avisos || jsonb_build_array(jsonb_build_object(
      'tokens', public.fluxo_tokens(p_clube_id, r.dbv_id, 'diretoria'),
      'titulo', CASE WHEN r.reenviada THEN 'Mestrado reencaminhado' ELSE 'Mestrado para aprovar' END,
      'corpo', r.membro || ' cumpriu os requisitos do mestrado em ' || r.mestrado || ' e aguarda a sua aprovacao.',
      'dados', jsonb_build_object('tela', 'rota', 'rota', '/admin/aprovacoes')
    ));
  END LOOP;
  RETURN jsonb_build_object('avisos', v_avisos);
END;
$$;

-- ---------------------------------------------------------------------------
-- Faixa: mestrados conquistados (divisorias) e a que bloco pertence cada especialidade
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mestrado_faixa(p_dbv integer)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.mestrado_pode_ver_membro(p_dbv) THEN
    RAISE EXCEPTION 'Sem permissao.' USING ERRCODE = '42501';
  END IF;
  RETURN (
    WITH conquistados AS (
      SELECT m.id, m.codigo, m.nome, m.imagem_url, m.grupo_exibicao, m.ordem_exibicao, m.prioridade_exibicao, p.etapa
      FROM public.mestrado_processos p
      JOIN public.mestrados m ON m.id = p.mestrado_id
      WHERE p.dbv_id = p_dbv AND p.etapa IN ('aprovado', 'investido')
    )
    SELECT jsonb_build_object(
      'mestrados', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'id', c.id, 'codigo', c.codigo, 'nome', c.nome, 'imagem_url', c.imagem_url, 'grupo', c.grupo_exibicao,
          'ordem', c.ordem_exibicao, 'etapa', c.etapa, 'aguardando', (c.etapa = 'aprovado'))
          ORDER BY c.ordem_exibicao, c.nome) FROM conquistados c), '[]'::jsonb),
      -- especialidade (nome normalizado) -> mestrado do bloco; sobreposicao resolvida pela prioridade
      'grupos', COALESCE((SELECT jsonb_object_agg(z.chave, z.mestrado_id) FROM (
          SELECT DISTINCT ON (public.mestrado_norm(em.nome)) public.mestrado_norm(em.nome) AS chave, c.id AS mestrado_id
          FROM public.mestrado_especialidades me
          JOIN conquistados c ON c.id = me.mestrado_id
          JOIN public.especialidades_modelo em ON em.id = me.especialidade_id
          ORDER BY public.mestrado_norm(em.nome), c.prioridade_exibicao, c.ordem_exibicao, c.nome
        ) z), '{}'::jsonb)
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Tom de pele da pessoa ilustrada na faixa
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.faixa_definir_tom_pele(p_dbv integer, p_tom integer)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_clube integer;
BEGIN
  IF p_tom IS NOT NULL AND (p_tom < 1 OR p_tom > 8) THEN RAISE EXCEPTION 'Tom de pele invalido.'; END IF;
  SELECT clube_id INTO v_clube FROM public.desbravadores WHERE id = p_dbv;
  IF v_clube IS NULL THEN RAISE EXCEPTION 'Membro nao encontrado.'; END IF;
  IF NOT COALESCE(
    public.current_user_is_admin_ti()
    OR public.current_user_dbv_id() = p_dbv
    OR public.current_user_is_responsavel_membro(p_dbv)
    OR public.current_user_can_admin_clube(v_clube)
    OR EXISTS (SELECT 1 FROM public.usuario_clubes uc
               WHERE uc.usuario_id = auth.uid() AND uc.membro_id = p_dbv AND uc.ativo = TRUE),
    FALSE
  ) THEN
    RAISE EXCEPTION 'Sem permissao para alterar este perfil.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.desbravadores SET tom_pele = p_tom WHERE id = p_dbv;
END;
$$;

-- ---------------------------------------------------------------------------
-- Permissoes de execucao
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.mestrado_contagem(integer, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mestrado_avaliar_membro(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mestrado_reavaliar_todos(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mestrado_historico_add(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mestrado_trg_especialidade() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mestrado_trg_investidura() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mestrado_salvar(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mestrado_validar(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mestrado_fila(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mestrado_aprovar(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mestrado_devolver(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mestrado_avisar_diretoria(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mestrado_faixa(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.faixa_definir_tom_pele(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mestrado_pode_ver_membro(integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- Configuracao inicial (RASCUNHO): so vira ativa quando o ADMIN TI conferir a lista e ativar.
-- Fonte: catalogos atualizados; AINDA PRECISA ser comparada com o manual completo de 2025.
-- ---------------------------------------------------------------------------
INSERT INTO public.mestrados (codigo, nome, areas, grupo_exibicao, ordem_exibicao, prioridade_exibicao, quantidade_exigida, fonte, edicao, observacoes, situacao)
VALUES
  ('ME-001', 'ADRA',                        ARRAY['ADRA'],                                 'ADRA',                        10,  10,  7,  'Catalogos atualizados', 'A conferir com o manual de 2025', '7 especialidades da area ADRA.', 'rascunho'),
  ('ME-002', 'Artes e Habilidades Manuais', ARRAY['Artes e Habilidades Manuais'],         'Artes e Habilidades Manuais', 20,  20,  7,  'Catalogos atualizados', 'A conferir com o manual de 2025', '7 especialidades dessa area.', 'rascunho'),
  ('ME-003', 'Atividades Agrícolas',        ARRAY['Atividades Agrícolas', 'Atividades Agrícolas e Afins'], 'Atividades Agrícolas',        30,  30,  7,  'Catalogos atualizados', 'A conferir com o manual de 2025', '7 especialidades de Atividades Agricolas e Afins.', 'rascunho'),
  ('ME-004', 'Testificação',                ARRAY[]::text[],                              'Testificação',                40,  40,  7,  'Catalogos atualizados', 'A conferir com o manual de 2025', '7 da lista permitida: lista a conferir.', 'rascunho'),
  ('ME-005', 'Atividades Profissionais',    ARRAY[]::text[],                              'Atividades Profissionais',    50,  50,  7,  'Catalogos atualizados', 'A conferir com o manual de 2025', '7 da lista permitida: lista a conferir.', 'rascunho'),
  ('ME-006', 'Ciência e Tecnologia',        ARRAY[]::text[],                              'Ciência e Tecnologia',        60,  60,  7,  'Catalogos atualizados', 'A conferir com o manual de 2025', '7 da lista permitida: lista a conferir.', 'rascunho'),
  ('ME-007', 'Aquática',                    ARRAY[]::text[],                              'Aquática',                    70,  70,  7,  'Catalogos atualizados', 'A conferir com o manual de 2025', '7 da lista permitida: lista a conferir.', 'rascunho'),
  ('ME-008', 'Esportes',                    ARRAY[]::text[],                              'Esportes',                    80,  80,  7,  'Catalogos atualizados', 'A conferir com o manual de 2025', '7 da lista permitida: lista a conferir.', 'rascunho'),
  ('ME-009', 'Vida Campestre',              ARRAY[]::text[],                              'Vida Campestre',              90,  90,  7,  'Catalogos atualizados', 'A conferir com o manual de 2025', '7 da lista permitida: lista a conferir.', 'rascunho'),
  ('ME-010', 'Atividades Recreativas',      ARRAY[]::text[],                              'Atividades Recreativas',      100, 100, 7,  'Catalogos atualizados', 'A conferir com o manual de 2025', '7 da lista permitida: lista a conferir.', 'rascunho'),
  ('ME-011', 'Saúde',                       ARRAY[]::text[],                              'Saúde',                       110, 110, 7,  'Catalogos atualizados', 'A conferir com o manual de 2025', '7 da lista permitida: lista a conferir.', 'rascunho'),
  ('ME-012', 'Zoologia',                    ARRAY[]::text[],                              'Zoologia',                    120, 120, 7,  'Catalogos atualizados', 'A conferir com o manual de 2025', '7 da lista permitida: lista a conferir.', 'rascunho'),
  ('ME-013', 'Ecologia',                    ARRAY[]::text[],                              'Ecologia',                    130, 130, 7,  'Catalogos atualizados', 'A conferir com o manual de 2025', '7 da lista permitida: lista a conferir.', 'rascunho'),
  ('ME-014', 'Botânica',                    ARRAY[]::text[],                              'Botânica',                    140, 140, 7,  'Catalogos atualizados', 'A conferir com o manual de 2025', '7 da lista permitida: lista a conferir.', 'rascunho'),
  ('ME-015', 'Habilidades Domésticas',      ARRAY['Habilidades Domésticas'],              'Habilidades Domésticas',      150, 150, 7,  'Catalogos atualizados', 'A conferir com o manual de 2025', '7 especialidades dessa area.', 'rascunho'),
  ('ME-016', 'Ensinos Bíblicos',            ARRAY[]::text[],                              'Ensinos Bíblicos',            160, 160, 14, 'Catalogos atualizados', 'A conferir com o manual de 2025', '14 especialidades dessa area: area a conferir.', 'rascunho')
ON CONFLICT (codigo) DO NOTHING;

-- Para os que a regra e "da area", pre-seleciona as especialidades da area no catalogo de Desbravadores
-- (ainda em rascunho: o ADMIN TI revisa a lista antes de ativar). Nao inclui os proprios mestrados.
INSERT INTO public.mestrado_especialidades (mestrado_id, especialidade_id)
SELECT m.id, em.id
FROM public.mestrados m
JOIN public.especialidades_modelo em
  ON em.ativo = TRUE
 AND em.programa_id = (SELECT id FROM public.programas WHERE nome ILIKE '%desbravador%' ORDER BY id LIMIT 1)
 AND public.mestrado_norm(em.categoria) LIKE public.mestrado_norm(m.areas[1]) || '%'
 AND public.mestrado_norm(em.nome) NOT LIKE 'mestr%'
WHERE m.codigo IN ('ME-001', 'ME-002', 'ME-003', 'ME-015')
  AND array_length(m.areas, 1) >= 1
ON CONFLICT DO NOTHING;
