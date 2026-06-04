-- Ajustes de drift encontrados ao clonar producao para um projeto limpo.

ALTER TABLE IF EXISTS public.unidades
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE IF EXISTS public.desbravadores
  ADD COLUMN IF NOT EXISTS ativo boolean DEFAULT true;

ALTER TABLE IF EXISTS public.eventos
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE IF EXISTS public.pontuacoes
  ADD COLUMN IF NOT EXISTS presenca_pts integer,
  ADD COLUMN IF NOT EXISTS pontualidade_pts integer,
  ADD COLUMN IF NOT EXISTS material_pts integer,
  ADD COLUMN IF NOT EXISTS uniforme_pts integer;

ALTER TABLE IF EXISTS public.atividades
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

NOTIFY pgrst, 'reload schema';
