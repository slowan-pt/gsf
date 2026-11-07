-- 154_patrimonio.sql
-- Módulo Patrimônio (inventário de bens do clube), para a diretoria.
-- Permissão: grupo `gerenciar_patrimonio` com as ações ver, cadastrar, editar, aprovar e baixar
-- (editáveis em Modelos -> Permissões). Valem também no banco, via patrimonio_tem_acao().
-- Requer a migration 149 (perfil_tem_acao).

-- Perfis que têm o módulo "de fábrica" (perfil sem nenhuma linha em perfil_permissoes), espelhando a matriz do app.
-- Perfil já personalizado em Permissões só tem o que estiver marcado ali.
CREATE OR REPLACE FUNCTION public.patrimonio_tem_acao(target_clube_id integer, acao text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.perfil_tem_acao(target_clube_id, 'gerenciar_patrimonio', acao)
  OR EXISTS (
    SELECT 1
    FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid()
      AND uc.clube_id = target_clube_id
      AND uc.ativo = TRUE
      AND uc.perfil IN ('admin_clube', 'admin_geral', 'usuario_diretoria', 'admin_diretoria')
      AND NOT EXISTS (SELECT 1 FROM public.perfil_permissoes pp WHERE pp.perfil = uc.perfil)
  )
$$;

GRANT EXECUTE ON FUNCTION public.patrimonio_tem_acao(integer, text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.patrimonio_itens (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clube_id INTEGER NOT NULL REFERENCES public.clubes(id) ON DELETE CASCADE,
  -- Número sequencial dentro do clube (o "Código" da tela), definido pelo gatilho abaixo.
  codigo INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'baixado')),
  descricao TEXT NOT NULL CHECK (length(btrim(descricao)) > 0 AND length(descricao) <= 200),
  departamento TEXT,
  serie TEXT,
  quantidade INTEGER NOT NULL DEFAULT 1 CHECK (quantidade >= 1),
  tipo TEXT,
  marca TEXT,
  modelo TEXT,
  condicao TEXT CHECK (condicao IS NULL OR condicao IN ('novo', 'bom', 'regular', 'ruim', 'inservivel')),
  fixada_parede BOOLEAN NOT NULL DEFAULT false,
  segurar BOOLEAN NOT NULL DEFAULT false,
  data_aquisicao DATE,
  valor_aquisicao NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (valor_aquisicao >= 0),
  valor_mercado NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (valor_mercado >= 0),
  data_baixa DATE,
  motivo_baixa TEXT,
  foto_url TEXT,
  criado_por UUID DEFAULT auth.uid(),
  aprovado_por UUID,
  aprovado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clube_id, codigo)
);

CREATE INDEX IF NOT EXISTS patrimonio_itens_clube_status_idx ON public.patrimonio_itens (clube_id, status, codigo);

-- Código sequencial por clube, sem repetir mesmo com dois cadastros ao mesmo tempo.
CREATE OR REPLACE FUNCTION public.patrimonio_itens_antes_de_gravar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM pg_advisory_xact_lock(hashtext('patrimonio_codigo_' || NEW.clube_id::text));
    SELECT COALESCE(MAX(codigo), 0) + 1 INTO NEW.codigo FROM public.patrimonio_itens WHERE clube_id = NEW.clube_id;
    NEW.status := 'pendente';
    NEW.aprovado_por := NULL;
    NEW.aprovado_em := NULL;
    NEW.data_baixa := NULL;
    NEW.criado_por := auth.uid();
    RETURN NEW;
  END IF;

  -- UPDATE: o código e o clube nunca mudam; mudar o status exige a ação própria.
  NEW.codigo := OLD.codigo;
  NEW.clube_id := OLD.clube_id;
  NEW.updated_at := now();
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'baixado' THEN
      IF NOT public.patrimonio_tem_acao(OLD.clube_id, 'baixar') THEN
        RAISE EXCEPTION 'Sem permissão para dar baixa em itens do patrimônio.' USING ERRCODE = '42501';
      END IF;
      NEW.data_baixa := COALESCE(NEW.data_baixa, CURRENT_DATE);
    ELSE
      IF NOT public.patrimonio_tem_acao(OLD.clube_id, 'aprovar') THEN
        RAISE EXCEPTION 'Sem permissão para aprovar itens do patrimônio.' USING ERRCODE = '42501';
      END IF;
      IF NEW.status = 'aprovado' THEN
        NEW.aprovado_por := auth.uid();
        NEW.aprovado_em := now();
      ELSE
        NEW.aprovado_por := NULL;
        NEW.aprovado_em := NULL;
      END IF;
      NEW.data_baixa := NULL;
      NEW.motivo_baixa := NULL;
    END IF;
  ELSE
    -- Sem mudar de status, estas colunas só o gatilho mexe.
    NEW.aprovado_por := OLD.aprovado_por;
    NEW.aprovado_em := OLD.aprovado_em;
    NEW.criado_por := OLD.criado_por;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS patrimonio_itens_antes ON public.patrimonio_itens;
CREATE TRIGGER patrimonio_itens_antes
  BEFORE INSERT OR UPDATE ON public.patrimonio_itens
  FOR EACH ROW EXECUTE FUNCTION public.patrimonio_itens_antes_de_gravar();

ALTER TABLE public.patrimonio_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patrimonio_select" ON public.patrimonio_itens;
CREATE POLICY "patrimonio_select" ON public.patrimonio_itens
  FOR SELECT TO authenticated
  USING (public.patrimonio_tem_acao(clube_id, 'ver'));

DROP POLICY IF EXISTS "patrimonio_insert" ON public.patrimonio_itens;
CREATE POLICY "patrimonio_insert" ON public.patrimonio_itens
  FOR INSERT TO authenticated
  WITH CHECK (public.patrimonio_tem_acao(clube_id, 'cadastrar'));

DROP POLICY IF EXISTS "patrimonio_update" ON public.patrimonio_itens;
CREATE POLICY "patrimonio_update" ON public.patrimonio_itens
  FOR UPDATE TO authenticated
  USING (public.patrimonio_tem_acao(clube_id, 'editar')
         OR public.patrimonio_tem_acao(clube_id, 'aprovar')
         OR public.patrimonio_tem_acao(clube_id, 'baixar'))
  WITH CHECK (public.patrimonio_tem_acao(clube_id, 'editar')
         OR public.patrimonio_tem_acao(clube_id, 'aprovar')
         OR public.patrimonio_tem_acao(clube_id, 'baixar'));

-- Sem política de DELETE: item que saiu do patrimônio recebe baixa, não é apagado.
GRANT SELECT, INSERT, UPDATE ON public.patrimonio_itens TO authenticated;
