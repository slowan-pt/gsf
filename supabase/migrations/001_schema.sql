-- Habilitar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de perfis de usuário
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nome TEXT NOT NULL,
  perfil TEXT NOT NULL CHECK (perfil IN ('admin_geral', 'admin_diretoria', 'desbravador')),
  unidade_id INTEGER,
  dbv_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unidades
CREATE TABLE IF NOT EXISTS unidades (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  codigo_clube INTEGER,
  senha_unidade INTEGER
);

-- Desbravadores
CREATE TABLE IF NOT EXISTS desbravadores (
  id SERIAL PRIMARY KEY,
  idx INTEGER,
  id_sgc TEXT,
  nome TEXT NOT NULL,
  data_nascimento DATE,
  idade INTEGER,
  genero TEXT CHECK (genero IN ('M', 'F')),
  unidade_id INTEGER REFERENCES unidades(id),
  unidade_nome TEXT,
  cargo TEXT,
  contato TEXT,
  email TEXT,
  camisa TEXT,
  campori_dsa BOOLEAN DEFAULT FALSE,
  nome_responsavel TEXT,
  contato_responsavel TEXT,
  foto_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documentos
CREATE TABLE IF NOT EXISTS documentos (
  id SERIAL PRIMARY KEY,
  dbv_id INTEGER NOT NULL REFERENCES desbravadores(id),
  rg TEXT,
  cpf TEXT,
  rg_resp TEXT,
  cartao_sus TEXT,
  cartao_plano TEXT,
  ficha_saude TEXT,
  carteira_vacinacao TEXT,
  laudo_medico TEXT,
  ficha_reg TEXT,
  comp_residencia TEXT,
  aut_saida TEXT,
  aut_viagem TEXT,
  ri_assinado TEXT,
  foto TEXT,
  ant_criminais TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Progresso nas classes
CREATE TABLE IF NOT EXISTS progresso_classes (
  id SERIAL PRIMARY KEY,
  dbv_id INTEGER NOT NULL UNIQUE REFERENCES desbravadores(id),
  amigo TEXT,
  amigo_nat TEXT,
  companheiro TEXT,
  comp_exc TEXT,
  pesquisador TEXT,
  pesquisador_cb TEXT,
  pioneiro TEXT,
  pioneiro_nf TEXT,
  excursionista TEXT,
  exc_mata TEXT,
  guia TEXT,
  guia_exp TEXT,
  agrupada TEXT,
  lider TEXT,
  lider_master TEXT,
  lider_ma TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Especialidades (uma linha por DBV por especialidade)
CREATE TABLE IF NOT EXISTS especialidades (
  id SERIAL PRIMARY KEY,
  dbv_id INTEGER NOT NULL REFERENCES desbravadores(id),
  nome TEXT NOT NULL,
  status TEXT CHECK (status IN ('OK', 'NOK')),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (dbv_id, nome)
);

-- Eventos do calendário
CREATE TABLE IF NOT EXISTS eventos (
  id SERIAL PRIMARY KEY,
  data TEXT,
  horario TEXT,
  local TEXT,
  atividade TEXT NOT NULL,
  responsavel TEXT,
  apoio TEXT,
  material TEXT,
  observacoes TEXT,
  semestre INTEGER DEFAULT 1
);

-- Pontuações
CREATE TABLE IF NOT EXISTS pontuacoes (
  id SERIAL PRIMARY KEY,
  dbv_id INTEGER NOT NULL REFERENCES desbravadores(id),
  data DATE NOT NULL,
  presenca BOOLEAN DEFAULT FALSE,
  pontualidade BOOLEAN DEFAULT FALSE,
  material BOOLEAN DEFAULT FALSE,
  uniforme BOOLEAN DEFAULT FALSE,
  bom_biblia INTEGER DEFAULT 0,
  pontos_extras INTEGER DEFAULT 0,
  classe_biblica INTEGER DEFAULT 0,
  especialidade INTEGER DEFAULT 0,
  pgm_especial INTEGER DEFAULT 0,
  atividade_unidade INTEGER DEFAULT 0,
  observacao TEXT,
  lancado_por TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (dbv_id, data)
);

-- Configuração do Campori
CREATE TABLE IF NOT EXISTS config_campori (
  id INTEGER PRIMARY KEY DEFAULT 1,
  num_parcelas INTEGER DEFAULT 4,
  data_vencimento_dia INTEGER DEFAULT 10,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Parcelas configuradas
CREATE TABLE IF NOT EXISTS parcelas_campori_config (
  id SERIAL PRIMARY KEY,
  numero INTEGER NOT NULL,
  valor NUMERIC(8,2) NOT NULL,
  descricao TEXT,
  UNIQUE (numero)
);

-- Pagamentos do Campori
CREATE TABLE IF NOT EXISTS pagamentos_campori (
  id SERIAL PRIMARY KEY,
  dbv_id INTEGER NOT NULL REFERENCES desbravadores(id),
  parcela_numero INTEGER NOT NULL,
  valor_pago NUMERIC(8,2) DEFAULT 0,
  data_pagamento DATE,
  pago BOOLEAN DEFAULT FALSE,
  observacao TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (dbv_id, parcela_numero)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_pontuacoes_dbv ON pontuacoes(dbv_id);
CREATE INDEX IF NOT EXISTS idx_pontuacoes_data ON pontuacoes(data);
CREATE INDEX IF NOT EXISTS idx_pagamentos_dbv ON pagamentos_campori(dbv_id);
CREATE INDEX IF NOT EXISTS idx_desbravadores_unidade ON desbravadores(unidade_id);

-- RLS (Row Level Security)
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE desbravadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE pontuacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos_campori ENABLE ROW LEVEL SECURITY;

-- Políticas: admin geral vê tudo, admin diretoria vê sua unidade, DBV vê a si mesmo
CREATE POLICY "admin_geral_acesso_total" ON desbravadores
  FOR ALL USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND perfil = 'admin_geral')
  );

CREATE POLICY "admin_diretoria_acesso_unidade" ON desbravadores
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.perfil = 'admin_diretoria'
      AND u.unidade_id = desbravadores.unidade_id
    )
  );

CREATE POLICY "dbv_acesso_proprio" ON desbravadores
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND dbv_id = desbravadores.id)
  );

-- Configuração padrão do Campori
INSERT INTO config_campori (id, num_parcelas, data_vencimento_dia) VALUES (1, 4, 10)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO parcelas_campori_config (numero, valor, descricao) VALUES
  (1, 130.00, '1ª Parcela'),
  (2, 130.00, '2ª Parcela'),
  (3, 90.00, '3ª Parcela'),
  (4, 90.00, '4ª Parcela')
  ON CONFLICT (numero) DO NOTHING;
