BEGIN;

ALTER TABLE public.mensagens_clube_lidos
  ADD COLUMN IF NOT EXISTS clube_id integer REFERENCES public.clubes(id);

CREATE OR REPLACE FUNCTION public.registrar_leitura_aviso(p_mensagem_id uuid, p_clube_id integer)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  leitor uuid := auth.uid();
  clube_aviso integer;
BEGIN
  SELECT COALESCE(m.clube_id, p_clube_id) INTO clube_aviso
  FROM public.mensagens_clube m
  WHERE m.id = p_mensagem_id AND (m.clube_id = p_clube_id OR m.clube_id IS NULL);

  IF leitor IS NULL OR clube_aviso IS NULL THEN
    RAISE EXCEPTION 'Aviso indisponível neste clube.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.mensagens_clube_lidos (mensagem_id, usuario_id, clube_id)
  VALUES (p_mensagem_id, leitor, clube_aviso)
  ON CONFLICT (mensagem_id, usuario_id) DO NOTHING;
END
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
