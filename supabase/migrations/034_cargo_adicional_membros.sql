ALTER TABLE public.desbravadores
  ADD COLUMN IF NOT EXISTS cargo_adicional TEXT;

UPDATE public.desbravadores
SET cargo_adicional = 'Secretário de unidade',
    updated_at = NOW()
WHERE clube_id = 1
  AND nome IN ('Davi Vitor de Lima Martins', 'Davi Victor de Lima Martins')
  AND (cargo_adicional IS NULL OR cargo_adicional = '');
