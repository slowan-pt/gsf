-- Modo de exibição de membros nos relatórios (nome / nome+foto / só foto) é
-- uma preferência pessoal de quem gera o relatório — reaproveita a mesma
-- tabela per-usuário já usada pra cor de cabeçalho de Atividades.
ALTER TABLE public.configuracoes_visuais_usuario
  ADD COLUMN IF NOT EXISTS modo_exibicao_relatorios TEXT NOT NULL DEFAULT 'nome'
    CHECK (modo_exibicao_relatorios IN ('nome', 'nome_foto', 'foto'));
