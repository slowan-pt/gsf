-- 157_patrimonio_ativo_e_local.sql
-- Patrimônio: o item não passa mais por aprovação. Só há dois status: "ativo" e "baixado".
-- Também ganha o campo "local_fixacao" (sala/local e andar do item fixado na parede).
-- Requer a migration 154. Pode ser rodada mais de uma vez.

-- 1) Local do item fixado na parede.
ALTER TABLE public.patrimonio_itens
  ADD COLUMN IF NOT EXISTS local_fixacao TEXT;

ALTER TABLE public.patrimonio_itens
  DROP CONSTRAINT IF EXISTS patrimonio_itens_local_fixacao_check;
ALTER TABLE public.patrimonio_itens
  ADD CONSTRAINT patrimonio_itens_local_fixacao_check CHECK (local_fixacao IS NULL OR length(local_fixacao) <= 120);

-- 2) Gatilho novo (sem aprovação). O código continua sequencial por clube e automático.
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
    NEW.status := 'ativo';
    NEW.aprovado_por := NULL;
    NEW.aprovado_em := NULL;
    NEW.data_baixa := NULL;
    NEW.motivo_baixa := NULL;
    NEW.criado_por := auth.uid();
    IF NOT NEW.fixada_parede THEN NEW.local_fixacao := NULL; END IF;
    NEW.local_fixacao := NULLIF(btrim(COALESCE(NEW.local_fixacao, '')), '');
    RETURN NEW;
  END IF;

  -- UPDATE: o código e o clube nunca mudam; dar baixa exige a ação própria.
  NEW.codigo := OLD.codigo;
  NEW.clube_id := OLD.clube_id;
  NEW.updated_at := now();
  NEW.criado_por := OLD.criado_por;
  NEW.aprovado_por := OLD.aprovado_por;
  NEW.aprovado_em := OLD.aprovado_em;
  IF NOT NEW.fixada_parede THEN NEW.local_fixacao := NULL; END IF;
  NEW.local_fixacao := NULLIF(btrim(COALESCE(NEW.local_fixacao, '')), '');

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'baixado' THEN
      IF NOT public.patrimonio_tem_acao(OLD.clube_id, 'baixar') THEN
        RAISE EXCEPTION 'Sem permissão para dar baixa em itens do patrimônio.' USING ERRCODE = '42501';
      END IF;
      NEW.data_baixa := COALESCE(NEW.data_baixa, CURRENT_DATE);
    ELSE
      -- Voltar a "ativo" (desfazer uma baixa) é uma edição do item.
      IF NOT public.patrimonio_tem_acao(OLD.clube_id, 'editar') THEN
        RAISE EXCEPTION 'Sem permissão para reativar itens do patrimônio.' USING ERRCODE = '42501';
      END IF;
      NEW.status := 'ativo';
      NEW.data_baixa := NULL;
      NEW.motivo_baixa := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3) Itens que estavam pendentes ou aprovados passam a "ativo" (sem disparar o gatilho).
ALTER TABLE public.patrimonio_itens DROP CONSTRAINT IF EXISTS patrimonio_itens_status_check;
ALTER TABLE public.patrimonio_itens DISABLE TRIGGER patrimonio_itens_antes;
UPDATE public.patrimonio_itens SET status = 'ativo' WHERE status IN ('pendente', 'aprovado');
ALTER TABLE public.patrimonio_itens ENABLE TRIGGER patrimonio_itens_antes;
ALTER TABLE public.patrimonio_itens
  ADD CONSTRAINT patrimonio_itens_status_check CHECK (status IN ('ativo', 'baixado'));
ALTER TABLE public.patrimonio_itens ALTER COLUMN status SET DEFAULT 'ativo';

-- 4) Atualizar o item agora só depende de "editar" ou "baixar" (a ação "aprovar" deixou de existir).
DROP POLICY IF EXISTS "patrimonio_update" ON public.patrimonio_itens;
CREATE POLICY "patrimonio_update" ON public.patrimonio_itens
  FOR UPDATE TO authenticated
  USING (public.patrimonio_tem_acao(clube_id, 'editar') OR public.patrimonio_tem_acao(clube_id, 'baixar'))
  WITH CHECK (public.patrimonio_tem_acao(clube_id, 'editar') OR public.patrimonio_tem_acao(clube_id, 'baixar'));
