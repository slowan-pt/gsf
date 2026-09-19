-- Quais anos contam pro ranking. Vazio ('{}') = só o ano corrente, resolvido
-- em tempo de execução (ver src/lib/rankingConfig.ts::anosEfetivosRanking) —
-- assim o "ano corrente" nunca precisa ser reconfigurado virada de ano.
ALTER TABLE public.config_ranking
  ADD COLUMN IF NOT EXISTS anos_ranking INTEGER[] NOT NULL DEFAULT '{}';
