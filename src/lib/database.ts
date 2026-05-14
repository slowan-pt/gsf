import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export const getDB = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!db) {
    db = await SQLite.openDatabaseAsync('fonseca.db');
    protegerSQLite(db);
    await initDB(db);
  }
  return db;
};

function normalizarParam(v: unknown): SQLite.SQLiteBindValue {
  if (v === undefined) return null;
  if (typeof v === 'number' && Number.isNaN(v)) return 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object' && v !== null && !(v instanceof Uint8Array) && !(v instanceof ArrayBuffer)) {
    return JSON.stringify(v);
  }
  return v as SQLite.SQLiteBindValue;
}

function normalizarParams(params: any[]) {
  return params.map((p) =>
    Array.isArray(p) ? p.map(normalizarParam) : normalizarParam(p)
  );
}

function protegerSQLite(database: SQLite.SQLiteDatabase) {
  const alvo = database as SQLite.SQLiteDatabase & { __protegido?: boolean };
  if (alvo.__protegido) return;

  const runOriginal = database.runAsync.bind(database);
  database.runAsync = ((source: string, ...params: any[]) => {
    const normalizados = normalizarParams(params);
    return runOriginal(source, ...(normalizados as any[]));
  }) as SQLite.SQLiteDatabase['runAsync'];

  const getFirstOriginal = database.getFirstAsync.bind(database);
  database.getFirstAsync = ((source: string, ...params: any[]) => {
    const normalizados = normalizarParams(params);
    return getFirstOriginal(source, ...(normalizados as any[]));
  }) as SQLite.SQLiteDatabase['getFirstAsync'];

  const getAllOriginal = database.getAllAsync.bind(database);
  database.getAllAsync = ((source: string, ...params: any[]) => {
    const normalizados = normalizarParams(params);
    return getAllOriginal(source, ...(normalizados as any[]));
  }) as SQLite.SQLiteDatabase['getAllAsync'];

  alvo.__protegido = true;
}

async function initDB(db: SQLite.SQLiteDatabase) {
  // Migrações seguras (ignoram erro se coluna já existe)
  const migrações = [
    `ALTER TABLE unidades ADD COLUMN cor TEXT DEFAULT '#1a3a5c'`,
    `ALTER TABLE desbravadores ADD COLUMN foto_url TEXT`,
  ];
  for (const m of migrações) {
    try { await db.runAsync(m); } catch {}
  }

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS unidades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cor TEXT DEFAULT '#1a3a5c',
      codigo_clube INTEGER,
      senha_unidade INTEGER
    );

    CREATE TABLE IF NOT EXISTS desbravadores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idx INTEGER,
      id_sgc TEXT,
      nome TEXT NOT NULL,
      data_nascimento TEXT,
      idade INTEGER,
      genero TEXT,
      unidade_id INTEGER,
      unidade_nome TEXT,
      cargo TEXT,
      contato TEXT,
      email TEXT,
      camisa TEXT,
      campori_dsa INTEGER DEFAULT 0,
      nome_responsavel TEXT,
      contato_responsavel TEXT,
      foto_url TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      sincronizado INTEGER DEFAULT 0,
      FOREIGN KEY (unidade_id) REFERENCES unidades(id)
    );

    CREATE TABLE IF NOT EXISTS documentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dbv_id INTEGER NOT NULL,
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
      updated_at TEXT DEFAULT (datetime('now')),
      sincronizado INTEGER DEFAULT 0,
      FOREIGN KEY (dbv_id) REFERENCES desbravadores(id)
    );

    CREATE TABLE IF NOT EXISTS progresso_classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dbv_id INTEGER NOT NULL UNIQUE,
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
      updated_at TEXT DEFAULT (datetime('now')),
      sincronizado INTEGER DEFAULT 0,
      FOREIGN KEY (dbv_id) REFERENCES desbravadores(id)
    );

    CREATE TABLE IF NOT EXISTS especialidades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dbv_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      status TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      sincronizado INTEGER DEFAULT 0,
      FOREIGN KEY (dbv_id) REFERENCES desbravadores(id)
    );

    CREATE TABLE IF NOT EXISTS eventos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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

    CREATE TABLE IF NOT EXISTS pontuacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dbv_id INTEGER NOT NULL,
      data TEXT NOT NULL,
      presenca INTEGER DEFAULT 0,
      pontualidade INTEGER DEFAULT 0,
      material INTEGER DEFAULT 0,
      uniforme INTEGER DEFAULT 0,
      bom_biblia INTEGER DEFAULT 0,
      pontos_extras INTEGER DEFAULT 0,
      classe_biblica INTEGER DEFAULT 0,
      especialidade INTEGER DEFAULT 0,
      pgm_especial INTEGER DEFAULT 0,
      atividade_unidade INTEGER DEFAULT 0,
      observacao TEXT,
      lancado_por TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      sincronizado INTEGER DEFAULT 0,
      FOREIGN KEY (dbv_id) REFERENCES desbravadores(id)
    );

    CREATE TABLE IF NOT EXISTS config_campori (
      id INTEGER PRIMARY KEY DEFAULT 1,
      num_parcelas INTEGER DEFAULT 4,
      data_vencimento_dia INTEGER DEFAULT 10,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS parcelas_campori_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero INTEGER NOT NULL,
      valor REAL NOT NULL,
      descricao TEXT
    );

    CREATE TABLE IF NOT EXISTS pagamentos_campori (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dbv_id INTEGER NOT NULL,
      parcela_numero INTEGER NOT NULL,
      valor_pago REAL DEFAULT 0,
      data_pagamento TEXT,
      pago INTEGER DEFAULT 0,
      observacao TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      sincronizado INTEGER DEFAULT 0,
      FOREIGN KEY (dbv_id) REFERENCES desbravadores(id)
    );

    CREATE TABLE IF NOT EXISTS documento_imagens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dbv_id INTEGER NOT NULL,
      campo TEXT NOT NULL,
      url TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (dbv_id) REFERENCES desbravadores(id)
    );

    CREATE TABLE IF NOT EXISTS mensagens_clube (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      corpo TEXT NOT NULL,
      enviado_por TEXT,
      lida INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS atividades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supabase_id BIGINT,
      titulo TEXT NOT NULL,
      descricao TEXT,
      data TEXT,
      destino TEXT NOT NULL DEFAULT 'todos',
      unidade_id INTEGER,
      unidade_nome TEXT,
      dbv_id INTEGER,
      dbv_nome TEXT,
      criado_por TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS atividades_anexos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supabase_id BIGINT,
      atividade_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      url TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'outro',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS atividades_respostas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supabase_id BIGINT,
      atividade_id INTEGER NOT NULL,
      dbv_id INTEGER NOT NULL,
      dbv_nome TEXT,
      texto TEXT,
      anexo_url TEXT,
      anexo_nome TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fila_sync (
      id TEXT PRIMARY KEY,
      tabela TEXT NOT NULL,
      operacao TEXT NOT NULL,
      dados TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS config_pontuacao (
      id INTEGER PRIMARY KEY DEFAULT 1,
      presenca INTEGER DEFAULT 25,
      pontualidade INTEGER DEFAULT 100,
      material INTEGER DEFAULT 25,
      uniforme INTEGER DEFAULT 25,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS config_pontuacao_itens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      valor INTEGER DEFAULT 0,
      ativo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pontuacoes_custom (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dbv_id INTEGER NOT NULL,
      data TEXT NOT NULL,
      item_id INTEGER NOT NULL,
      quantidade INTEGER DEFAULT 0,
      pontos INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      sincronizado INTEGER DEFAULT 0,
      UNIQUE (dbv_id, data, item_id)
    );

    -- Migração: adiciona coluna cor se não existir (SQLite ignora erro de coluna já existente via IGNORE)
    -- Seed das unidades padrão
    INSERT OR IGNORE INTO unidades (id, nome, cor) VALUES (1, 'Amor Perfeito',  '#e91e63');
    INSERT OR IGNORE INTO unidades (id, nome, cor) VALUES (2, 'Sempre Viva',    '#4caf50');
    INSERT OR IGNORE INTO unidades (id, nome, cor) VALUES (3, 'Águia Dourada',  '#ff9800');
    INSERT OR IGNORE INTO unidades (id, nome, cor) VALUES (4, 'Leões',          '#2196f3');

    INSERT OR IGNORE INTO config_campori (id, num_parcelas, data_vencimento_dia) VALUES (1, 4, 10);
    INSERT OR IGNORE INTO config_pontuacao (id, presenca, pontualidade, material, uniforme) VALUES (1, 25, 100, 25, 25);
    INSERT OR IGNORE INTO parcelas_campori_config (numero, valor, descricao) VALUES
      (1, 130.0, '1ª Parcela'),
      (2, 130.0, '2ª Parcela'),
      (3, 90.0, '3ª Parcela'),
      (4, 90.0, '4ª Parcela');
  `);

  await garantirBaseMinima(db);
}

async function garantirBaseMinima(db: SQLite.SQLiteDatabase) {
  const unidadesPadrao = [
    [1, 'Amor Perfeito', '#e91e63'],
    [2, 'Sempre Viva', '#4caf50'],
    [3, 'Águia Dourada', '#ff9800'],
    [4, 'Leões', '#2196f3'],
  ] as const;

  for (const [id, nome, cor] of unidadesPadrao) {
    const existente = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM unidades WHERE id = ? OR nome = ? LIMIT 1',
      [id, nome]
    );
    if (existente?.id) {
      await db.runAsync('UPDATE unidades SET nome = ?, cor = COALESCE(cor, ?) WHERE id = ?', [nome, cor, existente.id]);
    } else {
      await db.runAsync('INSERT INTO unidades (id, nome, cor) VALUES (?, ?, ?)', [id, nome, cor]);
    }
  }

  await db.runAsync(`
    UPDATE desbravadores
       SET unidade_id = CASE unidade_nome
         WHEN 'Amor Perfeito' THEN 1
         WHEN 'Sempre Viva' THEN 2
         WHEN 'Águia Dourada' THEN 3
         WHEN 'Leões' THEN 4
         ELSE unidade_id
       END
     WHERE unidade_nome IN ('Amor Perfeito', 'Sempre Viva', 'Águia Dourada', 'Leões')
  `);
}
