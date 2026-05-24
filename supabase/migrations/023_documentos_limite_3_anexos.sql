-- Todos os documentos aceitam até 3 anexos, exceto Foto, que aceita apenas 1.

ALTER TABLE IF EXISTS public.documentos_modelo
  ADD COLUMN IF NOT EXISTS limite_anexos INTEGER DEFAULT 3;

UPDATE public.documentos_modelo
SET limite_anexos = CASE
  WHEN campo = 'foto' THEN 1
  ELSE 3
END;
