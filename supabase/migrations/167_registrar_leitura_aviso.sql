BEGIN;

CREATE OR REPLACE FUNCTION public.registrar_leitura_aviso(p_mensagem_id uuid, p_clube_id integer)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  leitor uuid := auth.uid();
BEGIN
  IF leitor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.mensagens_clube m
    WHERE m.id = p_mensagem_id
      AND (m.clube_id = p_clube_id OR m.clube_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'Aviso indisponível neste clube.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.mensagens_clube_lidos (mensagem_id, usuario_id)
  VALUES (p_mensagem_id, leitor)
  ON CONFLICT (mensagem_id, usuario_id) DO NOTHING;
END
$$;

REVOKE ALL ON FUNCTION public.registrar_leitura_aviso(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_leitura_aviso(uuid, integer) TO authenticated;
NOTIFY pgrst, 'reload schema';

COMMIT;
