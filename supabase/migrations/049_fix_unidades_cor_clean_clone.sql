-- Garante coluna usada pelas telas de unidades e seeds multiclube.
ALTER TABLE IF EXISTS public.unidades
  ADD COLUMN IF NOT EXISTS cor text DEFAULT '#1a3a5c';
