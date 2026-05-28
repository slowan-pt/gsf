-- Personalizacao visual dos blocos de atividades e cabecalho por clube.

ALTER TABLE public.configuracoes_visuais_clube
  ADD COLUMN IF NOT EXISTS cores_atividades JSONB,
  ADD COLUMN IF NOT EXISTS fonte_atividades TEXT NOT NULL DEFAULT 'padrao';

UPDATE public.configuracoes_visuais_clube
SET fonte_atividades = 'padrao'
WHERE fonte_atividades IS NULL OR fonte_atividades = '';
