-- 122_config_faltosos_quem_conta.sql
-- Define quem entra na contagem da aba Faltosos do dashboard, por clube:
-- grupos (dbv, diretoria, inativos, sem_unidade) e membros específicos que ficam
-- de fora (excluidos = ids de desbravadores). O padrão preserva o comportamento
-- anterior: todos os ativos contam, inativos não.
ALTER TABLE public.clubes
  ADD COLUMN IF NOT EXISTS config_faltosos JSONB NOT NULL
  DEFAULT '{"dbv": true, "diretoria": true, "inativos": false, "sem_unidade": true, "excluidos": []}'::jsonb;

COMMENT ON COLUMN public.clubes.config_faltosos IS
  'Quem entra na contagem da aba Faltosos: grupos (dbv, diretoria, inativos, sem_unidade) e excluidos (ids de membros).';
