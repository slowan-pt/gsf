-- Historico imutavel de conversas em atividades.
-- atividades_respostas continua sendo o estado atual para contadores/status.

CREATE TABLE IF NOT EXISTS public.atividades_mensagens (
  id BIGSERIAL PRIMARY KEY,
  clube_id INTEGER NOT NULL DEFAULT 1,
  atividade_id BIGINT NOT NULL REFERENCES public.atividades(id) ON DELETE CASCADE,
  dbv_id INTEGER NOT NULL REFERENCES public.desbravadores(id) ON DELETE CASCADE,
  autor_tipo TEXT NOT NULL CHECK (autor_tipo IN ('membro', 'avaliador', 'sistema')),
  autor_id UUID,
  autor_nome TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('resposta', 'aprovacao', 'devolucao', 'recusa', 'sistema')),
  texto TEXT,
  anexo_url TEXT,
  anexo_nome TEXT,
  status TEXT CHECK (status IN ('pendente', 'entregue', 'em_correcao', 'aprovada', 'recusada')),
  nota NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atividades_mensagens_clube ON public.atividades_mensagens(clube_id);
CREATE INDEX IF NOT EXISTS idx_atividades_mensagens_atividade_dbv ON public.atividades_mensagens(atividade_id, dbv_id, created_at);

ALTER TABLE public.atividades_mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "atividades_mensagens_select_contexto" ON public.atividades_mensagens;
CREATE POLICY "atividades_mensagens_select_contexto"
ON public.atividades_mensagens
FOR SELECT
TO authenticated
USING (
  public.current_user_can_manage_atividades(clube_id)
  OR EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.dbv_id = atividades_mensagens.dbv_id
  )
  OR EXISTS (
    SELECT 1 FROM public.responsavel_membros rm
    WHERE rm.usuario_id = auth.uid()
      AND rm.clube_id = atividades_mensagens.clube_id
      AND rm.membro_id = atividades_mensagens.dbv_id
      AND COALESCE(rm.ativo, TRUE)
  )
);

DROP POLICY IF EXISTS "atividades_mensagens_insert_contexto" ON public.atividades_mensagens;
CREATE POLICY "atividades_mensagens_insert_contexto"
ON public.atividades_mensagens
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_user_can_manage_atividades(clube_id)
  OR EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.dbv_id = atividades_mensagens.dbv_id
  )
  OR EXISTS (
    SELECT 1 FROM public.responsavel_membros rm
    WHERE rm.usuario_id = auth.uid()
      AND rm.clube_id = atividades_mensagens.clube_id
      AND rm.membro_id = atividades_mensagens.dbv_id
      AND COALESCE(rm.ativo, TRUE)
  )
);

