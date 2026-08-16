-- 074_especialidades_marcacao_manual.sql
-- Permite marcar uma especialidade como concluída manualmente (sem passar por
-- uma atividade do sistema) e registrar QUEM marcou.
--
-- Até aqui a origem só podia ser inferida: se atividade_origem_id ou
-- plano_formativo_id estivesse preenchido, veio de uma atividade. Não havia
-- onde guardar o responsável por uma marcação feita à mão, então a ficha do
-- membro não conseguia mostrar "marcado por Fulano".

ALTER TABLE public.especialidades
  ADD COLUMN IF NOT EXISTS marcado_por_usuario_id UUID,
  ADD COLUMN IF NOT EXISTS marcado_por_nome TEXT,
  ADD COLUMN IF NOT EXISTS marcado_em TIMESTAMPTZ;

COMMENT ON COLUMN public.especialidades.marcado_por_nome IS
  'Nome de quem marcou manualmente. Vazio quando a especialidade veio de uma atividade do sistema.';
