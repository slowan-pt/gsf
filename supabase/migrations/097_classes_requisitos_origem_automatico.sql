-- Requisitos "de fora" que agrupam sub-opções (ex.: "cumpra 1 das 4 opções
-- abaixo", "marque as 4 opções abaixo") passam a ser marcados
-- AUTOMATICAMENTE quando os filhos atingem a quantidade necessária, em vez
-- de poderem ser marcados direto. Precisa de um novo valor de origem pra
-- distinguir esse caso de uma marcação manual de verdade.

ALTER TABLE public.classes_requisitos_progresso
  DROP CONSTRAINT IF EXISTS classes_requisitos_progresso_origem_check;

ALTER TABLE public.classes_requisitos_progresso
  ADD CONSTRAINT classes_requisitos_progresso_origem_check
  CHECK (origem IN ('manual', 'atividade', 'especialidade', 'automatico'));
