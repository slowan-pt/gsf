-- Corrige a perda de descrição ao lançar mais de um "ponto extra" pro mesmo
-- membro na mesma data: hoje isso soma tudo num único campo
-- pontuacoes.pontos_extras e sobrescreve pontuacoes.observacao com a última
-- descrição digitada (ex.: lançar "Ano Bíblico" 300 e depois "Calebe" 300 dá
-- 600 pts com a descrição só "Calebe", perdendo a primeira).
--
-- Cria uma tabela nova com UMA LINHA POR LANÇAMENTO (mesmo padrão já usado em
-- pontuacoes_custom, que nunca teve esse problema). pontuacoes.pontos_extras
-- continua existindo e sendo mantido em dia pelo app (soma/subtrai a cada
-- lançamento/edição/exclusão) só para não quebrar os cálculos de total que já
-- leem essa coluna (ranking, extrato nativo offline etc.) — mas ela deixa de
-- ser a fonte usada para MOSTRAR a descrição: quem mostra o detalhe agora é
-- esta tabela.
CREATE TABLE IF NOT EXISTS public.pontuacoes_extras_itens (
  id BIGSERIAL PRIMARY KEY,
  clube_id INTEGER NOT NULL REFERENCES public.clubes(id) ON DELETE CASCADE,
  dbv_id INTEGER NOT NULL REFERENCES public.desbravadores(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  pontos INTEGER NOT NULL,
  observacao TEXT,
  lancado_por TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pontuacoes_extras_itens_dbv ON public.pontuacoes_extras_itens(dbv_id);
CREATE INDEX IF NOT EXISTS idx_pontuacoes_extras_itens_data ON public.pontuacoes_extras_itens(clube_id, data);

ALTER TABLE public.pontuacoes_extras_itens ENABLE ROW LEVEL SECURITY;

-- Mesmo modelo de permissão já usado em pontuacoes: qualquer autenticado lê,
-- só admin escreve (a tela de Extras já esconde a aba "Adicionar" de quem
-- não tem a permissão gerenciar_pontuacao).
DROP POLICY IF EXISTS "authenticated_select_pontuacoes_extras_itens" ON public.pontuacoes_extras_itens;
CREATE POLICY "authenticated_select_pontuacoes_extras_itens"
ON public.pontuacoes_extras_itens FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "admin_all_pontuacoes_extras_itens" ON public.pontuacoes_extras_itens;
CREATE POLICY "admin_all_pontuacoes_extras_itens"
ON public.pontuacoes_extras_itens FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());
