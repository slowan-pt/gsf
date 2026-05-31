-- Permite reenviar uma atividade após o prazo quando ela foi devolvida/reaberta.
-- O bloqueio continua valendo para novas entregas fora do prazo.

CREATE OR REPLACE FUNCTION public.validar_prazo_resposta_atividade()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_prazo DATE;
  v_hoje DATE;
BEGIN
  IF NEW.status <> 'entregue' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IN ('em_correcao', 'recusada') THEN
    RETURN NEW;
  END IF;

  SELECT data::date
    INTO v_prazo
    FROM public.atividades
   WHERE id = NEW.atividade_id;

  v_hoje := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;

  IF v_prazo IS NOT NULL AND v_hoje > v_prazo THEN
    RAISE EXCEPTION 'O prazo de entrega desta atividade encerrou em %.', to_char(v_prazo, 'DD/MM/YYYY')
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;
