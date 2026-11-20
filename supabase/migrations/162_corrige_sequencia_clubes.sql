BEGIN;

-- Impede inserções enquanto a sequência é comparada com os IDs existentes.
LOCK TABLE public.clubes IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  sequencia regclass := pg_get_serial_sequence('public.clubes', 'id')::regclass;
  ultimo bigint;
  usado boolean;
  maior_id bigint;
BEGIN
  IF sequencia IS NULL THEN
    RAISE EXCEPTION 'Sequência de public.clubes.id não encontrada';
  END IF;

  EXECUTE format('SELECT last_value, is_called FROM %s', sequencia) INTO ultimo, usado;
  SELECT MAX(id) INTO maior_id FROM public.clubes;
  IF maior_id > ultimo OR (maior_id = ultimo AND NOT usado) THEN
    EXECUTE format('ALTER SEQUENCE %s RESTART WITH %s', sequencia, maior_id + 1);
  END IF;
END;
$$;

COMMIT;
