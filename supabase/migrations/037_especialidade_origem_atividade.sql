-- Preserva a especialidade entregue mesmo que sua atividade avaliativa seja removida.
ALTER TABLE public.especialidades
  ADD COLUMN IF NOT EXISTS atividade_origem_id BIGINT REFERENCES public.atividades(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS atividade_origem_titulo TEXT,
  ADD COLUMN IF NOT EXISTS atividade_origem_excluida BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS atividade_origem_excluida_em TIMESTAMPTZ;

ALTER TABLE public.investidura_itens
  ADD COLUMN IF NOT EXISTS atividade_id BIGINT REFERENCES public.atividades(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_especialidades_atividade_origem
  ON public.especialidades (clube_id, atividade_origem_id)
  WHERE atividade_origem_id IS NOT NULL;

-- Relaciona entregas existentes à atividade ainda presente, quando possível.
UPDATE public.especialidades e
SET
  atividade_origem_id = (
    SELECT a.id
    FROM public.atividades a
    JOIN public.investidura_itens i
      ON i.clube_id = e.clube_id
     AND i.dbv_id = e.dbv_id
     AND i.tipo = 'especialidade'
     AND i.item_nome = e.nome
     AND i.entregue = TRUE
    WHERE a.clube_id = e.clube_id
      AND a.item_formativo_tipo = 'especialidade'
      AND a.item_formativo_nome = e.nome
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT 1
  ),
  atividade_origem_titulo = (
    SELECT a.titulo
    FROM public.atividades a
    JOIN public.investidura_itens i
      ON i.clube_id = e.clube_id
     AND i.dbv_id = e.dbv_id
     AND i.tipo = 'especialidade'
     AND i.item_nome = e.nome
     AND i.entregue = TRUE
    WHERE a.clube_id = e.clube_id
      AND a.item_formativo_tipo = 'especialidade'
      AND a.item_formativo_nome = e.nome
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT 1
  ),
  updated_at = now()
WHERE e.status = 'OK'
  AND e.atividade_origem_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.atividades a
    JOIN public.investidura_itens i
      ON i.clube_id = e.clube_id
     AND i.dbv_id = e.dbv_id
     AND i.tipo = 'especialidade'
     AND i.item_nome = e.nome
     AND i.entregue = TRUE
    WHERE a.clube_id = e.clube_id
      AND a.item_formativo_tipo = 'especialidade'
      AND a.item_formativo_nome = e.nome
  );

-- Identifica entregas oriundas de atividades que já foram apagadas antes desta migração.
UPDATE public.especialidades e
SET
  atividade_origem_excluida = TRUE,
  atividade_origem_excluida_em = COALESCE(e.atividade_origem_excluida_em, now()),
  atividade_origem_titulo = COALESCE(e.atividade_origem_titulo, 'Atividade avaliativa removida'),
  updated_at = now()
WHERE e.status = 'OK'
  AND e.atividade_origem_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.investidura_itens i
    WHERE i.clube_id = e.clube_id
      AND i.dbv_id = e.dbv_id
      AND i.tipo = 'especialidade'
      AND i.item_nome = e.nome
      AND i.entregue = TRUE
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.atividades a
    WHERE a.clube_id = e.clube_id
      AND a.item_formativo_tipo = 'especialidade'
      AND a.item_formativo_nome = e.nome
  );
