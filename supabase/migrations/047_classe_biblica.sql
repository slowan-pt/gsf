-- Migration 047: Classe Bíblica — respostas por usuário
-- Cada campo do estudo (textarea/input) é uma linha nesta tabela.
-- campo_id segue o padrão "ep1_q1", "ep2_p1", etc.

CREATE TABLE IF NOT EXISTS public.classe_biblica_respostas (
  id          BIGSERIAL    PRIMARY KEY,
  usuario_id  UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clube_id    INT          NOT NULL,
  campo_id    TEXT         NOT NULL,
  resposta    TEXT         NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, clube_id, campo_id)
);

ALTER TABLE public.classe_biblica_respostas ENABLE ROW LEVEL SECURITY;

-- Cada usuário acessa apenas as suas próprias respostas
CREATE POLICY "cbr_select_own" ON public.classe_biblica_respostas
  FOR SELECT USING (auth.uid() = usuario_id);

CREATE POLICY "cbr_insert_own" ON public.classe_biblica_respostas
  FOR INSERT WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "cbr_update_own" ON public.classe_biblica_respostas
  FOR UPDATE USING (auth.uid() = usuario_id);

CREATE POLICY "cbr_delete_own" ON public.classe_biblica_respostas
  FOR DELETE USING (auth.uid() = usuario_id);

-- Índice para performance na consulta por usuário + clube
CREATE INDEX IF NOT EXISTS idx_cbr_usuario_clube
  ON public.classe_biblica_respostas (usuario_id, clube_id);
