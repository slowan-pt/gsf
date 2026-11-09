-- 155_mestrado_sai_com_especialidade.sql
-- Se uma especialidade deixa de constar para o membro (apagada da ficha, ou "devolvida" em Aguardando investidura),
-- o mestrado que dependia dela e que deixou de cumprir os requisitos SAI JUNTO: o processo do mestrado é removido
-- (em qualquer etapa: diretoria, devolvido, aprovado ou investido) e o item de investidura do mestrado também.
--
-- Antes (137), o gatilho só sinalizava um alerta quando o mestrado ainda estava com a diretoria, e não fazia nada
-- com mestrado já aprovado ou investido. Agora vale para todos os caminhos de remoção, porque está no banco.
--
-- Só são revistos os mestrados cuja lista INCLUI a especialidade removida; os outros do membro não são tocados.
-- Requer a migration 137. O que foi retirado fica registrado em mestrado_revogados (quem, quando, o que havia).

CREATE TABLE IF NOT EXISTS public.mestrado_revogados (
  id bigserial PRIMARY KEY,
  clube_id integer NOT NULL,
  dbv_id integer NOT NULL,
  mestrado_id uuid NOT NULL,
  codigo text NOT NULL,
  nome text NOT NULL,
  etapa_anterior text NOT NULL,
  especialidade_removida text,
  revogado_por uuid DEFAULT auth.uid(),
  revogado_em timestamptz NOT NULL DEFAULT now(),
  processo jsonb NOT NULL,
  historico jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS mestrado_revogados_membro_idx ON public.mestrado_revogados (clube_id, dbv_id, revogado_em);

ALTER TABLE public.mestrado_revogados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mestrado_revogados_select" ON public.mestrado_revogados;
CREATE POLICY "mestrado_revogados_select" ON public.mestrado_revogados FOR SELECT TO authenticated
  USING (public.current_user_is_admin_ti() OR public.fluxo_pode_diretoria(clube_id));

-- Ninguém escreve direto: só a função abaixo.
REVOKE ALL ON public.mestrado_revogados FROM anon, authenticated;
GRANT SELECT ON public.mestrado_revogados TO authenticated;

CREATE OR REPLACE FUNCTION public.mestrado_revogar_sem_requisitos(p_dbv integer, p_especialidade text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p public.mestrado_processos%ROWTYPE;
  m public.mestrados%ROWTYPE;
  c jsonb;
  v_revogados integer := 0;
BEGIN
  -- Membro sendo excluído (as especialidades somem em cascata): nada a revisar.
  IF NOT EXISTS (SELECT 1 FROM public.desbravadores WHERE id = p_dbv) THEN RETURN 0; END IF;

  -- Mesma trava do encaminhamento automático: operações do mesmo membro esperam a vez.
  PERFORM pg_advisory_xact_lock(hashtextextended('mestrado:' || p_dbv::text, 0));

  FOR p IN
    SELECT pr.*
      FROM public.mestrado_processos pr
     WHERE pr.dbv_id = p_dbv
       AND EXISTS (
         SELECT 1
           FROM public.mestrado_especialidades me
           JOIN public.especialidades_modelo em ON em.id = me.especialidade_id
          WHERE me.mestrado_id = pr.mestrado_id
            AND public.mestrado_norm(em.nome) = public.mestrado_norm(p_especialidade)
       )
       FOR UPDATE
  LOOP
    c := public.mestrado_contagem(p_dbv, p.mestrado_id, '[]'::jsonb);
    CONTINUE WHEN (c->>'atende')::boolean;   -- ainda cumpre sem ela (tinha especialidades a mais)

    SELECT * INTO m FROM public.mestrados WHERE id = p.mestrado_id;

    INSERT INTO public.mestrado_revogados
      (clube_id, dbv_id, mestrado_id, codigo, nome, etapa_anterior, especialidade_removida, processo, historico)
    VALUES
      (p.clube_id, p.dbv_id, p.mestrado_id, p.codigo, COALESCE(m.nome, p.codigo), p.etapa, p_especialidade, to_jsonb(p),
       COALESCE((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.em) FROM public.mestrado_historico h WHERE h.processo_id = p.id), '[]'::jsonb));

    -- O item do mestrado em "aguardando investidura" (ou já entregue) sai junto.
    DELETE FROM public.investidura_itens
     WHERE clube_id = p.clube_id AND dbv_id = p.dbv_id AND tipo = 'mestrado' AND item_nome = m.nome;

    DELETE FROM public.mestrado_processos WHERE id = p.id;   -- o histórico do processo vai junto (cascata)
    v_revogados := v_revogados + 1;
  END LOOP;

  RETURN v_revogados;
END;
$$;

-- Só o gatilho (como dono da função) chama; ninguém precisa executar direto.
REVOKE ALL ON FUNCTION public.mestrado_revogar_sem_requisitos(integer, text) FROM PUBLIC, anon, authenticated;

-- O gatilho da especialidade agora também retira o mestrado quando a especialidade deixa de constar.
CREATE OR REPLACE FUNCTION public.mestrado_trg_especialidade()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_dbv integer;
  v_perdeu boolean := FALSE;
  v_nome text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_dbv := OLD.dbv_id; v_nome := OLD.nome; v_perdeu := (OLD.status = 'OK');
  ELSIF TG_OP = 'UPDATE' THEN
    v_dbv := NEW.dbv_id; v_nome := OLD.nome; v_perdeu := (OLD.status = 'OK' AND NEW.status IS DISTINCT FROM 'OK');
  ELSE
    v_dbv := NEW.dbv_id;
  END IF;

  -- Primeiro retira o que deixou de cumprir; depois a avaliação normal (encaminha quem passou a cumprir).
  IF v_perdeu THEN
    BEGIN
      PERFORM public.mestrado_revogar_sem_requisitos(v_dbv, v_nome);
    EXCEPTION WHEN OTHERS THEN
      -- Nunca pode impedir a remoção da especialidade.
      RAISE WARNING 'mestrado_revogar_sem_requisitos falhou: %', SQLERRM;
    END;
  END IF;

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
