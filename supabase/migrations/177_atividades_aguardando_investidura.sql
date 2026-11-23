BEGIN;

CREATE FUNCTION public.registrar_investidura_por_atividade(p_atividade bigint, p_membro integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  atividade public.atividades%ROWTYPE;
  v_nome text;
  campo_classe text;
  necessarias integer;
  aprovadas integer;
  clube integer;
BEGIN
  SELECT a.* INTO atividade FROM public.atividades a WHERE a.id = p_atividade;
  IF NOT FOUND OR atividade.clube_id IS NULL OR atividade.gera_investidura IS DISTINCT FROM TRUE
    OR atividade.criado_por IS NOT DISTINCT FROM '__sistema_classes__'
    OR atividade.classe_requisito_id IS NOT NULL
    OR atividade.item_formativo_tipo IS NULL OR atividade.item_formativo_tipo NOT IN ('classe', 'especialidade')
    OR nullif(btrim(atividade.item_formativo_nome), '') IS NULL THEN
    RETURN;
  END IF;
  clube := atividade.clube_id;
  IF NOT EXISTS (SELECT 1 FROM public.desbravadores d WHERE d.id = p_membro AND d.clube_id = clube) THEN
    RETURN;
  END IF;
  -- Serializa as aprovações do membro quando o plano tem várias atividades.
  PERFORM pg_advisory_xact_lock(hashtext('investidura_por_atividade'), p_membro);

  IF atividade.plano_formativo_id IS NULL THEN
    necessarias := 1;
  ELSE
    SELECT p.avaliacoes_necessarias INTO necessarias FROM public.planos_formativos p
    WHERE p.id = atividade.plano_formativo_id AND p.clube_id = clube;
    IF necessarias IS NULL OR necessarias < 1 THEN RETURN; END IF;
  END IF;
  SELECT count(DISTINCT r.atividade_id) INTO aprovadas
  FROM public.atividades_respostas r
  JOIN public.atividades a ON a.id = r.atividade_id AND a.clube_id = r.clube_id
  WHERE r.clube_id = clube AND r.dbv_id = p_membro AND r.status = 'aprovada'
    AND a.gera_investidura IS TRUE AND a.classe_requisito_id IS NULL
    AND a.criado_por IS DISTINCT FROM '__sistema_classes__'
    AND a.item_formativo_tipo = atividade.item_formativo_tipo
    AND public.mestrado_norm(a.item_formativo_nome) = public.mestrado_norm(atividade.item_formativo_nome)
    AND CASE WHEN atividade.plano_formativo_id IS NULL THEN a.id = atividade.id
      ELSE a.plano_formativo_id = atividade.plano_formativo_id END;
  IF aprovadas < necessarias THEN RETURN; END IF;

  v_nome := btrim(regexp_replace(atividade.item_formativo_nome, '\s+', ' ', 'g'));
  IF atividade.item_formativo_tipo = 'classe' THEN
    campo_classe := public.investidura_campo_classe(v_nome);
    IF campo_classe IS NULL THEN RETURN; END IF;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.investidura_itens i
    WHERE i.clube_id = clube AND i.dbv_id = p_membro AND i.tipo = atividade.item_formativo_tipo
      AND CASE WHEN campo_classe IS NOT NULL THEN public.investidura_campo_classe(i.item_nome) = campo_classe
        ELSE public.mestrado_norm(i.item_nome) = public.mestrado_norm(v_nome) END
      AND (i.aguardando OR i.entregue)
  ) THEN RETURN; END IF;

  IF campo_classe IS NULL THEN
    -- Status OK anterior sem pendência é tratado como recebido no legado.
    IF EXISTS (
      SELECT 1 FROM public.especialidades e WHERE e.clube_id = clube AND e.dbv_id = p_membro
        AND public.mestrado_norm(e.nome) = public.mestrado_norm(v_nome) AND e.status = 'OK'
    ) THEN RETURN; END IF;
    SELECT coalesce((
      SELECT e.nome FROM public.especialidades e WHERE e.clube_id = clube AND e.dbv_id = p_membro
        AND public.mestrado_norm(e.nome) = public.mestrado_norm(v_nome)
      ORDER BY (e.nome = v_nome) DESC, e.id LIMIT 1
    ), v_nome) INTO v_nome;
    INSERT INTO public.especialidades
      (clube_id, dbv_id, nome, status, atividade_origem_id, plano_formativo_id, atividade_origem_titulo)
    VALUES (clube, p_membro, v_nome, 'OK', atividade.id, atividade.plano_formativo_id, atividade.titulo)
    ON CONFLICT (dbv_id, nome) DO UPDATE SET
      status = 'OK', atividade_origem_id = EXCLUDED.atividade_origem_id,
      plano_formativo_id = EXCLUDED.plano_formativo_id, atividade_origem_titulo = EXCLUDED.atividade_origem_titulo,
      atividade_origem_excluida = FALSE, atividade_origem_excluida_em = NULL, updated_at = now();
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.progresso_classes c WHERE c.clube_id = clube AND c.dbv_id = p_membro
        AND to_jsonb(c) ->> campo_classe = 'OK'
    ) OR EXISTS (
      SELECT 1 FROM public.classe_aprovacoes c WHERE c.clube_id = clube AND c.dbv_id = p_membro
        AND public.investidura_campo_classe(c.item_nome) = campo_classe
    ) THEN RETURN; END IF;
    EXECUTE format(
      'INSERT INTO public.progresso_classes (clube_id, dbv_id, %1$I) VALUES ($1, $2, ''OK'')
       ON CONFLICT (dbv_id) DO UPDATE SET %1$I = ''OK'', updated_at = now()',
      campo_classe
    ) USING clube, p_membro;
  END IF;

  INSERT INTO public.investidura_itens
    (clube_id, dbv_id, tipo, item_nome, atividade_id, plano_formativo_id, aguardando, entregue, marcado, aprovado_em, origem)
  VALUES (clube, p_membro, atividade.item_formativo_tipo, v_nome, atividade.id, atividade.plano_formativo_id,
    TRUE, FALSE, FALSE, now(), CASE WHEN campo_classe IS NULL THEN 'atividade' ELSE 'classe' END)
  ON CONFLICT (clube_id, dbv_id, tipo, item_nome) DO UPDATE SET
    atividade_id = EXCLUDED.atividade_id, plano_formativo_id = EXCLUDED.plano_formativo_id,
    aguardando = TRUE, marcado = FALSE, aprovado_em = now(), origem = EXCLUDED.origem, updated_at = now()
  WHERE public.investidura_itens.entregue IS NOT TRUE AND public.investidura_itens.aguardando IS NOT TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_investidura_por_atividade(bigint, integer) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.atividade_aprovada_registrar_investidura() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  PERFORM public.registrar_investidura_por_atividade(NEW.atividade_id, NEW.dbv_id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_atividade_aprovada_investidura
AFTER INSERT OR UPDATE OF status ON public.atividades_respostas
FOR EACH ROW WHEN (NEW.status = 'aprovada')
EXECUTE FUNCTION public.atividade_aprovada_registrar_investidura();

-- Materializa aprovações existentes que ainda têm evidência no banco.
DO $$
DECLARE
  resposta record;
BEGIN
  FOR resposta IN
    SELECT DISTINCT r.dbv_id, r.atividade_id
    FROM public.atividades_respostas r
    JOIN public.atividades a ON a.id = r.atividade_id AND a.clube_id = r.clube_id
    WHERE r.status = 'aprovada' AND a.gera_investidura IS TRUE
      AND a.criado_por IS DISTINCT FROM '__sistema_classes__' AND a.classe_requisito_id IS NULL
      AND a.item_formativo_tipo IN ('classe', 'especialidade')
    ORDER BY r.dbv_id, r.atividade_id
  LOOP
    PERFORM public.registrar_investidura_por_atividade(resposta.atividade_id, resposta.dbv_id);
  END LOOP;
END;
$$;

COMMIT;
