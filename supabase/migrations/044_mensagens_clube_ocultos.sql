-- Permite que cada usuário oculte avisos da própria visualização
-- sem afetar os outros membros do clube.

CREATE TABLE IF NOT EXISTS public.mensagens_clube_ocultos (
  id          bigserial PRIMARY KEY,
  mensagem_id uuid        NOT NULL REFERENCES public.mensagens_clube(id) ON DELETE CASCADE,
  usuario_id  uuid        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mensagem_id, usuario_id)
);

ALTER TABLE public.mensagens_clube_ocultos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios gerenciam seus proprios ocultos"
  ON public.mensagens_clube_ocultos
  FOR ALL
  USING  (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

CREATE INDEX IF NOT EXISTS idx_mensagens_clube_ocultos_usuario
  ON public.mensagens_clube_ocultos (usuario_id);
