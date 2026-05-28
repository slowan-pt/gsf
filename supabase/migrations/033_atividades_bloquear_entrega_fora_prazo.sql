-- Bloqueia entrega ou reenvio de atividades após o prazo definido.
-- Avaliações da diretoria continuam permitidas após o vencimento.

CREATE OR REPLACE FUNCTION public.validar_prazo_resposta_atividade()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_prazo DATE;
BEGIN
  IF NEW.status <> 'entregue' THEN
    RETURN NEW;
  END IF;

  SELECT data::date
    INTO v_prazo
    FROM public.atividades
   WHERE id = NEW.atividade_id;

  IF v_prazo IS NOT NULL AND CURRENT_DATE > v_prazo THEN
    RAISE EXCEPTION 'O prazo de entrega desta atividade encerrou em %.', to_char(v_prazo, 'DD/MM/YYYY')
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_prazo_resposta_atividade ON public.atividades_respostas;

CREATE TRIGGER trg_validar_prazo_resposta_atividade
BEFORE INSERT OR UPDATE ON public.atividades_respostas
FOR EACH ROW
EXECUTE FUNCTION public.validar_prazo_resposta_atividade();
