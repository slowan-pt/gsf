-- Rastreamento de avisos lidos por usuário.
-- Permite marcar como lido/não lido sem afetar outros usuários.

CREATE TABLE IF NOT EXISTS public.mensagens_clube_lidos (
  id         bigserial PRIMARY KEY,
  mensagem_id uuid   NOT NULL REFERENCES public.mensagens_clube(id) ON DELETE CASCADE,
  usuario_id  uuid   NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mensagem_id, usuario_id)
);

ALTER TABLE public.mensagens_clube_lidos ENABLE ROW LEVEL SECURITY;

-- Cada usuário só vê e gerencia seus próprios registros de leitura
CREATE POLICY "Usuarios gerenciam seus proprios lidos"
  ON public.mensagens_clube_lidos
  FOR ALL
  USING  (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

-- Índice para busca rápida por usuário
CREATE INDEX IF NOT EXISTS idx_mensagens_clube_lidos_usuario
  ON public.mensagens_clube_lidos (usuario_id);
