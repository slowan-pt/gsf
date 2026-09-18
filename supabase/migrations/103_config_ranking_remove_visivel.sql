-- A visibilidade da lista completa deixa de ser um toggle separado
-- (visivel_diretoria/visivel_membros): agora é derivada diretamente de
-- quantos tipos (DBV/Diretoria/Conselheiros/Unidades) estão marcados pra
-- cada público. Se nenhum tipo estiver marcado pra um público, essa
-- pessoa só vê a própria posição e o próprio extrato — decidido no app
-- (app/(tabs)/ranking.tsx), não aqui.

ALTER TABLE public.config_ranking
  DROP COLUMN IF EXISTS visivel_diretoria,
  DROP COLUMN IF EXISTS visivel_membros;
