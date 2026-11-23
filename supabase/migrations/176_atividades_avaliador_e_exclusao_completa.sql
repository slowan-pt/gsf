BEGIN;

CREATE FUNCTION public.pode_avaliar_entrega_atividade(p_atividade bigint, p_clube integer, p_membro integer)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.atividades a
    WHERE a.id = p_atividade AND a.clube_id = p_clube AND a.avaliador_id = auth.uid()
      AND p_membro IS DISTINCT FROM public.current_user_dbv_id()
      AND NOT EXISTS (
        SELECT 1 FROM public.usuario_clubes u
        WHERE u.usuario_id = auth.uid() AND u.clube_id = p_clube AND u.membro_id = p_membro AND u.ativo
      )
      AND NOT public.current_user_is_responsavel_membro(p_membro)
  );
$$;
REVOKE ALL ON FUNCTION public.pode_avaliar_entrega_atividade(bigint, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_avaliar_entrega_atividade(bigint, integer, integer) TO authenticated;

CREATE POLICY atividades_entrega_avaliador_leitura ON public.atividades_respostas
FOR SELECT TO authenticated USING (public.pode_avaliar_entrega_atividade(atividade_id, clube_id, dbv_id));
CREATE POLICY atividades_entrega_avaliador_edicao ON public.atividades_respostas
FOR UPDATE TO authenticated USING (public.pode_avaliar_entrega_atividade(atividade_id, clube_id, dbv_id))
WITH CHECK (public.pode_avaliar_entrega_atividade(atividade_id, clube_id, dbv_id));
CREATE POLICY atividades_historico_avaliador_leitura ON public.atividades_mensagens
FOR SELECT TO authenticated USING (public.pode_avaliar_entrega_atividade(atividade_id, clube_id, dbv_id));
CREATE POLICY atividades_historico_avaliador_envio ON public.atividades_mensagens
FOR INSERT TO authenticated WITH CHECK (public.pode_avaliar_entrega_atividade(atividade_id, clube_id, dbv_id));
CREATE POLICY atividades_historico_autor_real ON public.atividades_mensagens AS RESTRICTIVE
FOR INSERT TO authenticated WITH CHECK (
  autor_id = auth.uid() AND (
    (autor_tipo = 'membro' AND tipo = 'resposta' AND status = 'entregue' AND nota IS NULL)
    OR (autor_tipo = 'avaliador' AND public.pode_avaliar_entrega_atividade(atividade_id, clube_id, dbv_id))
  )
);

CREATE FUNCTION public.proteger_avaliacao_atividade() RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  -- Rotinas internas privilegiadas mantêm o fluxo automático legado de Classes.
  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.atividade_id, NEW.clube_id, NEW.dbv_id) IS DISTINCT FROM (OLD.atividade_id, OLD.clube_id, OLD.dbv_id) THEN
      RAISE EXCEPTION 'A atividade e o autor da entrega não podem ser alterados.' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF NEW.status IN ('aprovada', 'em_correcao', 'recusada') THEN
    IF NOT public.pode_avaliar_entrega_atividade(NEW.atividade_id, NEW.clube_id, NEW.dbv_id)
      OR (NEW.avaliado_por IS NOT NULL AND NEW.avaliado_por IS DISTINCT FROM auth.uid()) THEN
      RAISE EXCEPTION 'Somente o avaliador indicado pode avaliar esta entrega.' USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.status = 'entregue' AND NEW.nota IS NULL AND NEW.avaliado_por IS NULL
    AND NEW.avaliado_em IS NULL AND NEW.reaberto_ate IS NULL THEN
    IF TG_OP = 'INSERT' THEN
      NEW.comentario_avaliador := NULL;
    ELSE
      IF OLD.status = 'aprovada' THEN
        RAISE EXCEPTION 'A entrega aprovada precisa ser reaberta pelo avaliador.' USING ERRCODE = '42501';
      END IF;
      NEW.comentario_avaliador := OLD.comentario_avaliador;
    END IF;
  ELSE
    RAISE EXCEPTION 'Estado de entrega inválido.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_proteger_avaliacao_atividade BEFORE INSERT OR UPDATE ON public.atividades_respostas
FOR EACH ROW EXECUTE FUNCTION public.proteger_avaliacao_atividade();

CREATE OR REPLACE FUNCTION public.validar_prazo_resposta_atividade() RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  prazo date;
  estado_anterior text;
BEGIN
  IF NEW.status <> 'entregue' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    estado_anterior := OLD.status;
    prazo := OLD.reaberto_ate::date;
  ELSE
    -- Clientes antigos enviam INSERT ... ON CONFLICT DO UPDATE no reenvio.
    SELECT r.status, r.reaberto_ate::date INTO estado_anterior, prazo
    FROM public.atividades_respostas r
    WHERE r.atividade_id = NEW.atividade_id AND r.dbv_id = NEW.dbv_id AND r.clube_id = NEW.clube_id;
  END IF;
  IF estado_anterior IS NULL OR estado_anterior NOT IN ('em_correcao', 'recusada') THEN
    SELECT a.data::date INTO prazo FROM public.atividades a WHERE a.id = NEW.atividade_id;
  END IF;
  IF prazo IS NOT NULL AND (now() AT TIME ZONE 'America/Sao_Paulo')::date > prazo THEN
    RAISE EXCEPTION 'O prazo desta entrega encerrou em %.', to_char(prazo, 'DD/MM/YYYY');
  END IF;
  RETURN NEW;
END;
$$;

-- Guarda os arquivos antes que a cascata apague suas referências. A fila
-- sobrevive a falhas de rede e é retomada na abertura do módulo.
CREATE TABLE public.atividades_arquivos_a_remover (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clube_id integer NOT NULL,
  url text NOT NULL,
  UNIQUE (clube_id, url)
);
ALTER TABLE public.atividades_arquivos_a_remover ENABLE ROW LEVEL SECURITY;
GRANT SELECT, DELETE ON public.atividades_arquivos_a_remover TO authenticated;
CREATE POLICY atividades_limpeza_ler ON public.atividades_arquivos_a_remover FOR SELECT TO authenticated
USING (public.current_user_can_change_atividade(clube_id));
CREATE POLICY atividades_limpeza_concluir ON public.atividades_arquivos_a_remover FOR DELETE TO authenticated
USING (public.current_user_can_change_atividade(clube_id));

-- O Storage exige SELECT e DELETE para remover objetos pela API.
CREATE POLICY atividades_limpeza_storage_leitura ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'atividades' AND EXISTS (
  SELECT 1 FROM public.atividades_arquivos_a_remover f
  WHERE right(split_part(f.url, '?', 1), length(name) + 12) = '/atividades/' || name
));
CREATE POLICY atividades_limpeza_storage_excluir ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'atividades' AND EXISTS (
  SELECT 1 FROM public.atividades_arquivos_a_remover f
  WHERE right(split_part(f.url, '?', 1), length(name) + 12) = '/atividades/' || name
));

CREATE FUNCTION public.enfileirar_arquivos_atividade_excluida() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.atividades_arquivos_a_remover (clube_id, url)
  SELECT OLD.clube_id, f.url
  FROM (
    SELECT a.url FROM public.atividades_anexos a WHERE a.atividade_id = OLD.id
    UNION SELECT r.anexo_url FROM public.atividades_respostas r WHERE r.atividade_id = OLD.id
    UNION SELECT m.anexo_url FROM public.atividades_mensagens m WHERE m.atividade_id = OLD.id
  ) f
  WHERE f.url LIKE '%/atividades/%'
    AND NOT EXISTS (SELECT 1 FROM public.atividades_anexos a WHERE a.url = f.url AND a.atividade_id <> OLD.id)
    AND NOT EXISTS (SELECT 1 FROM public.atividades_respostas r WHERE r.anexo_url = f.url AND r.atividade_id <> OLD.id)
    AND NOT EXISTS (SELECT 1 FROM public.atividades_mensagens m WHERE m.anexo_url = f.url AND m.atividade_id <> OLD.id)
  ON CONFLICT (clube_id, url) DO NOTHING;
  UPDATE public.especialidades SET atividade_origem_excluida = TRUE,
    atividade_origem_excluida_em = now(), atividade_origem_titulo = OLD.titulo
  WHERE clube_id = OLD.clube_id AND atividade_origem_id = OLD.id;
  RETURN OLD;
END;
$$;
CREATE TRIGGER trg_atividade_enfileirar_arquivos BEFORE DELETE ON public.atividades
FOR EACH ROW WHEN (OLD.clube_id IS NOT NULL) EXECUTE FUNCTION public.enfileirar_arquivos_atividade_excluida();

NOTIFY pgrst, 'reload schema';
COMMIT;
