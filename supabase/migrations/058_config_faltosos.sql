-- Limiar configurável de faltas consecutivas para a aba "Faltosos" no dashboard
ALTER TABLE clubes
  ADD COLUMN IF NOT EXISTS min_faltas_faltosos INTEGER NOT NULL DEFAULT 3;

COMMENT ON COLUMN clubes.min_faltas_faltosos IS
  'Mínimo de reuniões consecutivas sem presença para o membro aparecer na aba Faltosos.';
