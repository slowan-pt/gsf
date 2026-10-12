-- Degrade do cabecalho por usuario: pode ser desligado (cor lisa) ou ter a cor final escolhida.
ALTER TABLE public.configuracoes_visuais_usuario
  ADD COLUMN IF NOT EXISTS degrade_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cor_degrade text;

ALTER TABLE public.configuracoes_visuais_usuario
  DROP CONSTRAINT IF EXISTS configuracoes_visuais_usuario_cor_degrade_hex;
ALTER TABLE public.configuracoes_visuais_usuario
  ADD CONSTRAINT configuracoes_visuais_usuario_cor_degrade_hex
  CHECK (cor_degrade IS NULL OR cor_degrade ~ '^#[0-9a-fA-F]{6}$');
