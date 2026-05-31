-- Prazo próprio para reabertura de uma resposta aprovada/devolvida.
-- A atividade mantém o prazo original; a reabertura controla apenas o reenvio daquela resposta.

ALTER TABLE IF EXISTS public.atividades_respostas
  ADD COLUMN IF NOT EXISTS reaberto_ate DATE;

CREATE OR REPLACE FUNCTION public.validar_prazo_resposta_atividade()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_prazo DATE;
  v_hoje DATE;
  v_prazo_reabertura DATE;
BEGIN
  IF NEW.status <> 'entregue' THEN
    RETURN NEW;
  END IF;

  v_hoje := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;

  IF TG_OP = 'UPDATE' AND OLD.status IN ('em_correcao', 'recusada') THEN
    v_prazo_reabertura := COALESCE(NEW.reaberto_ate, OLD.reaberto_ate);

    IF v_prazo_reabertura IS NOT NULL THEN
      IF v_hoje > v_prazo_reabertura THEN
        RAISE EXCEPTION 'O prazo de reabertura desta atividade encerrou em %.', to_char(v_prazo_reabertura, 'DD/MM/YYYY')
          USING ERRCODE = 'P0001';
      END IF;

      RETURN NEW;
    END IF;
  END IF;

  SELECT data::date
    INTO v_prazo
    FROM public.atividades
   WHERE id = NEW.atividade_id;

  IF v_prazo IS NOT NULL AND v_hoje > v_prazo THEN
    RAISE EXCEPTION 'O prazo de entrega desta atividade encerrou em %.', to_char(v_prazo, 'DD/MM/YYYY')
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;
