-- Pre-cadastro, WhatsApp e ranking interclubes.

ALTER TABLE IF EXISTS public.desbravadores ADD COLUMN IF NOT EXISTS calca TEXT;
ALTER TABLE IF EXISTS public.membros ADD COLUMN IF NOT EXISTS calca TEXT;

CREATE TABLE IF NOT EXISTS public.pre_cadastro_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clube_id INTEGER NOT NULL REFERENCES public.clubes(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  titulo TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  expira_em TIMESTAMPTZ,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.pre_cadastros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clube_id INTEGER NOT NULL REFERENCES public.clubes(id) ON DELETE CASCADE,
  link_id UUID REFERENCES public.pre_cadastro_links(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  data_nascimento DATE,
  genero TEXT,
  email TEXT,
  contato TEXT,
  camisa TEXT,
  calca TEXT,
  nome_responsavel TEXT,
  contato_responsavel TEXT,
  observacoes TEXT,
  lgpd_aceito BOOLEAN NOT NULL DEFAULT FALSE,
  lgpd_aceito_em TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo','em_analise','aprovado','rejeitado','convertido')),
  convertido_membro_id INTEGER REFERENCES public.desbravadores(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.whatsapp_config (
  clube_id INTEGER PRIMARY KEY REFERENCES public.clubes(id) ON DELETE CASCADE,
  modo TEXT NOT NULL DEFAULT 'fila' CHECK (modo IN ('fila','cloud_api','desativado')),
  phone_number_id TEXT,
  business_account_id TEXT,
  access_token_secret_ref TEXT,
  ativo BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.whatsapp_fila (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clube_id INTEGER NOT NULL REFERENCES public.clubes(id) ON DELETE CASCADE,
  mensagem_id UUID REFERENCES public.mensagens_clube(id) ON DELETE SET NULL,
  destino_nome TEXT,
  destino_telefone TEXT NOT NULL,
  texto TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','enviado','erro','ignorado')),
  erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS public.ranking_clubes_requisitos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  programa_id INTEGER NOT NULL REFERENCES public.programas(id) ON DELETE CASCADE,
  escopo TEXT NOT NULL,
  item_codigo TEXT,
  requisito TEXT NOT NULL,
  responsavel TEXT,
  estrategia TEXT,
  onde_cadastrar TEXT,
  pontuacao_maxima NUMERIC NOT NULL DEFAULT 0,
  prazo DATE,
  observacoes TEXT,
  ordem INTEGER NOT NULL DEFAULT 100,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(programa_id, escopo, item_codigo)
);
CREATE TABLE IF NOT EXISTS public.ranking_clubes_pontuacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clube_id INTEGER NOT NULL REFERENCES public.clubes(id) ON DELETE CASCADE,
  requisito_id UUID NOT NULL REFERENCES public.ranking_clubes_requisitos(id) ON DELETE CASCADE,
  pontos_atuais NUMERIC NOT NULL DEFAULT 0,
  observacao TEXT,
  evidencias JSONB NOT NULL DEFAULT '[]'::jsonb,
  atualizado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(clube_id, requisito_id)
);
CREATE TABLE IF NOT EXISTS public.ranking_clubes_niveis (
  id SERIAL PRIMARY KEY,
  programa_id INTEGER REFERENCES public.programas(id) ON DELETE CASCADE,
  escopo TEXT NOT NULL,
  nome TEXT NOT NULL,
  pontos_min NUMERIC NOT NULL DEFAULT 0,
  pontos_max NUMERIC,
  estrelas INTEGER,
  cor TEXT DEFAULT '#1a3a5c',
  ordem INTEGER NOT NULL DEFAULT 100,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(programa_id, escopo, nome)
);

INSERT INTO public.pre_cadastro_links (clube_id, token, titulo, ativo)
VALUES (1, 'fonseca-dbv', 'Pré-cadastro Clube Fonseca', TRUE)
ON CONFLICT (token) DO UPDATE SET titulo=EXCLUDED.titulo, ativo=TRUE, updated_at=NOW();
INSERT INTO public.ranking_clubes_niveis (programa_id, escopo, nome, pontos_min, pontos_max, estrelas, cor, ordem) VALUES (1, 'SGC', '5 estrelas', 800, NULL, 5, '#f6c344', 1) ON CONFLICT (programa_id, escopo, nome) DO UPDATE SET pontos_min=EXCLUDED.pontos_min, pontos_max=EXCLUDED.pontos_max, estrelas=EXCLUDED.estrelas, cor=EXCLUDED.cor, ordem=EXCLUDED.ordem, ativo=TRUE;
INSERT INTO public.ranking_clubes_niveis (programa_id, escopo, nome, pontos_min, pontos_max, estrelas, cor, ordem) VALUES (1, 'SGC', '4 estrelas', 500, 799, 4, '#9ca3af', 2) ON CONFLICT (programa_id, escopo, nome) DO UPDATE SET pontos_min=EXCLUDED.pontos_min, pontos_max=EXCLUDED.pontos_max, estrelas=EXCLUDED.estrelas, cor=EXCLUDED.cor, ordem=EXCLUDED.ordem, ativo=TRUE;
INSERT INTO public.ranking_clubes_niveis (programa_id, escopo, nome, pontos_min, pontos_max, estrelas, cor, ordem) VALUES (1, 'SGC', '3 estrelas', 300, 499, 3, '#cd7f32', 3) ON CONFLICT (programa_id, escopo, nome) DO UPDATE SET pontos_min=EXCLUDED.pontos_min, pontos_max=EXCLUDED.pontos_max, estrelas=EXCLUDED.estrelas, cor=EXCLUDED.cor, ordem=EXCLUDED.ordem, ativo=TRUE;
INSERT INTO public.ranking_clubes_niveis (programa_id, escopo, nome, pontos_min, pontos_max, estrelas, cor, ordem) VALUES (1, 'SGC', '2 estrelas', 150, 299, 2, '#4f8edb', 4) ON CONFLICT (programa_id, escopo, nome) DO UPDATE SET pontos_min=EXCLUDED.pontos_min, pontos_max=EXCLUDED.pontos_max, estrelas=EXCLUDED.estrelas, cor=EXCLUDED.cor, ordem=EXCLUDED.ordem, ativo=TRUE;
INSERT INTO public.ranking_clubes_niveis (programa_id, escopo, nome, pontos_min, pontos_max, estrelas, cor, ordem) VALUES (1, 'SGC', '1 estrela', 0, 149, 1, '#78909c', 5) ON CONFLICT (programa_id, escopo, nome) DO UPDATE SET pontos_min=EXCLUDED.pontos_min, pontos_max=EXCLUDED.pontos_max, estrelas=EXCLUDED.estrelas, cor=EXCLUDED.cor, ordem=EXCLUDED.ordem, ativo=TRUE;
INSERT INTO public.ranking_clubes_niveis (programa_id, escopo, nome, pontos_min, pontos_max, estrelas, cor, ordem) VALUES (1, 'ARF', 'Diamante', 9000, NULL, 5, '#4dd0e1', 1) ON CONFLICT (programa_id, escopo, nome) DO UPDATE SET pontos_min=EXCLUDED.pontos_min, pontos_max=EXCLUDED.pontos_max, estrelas=EXCLUDED.estrelas, cor=EXCLUDED.cor, ordem=EXCLUDED.ordem, ativo=TRUE;
INSERT INTO public.ranking_clubes_niveis (programa_id, escopo, nome, pontos_min, pontos_max, estrelas, cor, ordem) VALUES (1, 'ARF', 'Ouro', 6500, 8999, 4, '#f6c344', 2) ON CONFLICT (programa_id, escopo, nome) DO UPDATE SET pontos_min=EXCLUDED.pontos_min, pontos_max=EXCLUDED.pontos_max, estrelas=EXCLUDED.estrelas, cor=EXCLUDED.cor, ordem=EXCLUDED.ordem, ativo=TRUE;
INSERT INTO public.ranking_clubes_niveis (programa_id, escopo, nome, pontos_min, pontos_max, estrelas, cor, ordem) VALUES (1, 'ARF', 'Prata', 4000, 6499, 3, '#9ca3af', 3) ON CONFLICT (programa_id, escopo, nome) DO UPDATE SET pontos_min=EXCLUDED.pontos_min, pontos_max=EXCLUDED.pontos_max, estrelas=EXCLUDED.estrelas, cor=EXCLUDED.cor, ordem=EXCLUDED.ordem, ativo=TRUE;
INSERT INTO public.ranking_clubes_niveis (programa_id, escopo, nome, pontos_min, pontos_max, estrelas, cor, ordem) VALUES (1, 'ARF', 'Bronze', 0, 3999, 2, '#cd7f32', 4) ON CONFLICT (programa_id, escopo, nome) DO UPDATE SET pontos_min=EXCLUDED.pontos_min, pontos_max=EXCLUDED.pontos_max, estrelas=EXCLUDED.estrelas, cor=EXCLUDED.cor, ordem=EXCLUDED.ordem, ativo=TRUE;
INSERT INTO public.ranking_clubes_niveis (programa_id, escopo, nome, pontos_min, pontos_max, estrelas, cor, ordem) VALUES (1, 'CAMPORI_DSA', '5 estrelas', 2000, NULL, 5, '#f6c344', 1) ON CONFLICT (programa_id, escopo, nome) DO UPDATE SET pontos_min=EXCLUDED.pontos_min, pontos_max=EXCLUDED.pontos_max, estrelas=EXCLUDED.estrelas, cor=EXCLUDED.cor, ordem=EXCLUDED.ordem, ativo=TRUE;
INSERT INTO public.ranking_clubes_niveis (programa_id, escopo, nome, pontos_min, pontos_max, estrelas, cor, ordem) VALUES (1, 'CAMPORI_DSA', '4 estrelas', 1500, 1999, 4, '#9ca3af', 2) ON CONFLICT (programa_id, escopo, nome) DO UPDATE SET pontos_min=EXCLUDED.pontos_min, pontos_max=EXCLUDED.pontos_max, estrelas=EXCLUDED.estrelas, cor=EXCLUDED.cor, ordem=EXCLUDED.ordem, ativo=TRUE;
INSERT INTO public.ranking_clubes_niveis (programa_id, escopo, nome, pontos_min, pontos_max, estrelas, cor, ordem) VALUES (1, 'CAMPORI_DSA', '3 estrelas', 1000, 1499, 3, '#cd7f32', 3) ON CONFLICT (programa_id, escopo, nome) DO UPDATE SET pontos_min=EXCLUDED.pontos_min, pontos_max=EXCLUDED.pontos_max, estrelas=EXCLUDED.estrelas, cor=EXCLUDED.cor, ordem=EXCLUDED.ordem, ativo=TRUE;
INSERT INTO public.ranking_clubes_niveis (programa_id, escopo, nome, pontos_min, pontos_max, estrelas, cor, ordem) VALUES (1, 'CAMPORI_DSA', '2 estrelas', 500, 999, 2, '#4f8edb', 4) ON CONFLICT (programa_id, escopo, nome) DO UPDATE SET pontos_min=EXCLUDED.pontos_min, pontos_max=EXCLUDED.pontos_max, estrelas=EXCLUDED.estrelas, cor=EXCLUDED.cor, ordem=EXCLUDED.ordem, ativo=TRUE;
INSERT INTO public.ranking_clubes_niveis (programa_id, escopo, nome, pontos_min, pontos_max, estrelas, cor, ordem) VALUES (1, 'CAMPORI_DSA', '1 estrela', 0, 499, 1, '#78909c', 5) ON CONFLICT (programa_id, escopo, nome) DO UPDATE SET pontos_min=EXCLUDED.pontos_min, pontos_max=EXCLUDED.pontos_max, estrelas=EXCLUDED.estrelas, cor=EXCLUDED.cor, ordem=EXCLUDED.ordem, ativo=TRUE;

WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'SGC', '1', 'Seguro anual', 'Luciano', NULL, NULL, 150, '2026-09-30', '00% de membros ativos inseridos no seguro anual, vigente dentro do S.G.C (a liderança não contabiliza pois possui Seguro Integrado com o Ministério Jovem)', 1, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 150 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'SGC', '2', 'Inventário de patrimônio', 'Fernando / Sloan', NULL, NULL, 25, '2026-09-30', 'Quantidade baseada em 30% da quantidade total de membros ativos (Exemplo: 100 membros = 30 itens cadastrados)', 2, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 25 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'SGC', '3', 'Agenda de atividades', 'Luciano', NULL, 'Secretaria -> Agenda', 50, '2026-09-30', '48 atividades cadastradas no ano vigente', 3, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 50 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'SGC', '4', 'Documentos', 'Millena', NULL, 'Secretaria -> Documentos', 25, '2026-09-30', 'Cadastro de ATAs, Cartas, Saídas, etc', 4, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 25 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'SGC', '5', 'Tesouraria', 'Fernando', NULL, NULL, 50, '2026-09-30', 'Mínimo de 48 itens de contas a pagar ou a receber, para o ano vigente (não é necessário a conta estar quitada, e sim, ser apenas uma previsão de gastos ou receita)', 5, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 50 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'SGC', '6', 'Cantinho da Unidade (Ranking Unidades)', 'Conselheiros / Luciano', NULL, NULL, 150, '2026-09-30', '100% dos membros ativos com dados preenchidos no Relatório do Cantinho da Unidade no Portal Encontre um Clube, no acesso do Conselheiro(a)', 6, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 150 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'SGC', '7', 'Especialidades', 'Millena / Luciano', NULL, NULL, 25, '2026-09-30', 'No mínimo 05 especialidades por cada membro ativo', 7, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 1.12 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'SGC', '8', 'Classes', 'Millena / Luciano', NULL, NULL, 25, '2026-09-30', 'No mínimo 01 Classe por cada membro ativo (a liderança não contabiliza)', 8, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0.71 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'SGC', '9', 'Cartões de Classes', 'Conselheiros / Luciano', NULL, NULL, 100, '2026-09-30', '100% dos membros ativos (exceto liderança) com preenchimento (parcial) dos requisitos das classes via Cantinho da Unidade (no Portal Encontre um Clube, via conselheiro)', 9, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 11.43 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'SGC', '10', 'Atualização de cadastros', 'Millena / Luciano', NULL, NULL, 50, '2026-09-30', '100% dos membros ativos com cadastros revisados e atualizados no ano vigente', 10, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 50 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'SGC', '11', 'Ficha médica', 'Millena', NULL, NULL, 75, '2026-09-30', '100% dos membros ativos com suas respectivas fichas médicas atualizadas', 11, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 75 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'SGC', '12', 'Dados do clube', 'Mariane / Luciano', NULL, NULL, 25, '2026-09-30', 'Dados do Clube atualizado, principalmente coordenadas de geolocalização e texto do histórico do Clube', 12, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 25 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'SGC', '13', 'Ranking do Campo', 'Millena / Luciano', NULL, NULL, 150, '2026-09-30', 'Clube preenchendo 100% do Ranking do Campo. O Campo deve ter no mínimo 01 Ranking configurado para que os Clubes preencham, com no mínimo 20 requisitos/perguntas', 13, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 150 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'SGC', '14', 'Termos de Adesão', 'Millena / Luciano', NULL, NULL, 50, '2026-09-30', '100% dos membros ativos. As autorizações coletadas via SGC, Portal Encontre um Clube e Portal de Eventos)', 14, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 50 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'SGC', '15', 'Acessos do Secretário do Clube', 'Millena', NULL, NULL, 50, '2026-09-30', 'O Clube precisa ter um Secretário(a) ativo e com no mínimo 48 acessos por ano (média de 4 acessos por mês)', 15, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 50 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '20', 'MEGA CLUBE REGIONAL - ABRIL', NULL, NULL, NULL, 50, '2026-04-30', 'O Clube deverá enviar pelo menos 3 membros da diretoria para o mega clube macrorregional', 1, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 50 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '34', 'REUNIÃO DE PAIS 1º TRIMESTRE', 'Luciano / Millena', NULL, NULL, 100, '2026-04-30', 'Realizar uma reunião com os pais no primeiro trimestre', 2, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 100 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '21', 'MEGA CLUBE REGIONAL - MAIO', NULL, NULL, NULL, 50, '2026-05-31', 'O Clube deverá enviar pelo menos 3 membros da diretoria para o mega clube macrorregional', 3, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 50 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '32', 'INSCRIÇÃO NO CAMPORI', 'Luciano / Fernando', NULL, NULL, 300, '2026-05-31', 'Inscrever o Clube em pelo menos 1 dos Camporis disponíveis (ARF ou DSA) nos prazos estabelecidos', 4, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 300 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '4', 'DESBRAVADOR POR 1 DIA', NULL, NULL, NULL, 200, '2026-06-30', 'Cada Clube deverá organizar e realizar em local público o desafio do Desbravador por 1 dia. Todo o Clube uniformizado fará uma exposição criativa das atividades durante uma manhã ou tarde em uma praça, feira, escola ou outro local apropriado', 5, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 200 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '16', 'PARTICIPAÇÃO NA CONVENÇÃO', NULL, NULL, NULL, 200, '2026-06-30', 'O Clube deve enviar pelo menos um representante na convenção MDA', 6, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 200 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '24', 'CALEBE DE LENÇO', NULL, NULL, NULL, 200, '2026-06-30', 'O Clube deve participar do Calebe de lenço', 7, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 200 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '27', 'SEMANA SANTA 2026', NULL, NULL, NULL, 200, '2026-06-30', 'O Clube deve participar de pelo menos 3 dias com o uniforme (A, B ou C) do evangelismo da Semana Santa - 28/03 a 04/04', 8, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 200 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '19', 'MEGA CLUBE MACRORREGIONAL - JUNHO/ JULHO', NULL, NULL, NULL, 75, '2026-07-31', 'O Clube deverá enviar pelo menos 3 membros da diretoria para o mega clube macrorregional', 9, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '33', 'PLANEJAMENTO ANUAL', 'Luciano / Millena', NULL, NULL, 480, '2026-07-31', 'Planejamento anual do Clube detalhado com no mínimo, 4 páginas (uma por trimestre) contendo atividades, responsáveis, locais das atividades, data do Voto da Comissão da Igreja aprovando o Planejamento e cadastrar o Planejamento no SGC', 10, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 480 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '35', 'REUNIÃO DE PAIS 2º TRIMESTRE', 'Luciano / Millena', NULL, NULL, 100, '2026-07-31', 'Realizar uma reunião com os pais no segundo trimestre (ABRIL - MAIO - JUN)', 11, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 100 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '37', 'REUNIÃO SEMANAL 1º SEMESTRE', 'Luciano / Millena', NULL, NULL, 240, '2026-07-31', 'Realizar pelo menos 12 reuniões no primeiro semestre', 12, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 240 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '44', 'VISITA DO DISTRITAL 1º SEMESTRE', NULL, NULL, NULL, 150, '2026-07-31', 'Marcar uma visita do Distrital ao Clube, onde o coordenador distrital deve participar da reunião com uma meditação, recreação ou outras atividades', 13, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 150 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '47', 'VISITA DO REGIONAL 1º SEMESTRE', NULL, NULL, NULL, 150, '2026-07-31', 'Marcar uma visita do Regional ao Clube, onde o coordenador regional deve participar da reunião com uma meditação, recreação ou outras atividades', 14, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 150 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '18', 'MEGA CLUBE MACRORREGIONAL - AGOSTO', NULL, NULL, NULL, 75, '2026-08-31', 'O Clube deverá enviar pelo menos 3 membros da diretoria para o mega clube macrorregional', 15, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '23', 'MEGA CLUBE REGIONAL - SETEMBRO', NULL, NULL, NULL, 50, '2026-09-30', 'O Clube deverá enviar pelo menos 3 membros da diretoria para o mega clube macrorregional', 16, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '40', 'CLUBE 5 ESTRELAS', 'Luciano / Millena', NULL, NULL, 400, '2026-10-15', 'O Clube deve conquistar a classificação 5 estrelas definitiva (a partir de 15 de outubro)', 17, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '3', 'CURSO DE LEITURA', 'Conselheiros / Luciano', 'Lançar pontuação individual, para unidade e para os conselheiros', NULL, 300, '2026-10-30', 'Leitura do livro do Curso de Leitura dos Desbravadores, mínimo de 40% do Clube (23) com a leitura terminada até 30/10/2026', 18, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '9', 'BATISMO DA PRIMAVERA', 'Jean / Sloan', NULL, NULL, 700, '2026-10-31', 'Participar no Batismo da Primavera com Desbravadores ou batismos por influência do Clube - CUMPRIMENTO EM SETEMBRO', 19, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '10', 'CLASSE BÍBLICA', 'Jean', NULL, NULL, 520, '2026-10-31', 'Classe bíblica do Clube funcionando semanalmente para todos os Desbravadores e adultos do Clube (batizados ou não)', 20, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 520 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '14', 'CARIOCÃO', NULL, NULL, NULL, 500, '2026-10-31', 'Ter pelo menos um representante do Clube participando presencialmente do Cariocão 2026 - CUMPRIMENTO EM SETEMBRO', 21, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '22', 'MEGA CLUBE REGIONAL - OUTUBRO', NULL, NULL, NULL, 50, '2026-10-31', 'O Clube deverá enviar pelo menos 3 membros da diretoria para o mega clube macrorregional', 22, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '26', 'QUEBRANDO O SILÊNCIO', NULL, NULL, NULL, 200, '2026-10-31', 'O Clube deve participar uniformizado do Quebrando o Silêncio - 22/08 (de uniforme de atividade)', 23, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '30', 'DIA MUNDIAL DOS DESBRAVADORES', NULL, NULL, NULL, 400, '2026-10-31', 'Realizar o programa na Igreja em comemoração ao Dia Mundial dos Desbravadores', 24, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '36', 'REUNIÃO DE PAIS 3º TRIMESTRE', 'Luciano / Millena', NULL, NULL, 100, '2026-10-31', 'Realizar uma reunião de pais no 3º trimestre (JUL-AGO-SET)', 25, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '39', 'SEMANA DO LENÇO', NULL, NULL, NULL, 400, '2026-10-31', 'De 13 a 19/09/2026 cada Desbravador e cada líder será desafiado a usar seu lenço durante esta semana em suas atividades diárias', 26, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '1', 'ACAMPAMENTO DE CLASSES', NULL, NULL, NULL, 350, '2026-11-30', 'Realizar um acampamento de final de semana para concluir os requisitos das Classes', 27, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '2', 'CONDECORAÇÃO DE ESPECIALIDADES', NULL, NULL, NULL, 300, '2026-11-30', '70% do Clube condecorado com, pelo menos, 4 Especialidades até 30/11/2026, devidamente registrado no SGC (42 pessoas)', 28, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '5', 'FANFARRA/ORDEM UNIDA', NULL, NULL, NULL, 300, '2026-11-30', 'Ter uma Fanfarra com no mínimo 20 instrumentos; ou, fazer uma apresentação de Ordem Unida criativa em um desfile da cidade ou evento público, com no mínimo de 2 Unidades', 29, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '6', 'INVESTIDURA DE CLASSES AVANÇADAS', NULL, NULL, NULL, 300, '2026-11-30', 'Investidura de 30% do Clube em Classes Avançadas até 30/11/2026, devidamente registrado no SGC (10 desbravadores)', 30, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '7', 'INVESTIDURA DE CLASSES REGULARES', NULL, NULL, NULL, 300, '2026-11-30', 'Investidura de, pelo menos, 70% do Clube em Classes Regulares até 30/11/2026, devidamente registrado no SGC (23 pessoas)', 31, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '8', 'ANO BÍBLICO', 'Conselheiros / Luciano', 'Lançar pontuação individual, para unidade e para os conselheiros', NULL, 200, '2026-11-30', 'Cada Desbravador fazendo o Ano Bíblico. Mínimo de 50% do Clube com o Ano Bíblico do Desbravador ou Juvenil em dia até 30/11/2026 (30 pessoas)', 32, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '11', 'ESPECIALIDADE DE MORDOMIA', 'Sloan', NULL, NULL, 200, '2026-11-30', 'Cada Desbravador do Clube ter concluído a Especialidade de Mordomia até 30/11/2026', 33, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '12', 'RESGATE DE LENÇO', NULL, NULL, NULL, 400, '2026-11-30', 'Projeto de resgate de ex-adventistas que foram Desbravadores ou Aventureiros. Pode-se organizar uma visita, serenata, convite para assistir o Dia Mundial dos Desbravadores e voltar para os braços de Jesus', 34, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '13', 'ATIVIDADE COMUNITÁRIA', NULL, NULL, NULL, 250, '2026-11-30', 'Clube deve realizar pelo menos uma atividade comunitária', 35, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 250 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '15', 'CLUBE PIONEIRO', NULL, NULL, NULL, 300, '2026-11-30', 'Visitar outra Igreja Adventista ou Grupo e ajudar na fundação ou reabertura de um novo Clube', 36, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '17', 'LIDERANÇA', 'Luciano', 'Criar grupo no Zap para motivar', NULL, 380, '2026-11-30', 'Ter pelo menos 50% dos membros concluindo itens das classes de lideranças excetuando os membros que já chegaram a Líder Master Avançado ou concluíram alguma Classe de liderança em 2025 - Temos 8/10', 37, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '25', 'IMPACTO ESPERANÇA', NULL, NULL, NULL, 200, '2026-11-30', 'O Clube deve participar uniformizado do Impacto esperança em setembro (JÁ FIZEMOS)', 38, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '28', 'VIDA POR VIDAS', 'Cessia', NULL, NULL, 200, '2026-11-30', 'A diretoria do Clube deve se organizar para aqueles que estiverem aptos realizem uma doação de sangue no hemocentro local (pelo menos 1 doação por Clube)', 39, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 200 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '29', 'ATIVIDADE ECOLÓGICA', 'Valdir', 'Participar do Muteco', NULL, 250, '2026-11-30', 'O Clube deve realizar pelo menos uma atividade ecológica (que não seja caminhada)', 40, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '31', 'HISTÓRIA DO CLUBE', 'Mariane / Millena / Yann / Sloan', 'Fazer um video (documentário) entrevistando antigos diretores e antigos DBVs do clube, incluindo pastores que passaram pelo clube do Fonseca contando histórias engraçadas, histórias marcantes, histórias de conversão.', NULL, 300, '2026-11-30', 'Escrever ou atualizar um resumo do histórico do Clube contendo:
Data de Fundação, Local, Fundador ou fundadores, número de Desbravadores quando começou, informação se funcionou todo o tempo ou ficou sem atividade por algum tempo (neste caso, por quanto tempo), principais atividades desenvolvidas pelo Clube, Camporis que participou, fotos históricas do Clube, testemunho de um pioneiro do Clube (um parágrafo), documentos que comprovem o início do Clube (se houver). Realizar uma exposição dessa história no Dia Mundial dos Desbravadores na Igreja local.', 41, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 300 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '38', 'REUNIÃO SEMANAL 2º SEMESTRE', 'Luciano / Millena', NULL, NULL, 240, '2026-11-30', 'Realizar pelo menos 15 reuniões no segundo semestre', 42, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '41', 'SEGURO SPA', 'Luciano / Millena', NULL, NULL, 200, '2026-11-30', 'Todos os participantes do Clube com seguro anual', 43, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 200 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '42', 'VISITA A AUTORIDADES', 'Luciano', 'Visita ao 3º GBM', NULL, 250, '2026-11-30', 'Realizar, no mínimo, 1 visita, sendo ela a autoridades ou Instituições locais (Prefeito, Vereador, Juiz, Delegado, Bombeiros, Delegacia, Câmara de vereadores)', 44, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 250 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '43', 'VISITA DO ANCIÃO', NULL, NULL, NULL, 150, '2026-11-30', 'Marcar uma visita do ancião ao Clube, onde o mesmo deve participar da reunião com uma meditação, recreação ou outras atividades', 45, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 150 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '45', 'VISITA DO DISTRITAL 2º SEMESTRE', NULL, NULL, NULL, 150, '2026-11-30', 'Marcar uma visita do Distrital ao Clube, onde o coordenador distrital deve participar da reunião com uma meditação, recreação ou outras atividades', 46, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '46', 'VISITA DO PASTOR', NULL, NULL, NULL, 150, '2026-11-30', 'Marcar uma visita do pastor distrital ao Clube, onde o mesmo deve participar da reunião com uma meditação, recreação ou outras atividades', 47, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 150 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'ARF', '48', 'VISITA DO REGIONAL 2º SEMESTRE', NULL, NULL, NULL, 150, '2026-11-30', 'Marcar uma visita do Regional ao Clube, onde o coordenador regional deve participar da reunião com uma meditação, recreação ou outras atividades', 48, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'CAMPORI_DSA', '1', 'Dia Mundial dos Desbravadores', NULL, NULL, NULL, 100, NULL, 'Realizar o programa na Igreja em comemoração ao Dia Mundial dos Desbravadores.', 1, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'CAMPORI_DSA', '2', 'Classe bíblica', NULL, NULL, NULL, 350, NULL, 'Classe bíblica do Clube funcionando semanalmente de Mai-Set/2026 para todos os Desbravadores e adultos do Clube (batizados ou não).', 2, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 350 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'CAMPORI_DSA', '3', 'Planejamento Anual', NULL, NULL, NULL, 50, NULL, 'Planejamento anual do Clube detalhado com no mínimo, 4 páginas (uma por trimestre) contendo atividades, responsáveis, locais das atividades, data do Voto da Comissão da Igreja aprovando o Planejamento e cadastrar o Planejamento no SGC.', 3, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 50 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'CAMPORI_DSA', '4', 'Ranking do Campo', NULL, NULL, NULL, 100, NULL, 'Preencher o ranking da Associação/Missão no SGC.', 4, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'CAMPORI_DSA', '5', 'Reunião de pais', NULL, NULL, NULL, 50, NULL, 'Reuniões com os pais dos Desbravadores (mínimo 2 durante o ano).', 5, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 50 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'CAMPORI_DSA', '6', 'Reunião semanal', NULL, NULL, NULL, 70, NULL, 'Reunião Semanal do Clube (mínimo 3 reuniões por mês).', 6, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 70 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'CAMPORI_DSA', '7', 'Receber visita 1', NULL, NULL, NULL, 50, NULL, 'Visita do Regional no Clube.', 7, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 50 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'CAMPORI_DSA', '8', 'Receber visita 2', NULL, NULL, NULL, 50, NULL, 'Visita do Pastor distrital ao Clube.', 8, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 50 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'CAMPORI_DSA', '9', 'Receber visita 3', NULL, NULL, NULL, 50, NULL, 'Visita de um Ancião da Igreja ao Clube.', 9, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 50 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'CAMPORI_DSA', '10', 'Ano Bíblico', NULL, NULL, NULL, 200, NULL, 'Cada Desbravador fazendo o Ano Bíblico. Mínimo de 50% do Clube com o Ano Bíblico do Desbravador ou Juvenil em dia até 30/11/2026.', 10, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'CAMPORI_DSA', '11', 'Profissional de Saúde', NULL, NULL, NULL, 400, NULL, 'Inscrição do profissional de saúde: Médico – 400 /Enfermeiro – 300/ Técnico ou Auxiliar de Enfermagem – 250/ Fisioterapeuta/Dentista/Psicólogo – 200.', 11, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 400 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'CAMPORI_DSA', '12', 'Batismo da Primavera', NULL, NULL, NULL, 350, NULL, 'Participar no Batismo da Primavera com Desbravadores ou pais sendo batizados. (informar quantos foram batizados até 30/10/2026.', 12, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'CAMPORI_DSA', '13', 'Curso de Leitura', NULL, NULL, NULL, 100, NULL, 'Leitura do livro do Curso de Leitura dos Desbravadores, mínimo de 40% do Clube com a leitura terminada até 30/10/2026.', 13, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'CAMPORI_DSA', '14', 'Clube uniformizado na igreja', NULL, NULL, NULL, 50, NULL, 'Clube participando uniformizado em, no mínimo, 3 dos seguintes eventos: Evangelismo Semana Santa; Impacto Esperança, Semana da Família; Semana Jovem; Semana da Esperança; Evangelismo Voz do Juvenil e Evangelismo Público.', 14, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 50 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'CAMPORI_DSA', '15', 'Clube uniformizado em projetos', NULL, NULL, NULL, 50, NULL, 'Clube participando uniformizado em 2 dos Projetos Comunitários, podendo ser: Vida por Vidas, Quebrando o Silêncio, visita a orfanato, asilo ou creche, plantio de árvores, limpeza de praças ou escolas, outros.', 15, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 50 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'CAMPORI_DSA', '16', 'Visitas especiais', NULL, NULL, NULL, 80, NULL, 'Realizar, no mínimo, 2 visitas, sendo elas a autoridades ou Instituições locais (Prefeito, Vereador, Juiz, Delegado, Bombeiros, Delegacia, Câmara de vereadores).', 16, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 40 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'CAMPORI_DSA', '17', 'Acampamento', NULL, NULL, NULL, 100, NULL, 'Realizar um acampamento de final de semana para concluir os requisitos das Classes.', 17, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'CAMPORI_DSA', '18', 'Investidura de Classes Regulares', NULL, NULL, NULL, 150, NULL, 'Investidura de, pelo menos, 70% do Clube em Classes Regulares até 30/11/2026, devidamente registrado no SGC.', 18, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'CAMPORI_DSA', '19', 'Investidura de Classes Avançadas', NULL, NULL, NULL, 100, NULL, 'Investidura de 30% do Clube em Classes Avançadas até 30/11/2026, devidamente registrado no SGC.', 19, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'CAMPORI_DSA', '20', 'Condecoração de Especialidades', NULL, NULL, NULL, 150, NULL, '70% do Clube condecorado com, pelo menos, 4 Especialidades até 30/11/2026, devidamente registrado no SGC.', 20, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'CAMPORI_DSA', '21', 'Fanfarra/Ordem Unida', NULL, NULL, NULL, 50, NULL, 'Ter uma Fanfarra com no mínimo 20 instrumentos; ou, fazer uma apresentação de Ordem Unida criativa em um desfile da cidade ou evento público, com no mínimo de 2 Unidades.', 21, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 50 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'CAMPORI_DSA', '22', 'História do Clube', NULL, NULL, NULL, 50, NULL, 'Escrever ou atualizar um resumo do histórico do Clube contendo: Data de Fundação, Local, Fundador ou fundadores, número de Desbravadores quando começou, informação se funcionou todo o tempo ou ficou sem atividade por algum tempo (neste caso, por quanto tempo), principais atividades desenvolvidas pelo Clube, Camporis que participou, fotos históricas do Clube, testemunho de um pioneiro do Clube (um parágrafo), documentos que comprovem o início do Clube (se houver). Realizar uma exposição dessa história no Dia Mundial dos Desbravadores na Igreja local.', 22, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 50 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'CAMPORI_DSA', '23', 'Especialidade de Mordomia', NULL, NULL, NULL, 50, NULL, 'Cada Desbravador do Clube ter concluído a Especialidade de Mordomia até 30/11/2026.', 23, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'CAMPORI_DSA', '24', 'Desbravador por 1 dia', NULL, NULL, NULL, 50, NULL, 'Cada Clube deverá organizar e realizar em local público o desafio do Desbravador por 1 dia. Todo o Clube uniformizado fará uma exposição criativa das atividades durante uma manhã ou tarde em uma praça, feira, escola ou outro local apropriado.', 24, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 50 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'CAMPORI_DSA', '25', 'Semana do Lenço', NULL, NULL, NULL, 100, NULL, 'De 13 a 19/09/2026 cada Desbravador e cada líder será desafiado a usar seu lenço durante esta semana em suas atividades diárias como: escola, parque, supermercado, universidade, local de trabalho, etc.', 25, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'CAMPORI_DSA', '26', 'Resgate de lenço', NULL, NULL, NULL, 100, NULL, 'Projeto de resgate de ex-adventistas que foram Desbravadores ou Aventureiros. Pode-se organizar uma visita, serenata, convite para assistir o Dia Mundial dos Desbravadores e voltar para os braços de Jesus.', 26, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'CAMPORI_DSA', '27', 'Clube Pioneiro', NULL, NULL, NULL, 150, NULL, 'Visitar outra Igreja Adventista ou Grupo e ajudar na fundação ou reabertura de um novo Clube.', 27, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'CAMPORI_DSA', '28', 'Seguro SPA', NULL, NULL, NULL, 100, NULL, 'Todos os participantes do Clube com seguro anual.', 28, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 100 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();
WITH req AS (
  INSERT INTO public.ranking_clubes_requisitos (programa_id, escopo, item_codigo, requisito, responsavel, estrategia, onde_cadastrar, pontuacao_maxima, prazo, observacoes, ordem, ativo)
  VALUES (1, 'CAMPORI_DSA', '29', 'Clube 5 estrelas', NULL, NULL, NULL, 400, NULL, 'Avaliação do Clube pelo Ranking do SGC de 2026', 29, TRUE)
  ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET requisito=EXCLUDED.requisito, responsavel=EXCLUDED.responsavel, estrategia=EXCLUDED.estrategia, onde_cadastrar=EXCLUDED.onde_cadastrar, pontuacao_maxima=EXCLUDED.pontuacao_maxima, prazo=EXCLUDED.prazo, observacoes=EXCLUDED.observacoes, ordem=EXCLUDED.ordem, ativo=TRUE, updated_at=NOW()
  RETURNING id
)
INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT 1, id, 0 FROM req
ON CONFLICT (clube_id, requisito_id) DO UPDATE SET pontos_atuais=EXCLUDED.pontos_atuais, updated_at=NOW();

ALTER TABLE public.pre_cadastro_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pre_cadastros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_fila ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ranking_clubes_requisitos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ranking_clubes_pontuacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ranking_clubes_niveis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pre_cadastro_links_public_select" ON public.pre_cadastro_links;
CREATE POLICY "pre_cadastro_links_public_select" ON public.pre_cadastro_links FOR SELECT TO anon, authenticated USING (ativo = TRUE AND (expira_em IS NULL OR expira_em > NOW()));
DROP POLICY IF EXISTS "pre_cadastro_links_admin_all" ON public.pre_cadastro_links;
CREATE POLICY "pre_cadastro_links_admin_all" ON public.pre_cadastro_links FOR ALL TO authenticated USING (public.current_user_can_admin_clube(clube_id)) WITH CHECK (public.current_user_can_admin_clube(clube_id));
DROP POLICY IF EXISTS "pre_cadastros_public_insert" ON public.pre_cadastros;
CREATE POLICY "pre_cadastros_public_insert" ON public.pre_cadastros FOR INSERT TO anon, authenticated WITH CHECK (
  lgpd_aceito = TRUE
  AND EXISTS (
    SELECT 1 FROM public.pre_cadastro_links l
    WHERE l.id = link_id
      AND l.clube_id = pre_cadastros.clube_id
      AND l.ativo = TRUE
      AND (l.expira_em IS NULL OR l.expira_em > NOW())
  )
);
DROP POLICY IF EXISTS "pre_cadastros_admin_all" ON public.pre_cadastros;
CREATE POLICY "pre_cadastros_admin_all" ON public.pre_cadastros FOR ALL TO authenticated USING (public.current_user_can_admin_clube(clube_id)) WITH CHECK (public.current_user_can_admin_clube(clube_id));
DROP POLICY IF EXISTS "whatsapp_config_admin_all" ON public.whatsapp_config;
CREATE POLICY "whatsapp_config_admin_all" ON public.whatsapp_config FOR ALL TO authenticated USING (public.current_user_can_admin_clube(clube_id)) WITH CHECK (public.current_user_can_admin_clube(clube_id));
DROP POLICY IF EXISTS "whatsapp_fila_admin_all" ON public.whatsapp_fila;
CREATE POLICY "whatsapp_fila_admin_all" ON public.whatsapp_fila FOR ALL TO authenticated USING (public.current_user_can_admin_clube(clube_id)) WITH CHECK (public.current_user_can_admin_clube(clube_id));
DROP POLICY IF EXISTS "ranking_clubes_requisitos_select" ON public.ranking_clubes_requisitos;
CREATE POLICY "ranking_clubes_requisitos_select" ON public.ranking_clubes_requisitos FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "ranking_clubes_requisitos_admin_all" ON public.ranking_clubes_requisitos;
CREATE POLICY "ranking_clubes_requisitos_admin_all" ON public.ranking_clubes_requisitos FOR ALL TO authenticated USING (public.current_user_is_admin_ti()) WITH CHECK (public.current_user_is_admin_ti());
DROP POLICY IF EXISTS "ranking_clubes_pontuacoes_select_contexto" ON public.ranking_clubes_pontuacoes;
CREATE POLICY "ranking_clubes_pontuacoes_select_contexto" ON public.ranking_clubes_pontuacoes FOR SELECT TO authenticated USING (public.current_user_has_clube(clube_id) OR public.current_user_is_admin_ti());
DROP POLICY IF EXISTS "ranking_clubes_pontuacoes_admin_all" ON public.ranking_clubes_pontuacoes;
CREATE POLICY "ranking_clubes_pontuacoes_admin_all" ON public.ranking_clubes_pontuacoes FOR ALL TO authenticated USING (public.current_user_can_admin_clube(clube_id)) WITH CHECK (public.current_user_can_admin_clube(clube_id));
DROP POLICY IF EXISTS "ranking_clubes_niveis_select" ON public.ranking_clubes_niveis;
CREATE POLICY "ranking_clubes_niveis_select" ON public.ranking_clubes_niveis FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "ranking_clubes_niveis_admin_all" ON public.ranking_clubes_niveis;
CREATE POLICY "ranking_clubes_niveis_admin_all" ON public.ranking_clubes_niveis FOR ALL TO authenticated USING (public.current_user_is_admin_ti()) WITH CHECK (public.current_user_is_admin_ti());
