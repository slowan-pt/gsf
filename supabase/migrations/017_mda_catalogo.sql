-- Catálogo MDA: classes, especialidades, requisitos e imagens.

ALTER TABLE public.classes_modelo ADD COLUMN IF NOT EXISTS codigo TEXT;
ALTER TABLE public.classes_modelo ADD COLUMN IF NOT EXISTS nome_completo TEXT;
ALTER TABLE public.classes_modelo ADD COLUMN IF NOT EXISTS categoria TEXT;
ALTER TABLE public.classes_modelo ADD COLUMN IF NOT EXISTS fonte_oficial TEXT;
ALTER TABLE public.classes_modelo ADD COLUMN IF NOT EXISTS imagem_url TEXT;
ALTER TABLE public.classes_modelo ADD COLUMN IF NOT EXISTS imagem_arquivo TEXT;
ALTER TABLE public.classes_modelo ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.especialidades_modelo ADD COLUMN IF NOT EXISTS item_url TEXT;
ALTER TABLE public.especialidades_modelo ADD COLUMN IF NOT EXISTS nome_completo TEXT;
ALTER TABLE public.especialidades_modelo ADD COLUMN IF NOT EXISTS area TEXT;
ALTER TABLE public.especialidades_modelo ADD COLUMN IF NOT EXISTS nivel TEXT;
ALTER TABLE public.especialidades_modelo ADD COLUMN IF NOT EXISTS instituicao_origem TEXT;
ALTER TABLE public.especialidades_modelo ADD COLUMN IF NOT EXISTS imagem_arquivo TEXT;

CREATE TABLE IF NOT EXISTS public.mda_requisitos_modelo (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  programa_id INTEGER NOT NULL REFERENCES public.programas(id) ON DELETE CASCADE,
  item_tipo TEXT NOT NULL CHECK (item_tipo IN ('Classe', 'Especialidade')),
  item_nome TEXT NOT NULL,
  item_codigo TEXT,
  item_url TEXT NOT NULL,
  classe_id INTEGER REFERENCES public.classes_modelo(id) ON DELETE CASCADE,
  especialidade_id UUID REFERENCES public.especialidades_modelo(id) ON DELETE CASCADE,
  secao TEXT,
  ordem INTEGER NOT NULL DEFAULT 100,
  texto TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (programa_id, item_tipo, item_url, ordem, texto)
);

CREATE INDEX IF NOT EXISTS idx_mda_requisitos_programa_tipo
  ON public.mda_requisitos_modelo (programa_id, item_tipo);

CREATE INDEX IF NOT EXISTS idx_mda_requisitos_classe
  ON public.mda_requisitos_modelo (classe_id)
  WHERE classe_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mda_requisitos_especialidade
  ON public.mda_requisitos_modelo (especialidade_id)
  WHERE especialidade_id IS NOT NULL;

ALTER TABLE public.mda_requisitos_modelo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mda_requisitos_select_authenticated" ON public.mda_requisitos_modelo;
CREATE POLICY "mda_requisitos_select_authenticated"
ON public.mda_requisitos_modelo
FOR SELECT TO authenticated
USING (TRUE);

DROP POLICY IF EXISTS "mda_requisitos_admin_ti_all" ON public.mda_requisitos_modelo;
CREATE POLICY "mda_requisitos_admin_ti_all"
ON public.mda_requisitos_modelo
FOR ALL TO authenticated
USING (public.current_user_is_admin_ti())
WITH CHECK (public.current_user_is_admin_ti());
