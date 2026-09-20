-- Quando um DBV/pai não tem acesso à lista completa do ranking, ainda vê um
-- cartão com a própria posição — esses dois campos deixam o clube decidir
-- separadamente se esse cartão mostra a pontuação e/ou a colocação.
ALTER TABLE public.config_ranking
  ADD COLUMN IF NOT EXISTS membros_ve_pontuacao BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS membros_ve_posicao BOOLEAN NOT NULL DEFAULT TRUE;
