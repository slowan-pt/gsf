-- 158_patrimonio_anexos.sql
-- Patrimônio: até 5 anexos por item (fotos e PDFs). Cada anexo é {"url", "tipo": "imagem" | "pdf", "nome"}.
-- A coluna foto_url continua existindo e guarda a primeira imagem (capa da lista e dos relatórios).
-- Requer a migration 154. Pode ser rodada mais de uma vez.

ALTER TABLE public.patrimonio_itens
  ADD COLUMN IF NOT EXISTS anexos JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Itens que já tinham uma foto passam a ter essa foto como primeiro anexo.
UPDATE public.patrimonio_itens
SET anexos = jsonb_build_array(jsonb_build_object('url', foto_url, 'tipo', 'imagem', 'nome', 'Foto'))
WHERE foto_url IS NOT NULL AND btrim(foto_url) <> '' AND anexos = '[]'::jsonb;

ALTER TABLE public.patrimonio_itens DROP CONSTRAINT IF EXISTS patrimonio_itens_anexos_check;
ALTER TABLE public.patrimonio_itens
  ADD CONSTRAINT patrimonio_itens_anexos_check CHECK (jsonb_typeof(anexos) = 'array' AND jsonb_array_length(anexos) <= 5);
