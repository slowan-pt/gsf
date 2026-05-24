-- Pré-cadastro com responsável apto a receber acesso de pais.

ALTER TABLE IF EXISTS public.pre_cadastros
  ADD COLUMN IF NOT EXISTS email_responsavel TEXT,
  ADD COLUMN IF NOT EXISTS parentesco_responsavel TEXT,
  ADD COLUMN IF NOT EXISTS responsavel_usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aprovado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejeitado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejeitado_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pre_cadastros_clube_status
  ON public.pre_cadastros (clube_id, status);

CREATE INDEX IF NOT EXISTS idx_pre_cadastros_email_responsavel
  ON public.pre_cadastros (lower(email_responsavel));

SELECT setval(
  pg_get_serial_sequence('public.desbravadores', 'id'),
  GREATEST((SELECT COALESCE(MAX(id), 0) FROM public.desbravadores), 1),
  TRUE
);

SELECT setval(
  pg_get_serial_sequence('public.documentos', 'id'),
  GREATEST((SELECT COALESCE(MAX(id), 0) FROM public.documentos), 1),
  TRUE
);

SELECT setval(
  pg_get_serial_sequence('public.progresso_classes', 'id'),
  GREATEST((SELECT COALESCE(MAX(id), 0) FROM public.progresso_classes), 1),
  TRUE
);
