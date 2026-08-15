-- Permite vincular uma especialidade ja concluida pelo membro a um requisito
-- de classe do tipo "complete uma especialidade em uma das areas abaixo",
-- em vez de so marcar manualmente. Usado pelo seletor de especialidade na
-- tela de Classes.
ALTER TABLE public.classes_requisitos_progresso
  ADD COLUMN IF NOT EXISTS especialidade_vinculada TEXT;
