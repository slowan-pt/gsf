BEGIN;

CREATE FUNCTION public.perfil_juvenil_por_nascimento(p_nascimento date, p_clube integer)
RETURNS text LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT CASE WHEN p_nascimento <= (now() AT TIME ZONE 'America/Sao_Paulo')::date
    AND p_nascimento > ((now() AT TIME ZONE 'America/Sao_Paulo')::date - interval '16 years')::date
    THEN CASE WHEN c.programa_id = 2 THEN 'usuario_aventureiro' ELSE 'usuario_desbravador' END
  END
  FROM public.clubes c WHERE c.id = p_clube;
$$;

-- Mantém a proteção da migração 130 e permite a redução automática de acesso
-- no gatilho da ficha, mesmo quando quem corrige a data não gerencia logins.
CREATE OR REPLACE FUNCTION public.usuarios_protege_perfil()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.current_user_is_admin_ti() THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.perfil, '') IN ('admin_ti', 'admin_total', 'admin_geral') THEN
      RAISE EXCEPTION 'Somente o Admin TI cria contas de plataforma.' USING ERRCODE = '42501';
    END IF;
    IF NEW.id = auth.uid() AND (NEW.dbv_id IS NOT NULL OR NEW.unidade_id IS NOT NULL) THEN
      RAISE EXCEPTION 'O vínculo com o membro é definido pela administração do clube.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF pg_trigger_depth() > 1 AND NEW.perfil IN ('usuario_desbravador', 'usuario_aventureiro')
    AND (to_jsonb(NEW) - ARRAY['perfil','updated_at']) = (to_jsonb(OLD) - ARRAY['perfil','updated_at'])
    AND EXISTS (
      SELECT 1 FROM public.desbravadores d WHERE d.id = OLD.dbv_id
        AND public.perfil_juvenil_por_nascimento(d.data_nascimento, d.clube_id) = NEW.perfil
    ) THEN RETURN NEW; END IF;

  IF NEW.perfil IS DISTINCT FROM OLD.perfil
    OR NEW.dbv_id IS DISTINCT FROM OLD.dbv_id OR NEW.unidade_id IS DISTINCT FROM OLD.unidade_id THEN
    IF COALESCE(NEW.perfil, '') IN ('admin_ti', 'admin_total', 'admin_geral') THEN
      RAISE EXCEPTION 'Somente o Admin TI concede perfis de plataforma.' USING ERRCODE = '42501';
    END IF;
    IF OLD.id = auth.uid() THEN
      RAISE EXCEPTION 'Você não pode alterar o próprio perfil ou vínculo.' USING ERRCODE = '42501';
    END IF;
    IF NOT public.gestor_da_conta(OLD.id, TRUE) THEN
      RAISE EXCEPTION 'Sem permissão para alterar o perfil ou o vínculo desta conta.' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.ajustar_acesso_juvenil_da_ficha() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  perfil_juvenil text := public.perfil_juvenil_por_nascimento(NEW.data_nascimento, NEW.clube_id);
  contas uuid[];
BEGIN
  IF perfil_juvenil IS NULL THEN RETURN NEW; END IF;

  SELECT ARRAY(
    SELECT u.usuario_id FROM public.usuario_clubes u
    WHERE u.clube_id = NEW.clube_id AND u.membro_id = NEW.id AND u.ativo
      AND u.perfil NOT IN ('usuario_pais','responsavel')
    UNION
    SELECT l.id FROM public.usuarios l
    WHERE l.dbv_id = NEW.id AND l.perfil NOT IN ('usuario_pais','responsavel')
      AND (
        NOT EXISTS (SELECT 1 FROM public.usuario_clubes u WHERE u.usuario_id = l.id AND u.clube_id = NEW.clube_id)
        OR EXISTS (
          SELECT 1 FROM public.usuario_clubes u
          WHERE u.usuario_id = l.id AND u.clube_id = NEW.clube_id AND u.ativo
            AND u.perfil NOT IN ('usuario_pais','responsavel')
        )
      )
  ) INTO contas;

  -- Reaproveita o contexto juvenil existente pela chave composta do vínculo.
  INSERT INTO public.usuario_clubes (usuario_id, clube_id, membro_id, unidade_id, perfil, ativo)
  SELECT conta, NEW.clube_id, NEW.id, NEW.unidade_id, perfil_juvenil, TRUE
  FROM unnest(contas) AS conta
  ON CONFLICT (usuario_id, clube_id, perfil, (COALESCE(membro_id, 0)), (COALESCE(unidade_id, 0)))
  DO UPDATE SET ativo = TRUE, updated_at = now() WHERE NOT public.usuario_clubes.ativo;

  UPDATE public.usuario_clubes u SET ativo = FALSE, updated_at = now()
  WHERE u.clube_id = NEW.clube_id AND u.ativo AND u.usuario_id = ANY(contas)
    AND u.perfil NOT IN ('usuario_pais','responsavel')
    AND (u.perfil <> perfil_juvenil OR u.membro_id IS DISTINCT FROM NEW.id
      OR u.unidade_id IS DISTINCT FROM NEW.unidade_id);

  -- Corrige também o perfil legado usado pelo login e pela tela Vincular Usuários.
  UPDATE public.usuarios SET perfil = perfil_juvenil
  WHERE dbv_id = NEW.id AND perfil IS DISTINCT FROM perfil_juvenil
    AND perfil NOT IN ('usuario_pais','responsavel');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.ajustar_acesso_juvenil_da_ficha() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_ajustar_acesso_juvenil_da_ficha
AFTER UPDATE OF data_nascimento ON public.desbravadores
FOR EACH ROW EXECUTE FUNCTION public.ajustar_acesso_juvenil_da_ficha();

-- Corrige a divergência confirmada pela ficha e pelo login de Teste.
UPDATE public.desbravadores SET data_nascimento = data_nascimento
WHERE id = 571 AND lower(btrim(nome)) = 'teste'
  AND public.perfil_juvenil_por_nascimento(data_nascimento, clube_id) IS NOT NULL;

DO $$
DECLARE
  tabela text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH tabela IN ARRAY ARRAY['usuarios', 'usuario_clubes'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tabela
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tabela);
      END IF;
    END LOOP;
  END IF;
END;
$$;

COMMIT;
