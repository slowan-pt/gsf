-- Ocultação pessoal. A política da migração 044 exige auth.uid() = usuario_id.
GRANT INSERT (mensagem_id, usuario_id) ON public.mensagens_clube_ocultos TO authenticated;
GRANT USAGE ON SEQUENCE public.mensagens_clube_ocultos_id_seq TO authenticated;
