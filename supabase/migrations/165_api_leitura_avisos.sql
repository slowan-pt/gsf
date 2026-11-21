-- A política da migração 043 continua limitando os registros ao próprio usuário.
GRANT SELECT, INSERT ON public.mensagens_clube_lidos TO authenticated;
GRANT USAGE ON SEQUENCE public.mensagens_clube_lidos_id_seq TO authenticated;
GRANT SELECT ON public.mensagens_clube_ocultos TO authenticated;
NOTIFY pgrst, 'reload schema';
