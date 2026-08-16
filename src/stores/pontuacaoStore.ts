import { create } from 'zustand';
import { Platform } from 'react-native';
import { getDB } from '../lib/database';
import { adicionarFilaSync } from '../lib/sync';
import { enviarParaTodos } from '../lib/notifications';
import { supabase } from '../lib/supabase';
import { getClubeAtivoId, getProgramaAtivoId } from '../lib/contextoAtual';
import type { Pontuacao } from '../types';

export interface ConfigPontuacao {
  presenca: number;
  pontualidade: number;
  material: number;
  uniforme: number;
}

export interface ConfigPontuacaoItem {
  id: number;
  nome: string;
  sigla?: string | null;
  valor: number;
  ativo: number | boolean;
  ordem?: number | null;
  padrao?: boolean | null;
}

export interface PontuacaoUnidade {
  id: number;
  clube_id?: number;
  programa_id?: number | null;
  unidade_id: number | null;
  unidade_nome: string;
  data: string;
  pontos: number;
  descricao: string;
  lancado_por?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RankingUnidade {
  unidade_id: number | null;
  nome: string;
  total: number;
  total_membros: number;
  total_direto: number;
}

export interface ExtratoUnidadeDia {
  data: string;
  membros: Array<{ dbv_id: number; nome: string; total: number }>;
  diretos: PontuacaoUnidade[];
  subtotal_membros: number;
  subtotal_direto: number;
  subtotal: number;
}

const CONFIG_PADRAO: ConfigPontuacao = {
  presenca: 25,
  pontualidade: 100,
  material: 25,
  uniforme: 25,
};

const FATOR_RANKING_UNIDADE_MEMBROS = 0.015;

function pontuacaoMembroParaUnidade(pontos: number): number {
  return pontos * FATOR_RANKING_UNIDADE_MEMBROS;
}

function textoSeguro(v: unknown): string | null {
  const s = String(v ?? '').trim();
  return s.length ? s : null;
}

function numeroSeguro(v: unknown, padrao = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : padrao;
}

function normalizarTitulo(v: unknown): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function siglaPontuacao(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 'PT';
  if (partes.length === 1) return partes[0].slice(0, 3).toUpperCase();
  return partes.map((w) => w[0] ?? '').join('').slice(0, 6).toUpperCase();
}

function deduplicarItens(rows: any[] = []): ConfigPontuacaoItem[] {
  const map = new Map<string, ConfigPontuacaoItem>();
  for (const row of rows) {
    const nome = String(row.titulo ?? row.nome ?? '').trim();
    if (!nome) continue;
    const sigla = String(row.sigla ?? '').trim().toUpperCase();
    const chave = normalizarTitulo(nome);
    const item: ConfigPontuacaoItem = {
      id: Number(row.id),
      nome,
      sigla: sigla || siglaPontuacao(nome),
      valor: numeroSeguro(row.valor),
      ativo: row.ativo !== false && row.ativo !== 0,
      ordem: row.ordem ?? null,
      padrao: row.padrao ?? null,
    };
    const atual = map.get(chave);
    if (!atual) {
      map.set(chave, item);
      continue;
    }
    const atualAtivo = atual.ativo !== false && atual.ativo !== 0;
    const itemAtivo = item.ativo !== false && item.ativo !== 0;
    if ((!atualAtivo && itemAtivo) || ((item.ordem ?? 999999) < (atual.ordem ?? 999999))) {
      map.set(chave, item);
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    (a.ordem ?? 999999) - (b.ordem ?? 999999) ||
    a.nome.localeCompare(b.nome, 'pt-BR')
  );
}

function campoBaseItem(item: Pick<ConfigPontuacaoItem, 'nome' | 'sigla'>): keyof ConfigPontuacao | null {
  const sigla = String(item.sigla ?? '').trim().toUpperCase();
  const nome = normalizarTitulo(item.nome);
  if (sigla === 'PR' || nome === 'presenca') return 'presenca';
  if (sigla === 'PO' || nome === 'pontualidade') return 'pontualidade';
  if (sigla === 'MA' || nome === 'material') return 'material';
  if (sigla === 'UN' || nome === 'uniforme') return 'uniforme';
  return null;
}

function configComItens(config: ConfigPontuacao, itens: ConfigPontuacaoItem[]): ConfigPontuacao {
  return itens.reduce((acc, item) => {
    const campo = campoBaseItem(item);
    return campo ? { ...acc, [campo]: numeroSeguro(item.valor, acc[campo]) } : acc;
  }, config);
}

interface PontuacaoState {
  pontuacoes: Pontuacao[];
  pontuacoesUnidades: PontuacaoUnidade[];
  config: ConfigPontuacao;
  itens: ConfigPontuacaoItem[];
  carregarConfig: () => Promise<void>;
  salvarConfig: (c: ConfigPontuacao) => Promise<void>;
  criarItemConfig: (nome: string, valor: number) => Promise<void>;
  atualizarItemConfig: (id: number, nome: string, valor: number, ativo: boolean) => Promise<void>;
  excluirItemConfig: (id: number) => Promise<void>;
  salvarCustom: (dbv_id: number, data: string, item_id: number, quantidade: number, valorUnitario: number) => Promise<void>;
  carregarCustomPorData: (data: string) => Promise<Record<number, Record<number, number>>>;
  carregarPontuacoesUnidades: (data?: string) => Promise<void>;
  criarPontuacaoUnidade: (dados: Omit<PontuacaoUnidade, 'id' | 'clube_id' | 'programa_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  atualizarPontuacaoUnidade: (id: number, dados: Partial<Omit<PontuacaoUnidade, 'id' | 'clube_id' | 'programa_id' | 'created_at' | 'updated_at'>>) => Promise<void>;
  excluirPontuacaoUnidade: (id: number) => Promise<void>;
  getRankingUnidades: () => Promise<RankingUnidade[]>;
  getExtratoUnidade: (unidadeId: number | null, unidadeNome?: string) => Promise<ExtratoUnidadeDia[]>;
  carregarPorData: (data: string) => Promise<void>;
  lancarPontuacao: (dados: Omit<Pontuacao, 'id' | 'created_at' | 'updated_at' | 'sincronizado'>) => Promise<void>;
  adicionarPontosExtras: (dbv_ids: number[], data: string, pontos: number, observacao: string, lancado_por?: string) => Promise<void>;
  calcularTotalDBV: (dbv_id: number) => Promise<number>;
  getRankingGeral: (grupo?: 'desbravadores' | 'diretoria' | 'conselheiros') => Promise<Array<{ dbv_id: number; nome: string; unidade: string; total: number; foto_url?: string }>>;
}

function calcSQL(cfg: ConfigPontuacao) {
  return `(
    COALESCE(p.presenca_pts,     p.presenca     * ${cfg.presenca},     0) +
    COALESCE(p.pontualidade_pts, p.pontualidade * ${cfg.pontualidade}, 0) +
    COALESCE(p.material_pts,     p.material     * ${cfg.material},     0) +
    COALESCE(p.uniforme_pts,     p.uniforme     * ${cfg.uniforme},     0) +
    COALESCE(p.pontos_extras, 0)
  )`;
}

function somaPontuacaoBase(p: any, cfg: ConfigPontuacao): number {
  const temPtsGravados = p.presenca_pts !== undefined && p.presenca_pts !== null;
  if (temPtsGravados) {
    return (
      (Number(p.presenca_pts) || 0) +
      (Number(p.pontualidade_pts) || 0) +
      (Number(p.material_pts) || 0) +
      (Number(p.uniforme_pts) || 0) +
      (Number(p.pontos_extras) || 0)
    );
  }
  return (
    (p.presenca ? cfg.presenca : 0) +
    (p.pontualidade ? cfg.pontualidade : 0) +
    (p.material ? cfg.material : 0) +
    (p.uniforme ? cfg.uniforme : 0) +
    (Number(p.pontos_extras) || 0)
  );
}

function ehCargoConselheiro(cargo?: string | null): boolean {
  const normalizado = String(cargo ?? '').toLowerCase();
  return normalizado.includes('conselheiro') || normalizado.includes('conselheira') || normalizado.toUpperCase() === 'CON';
}

export const usePontuacaoStore = create<PontuacaoState>((set, get) => ({
  pontuacoes: [],
  pontuacoesUnidades: [],
  config: CONFIG_PADRAO,
  itens: [],

  carregarConfig: async () => {
    // Caminho ÚNICO para web e app: os dois leem a MESMA tabela `pontuacao_itens`
    // (multi-clube, alimentada pela tela Modelos). Antes o app lia da tabela
    // legada `config_pontuacao_itens`, então a grade de tipos de pontuação
    // aparecia diferente no celular e no navegador. O app só cai pro cache
    // local (que espelha essa mesma lista) quando está sem internet.
    const clubeId = getClubeAtivoId();
    try {
      const [{ data: cfg }, { data: itens, error: erroItens }] = await Promise.all([
        supabase
          .from('config_pontuacao')
          .select('presenca, pontualidade, material, uniforme')
          .eq('clube_id', clubeId)
          .maybeSingle(),
        supabase
          .from('pontuacao_itens')
          .select('id, titulo, sigla, valor, ativo, ordem, padrao')
          .eq('clube_id', clubeId)
          .order('ordem'),
      ]);
      if (erroItens) throw erroItens;
      const itensNormalizados = deduplicarItens(itens ?? []);
      set({
        config: configComItens(cfg ?? CONFIG_PADRAO, itensNormalizados),
        itens: itensNormalizados,
      });
      return;
    } catch (erro) {
      if (Platform.OS === 'web') throw erro;
      // Offline no app instalado: cai pro cache local.
    }

    const db = await getDB();
    const row = await db.getFirstAsync<ConfigPontuacao>(
      'SELECT presenca, pontualidade, material, uniforme FROM config_pontuacao WHERE id = 1'
    );
    const locais = await db.getAllAsync<any>(
      'SELECT id, nome, valor, ativo FROM config_pontuacao_itens ORDER BY nome'
    );
    // Mesma normalização do caminho online (gera sigla, remove duplicados).
    const itensNormalizados = deduplicarItens(locais ?? []);
    set({
      config: configComItens(row ?? CONFIG_PADRAO, itensNormalizados),
      itens: itensNormalizados,
    });
  },

  salvarConfig: async (c) => {
    const configLimpa = {
      presenca: numeroSeguro(c.presenca),
      pontualidade: numeroSeguro(c.pontualidade),
      material: numeroSeguro(c.material),
      uniforme: numeroSeguro(c.uniforme),
    };

    if (Platform.OS === 'web') {
      const clubeId = getClubeAtivoId();
      const { data: existente, error: erroBusca } = await supabase
        .from('config_pontuacao')
        .select('id')
        .eq('clube_id', clubeId)
        .maybeSingle();
      if (erroBusca) throw erroBusca;
      const resp = existente?.id ? await supabase
        .from('config_pontuacao')
        .update({ ...configLimpa, updated_at: new Date().toISOString() })
        .eq('id', existente.id)
        : await supabase
          .from('config_pontuacao')
          .insert({ clube_id: clubeId, ...configLimpa, updated_at: new Date().toISOString() });
      const { error } = resp;
      if (error) throw error;
      set({ config: configLimpa });
      return;
    }

    const db = await getDB();
    await db.runAsync(
      `INSERT OR REPLACE INTO config_pontuacao
       (id, presenca, pontualidade, material, uniforme, updated_at)
       VALUES (1, ?, ?, ?, ?, datetime('now'))`,
      [configLimpa.presenca, configLimpa.pontualidade, configLimpa.material, configLimpa.uniforme]
    );
    await adicionarFilaSync('config_pontuacao', 'UPDATE', { id: 1, ...configLimpa });
    set({ config: configLimpa });
  },

  criarItemConfig: async (nome, valor) => {
    const nomeLimpo = textoSeguro(nome);
    const valorLimpo = numeroSeguro(valor);
    if (!nomeLimpo) throw new Error('Informe o título da pontuação.');

    // Web e app criam na MESMA tabela `pontuacao_itens`.
    const clubeId = getClubeAtivoId();
    const existentes = await supabase
      .from('pontuacao_itens')
      .select('id, titulo')
      .eq('clube_id', clubeId);
    const existente = (existentes.data ?? []).find((i) => normalizarTitulo(i.titulo) === normalizarTitulo(nomeLimpo));
    const sigla = siglaPontuacao(nomeLimpo);
    if (existente?.id) {
      const { error } = await supabase
        .from('pontuacao_itens')
        .update({ titulo: nomeLimpo, sigla, valor: valorLimpo, ativo: true, updated_at: new Date().toISOString() })
        .eq('clube_id', clubeId)
        .eq('id', existente.id);
      if (error) throw error;
      await get().carregarConfig();
      return;
    }
    const { data: last } = await supabase
      .from('pontuacao_itens')
      .select('ordem')
      .eq('clube_id', clubeId)
      .order('ordem', { ascending: false })
      .limit(1);
    const ordem = (last?.[0]?.ordem ?? 0) + 1;
    const { error } = await supabase
      .from('pontuacao_itens')
      .insert({ clube_id: clubeId, programa_id: getProgramaAtivoId(), titulo: nomeLimpo, sigla, valor: valorLimpo, ordem, ativo: true, padrao: false });
    if (error) throw error;
    await get().carregarConfig();
  },

  atualizarItemConfig: async (id, nome, valor, ativo) => {
    const nomeLimpo = textoSeguro(nome);
    const valorLimpo = numeroSeguro(valor);
    if (!nomeLimpo) throw new Error('Informe o título da pontuação.');

    // Web e app editam a MESMA tabela `pontuacao_itens` — o id que chega aqui
    // vem da lista carregada em carregarConfig, que é dessa tabela.
    const { error } = await supabase
      .from('pontuacao_itens')
      .update({
        titulo: nomeLimpo,
        valor: valorLimpo,
        ativo,
        updated_at: new Date().toISOString(),
      })
      .eq('clube_id', getClubeAtivoId())
      .eq('id', id);
    if (error) throw error;
    await get().carregarConfig();
  },

  excluirItemConfig: async (id) => {
    const { error } = await supabase
      .from('pontuacao_itens')
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .eq('clube_id', getClubeAtivoId())
      .eq('id', id);
    if (error) throw error;
    await get().carregarConfig();
  },

  salvarCustom: async (dbv_id, data, item_id, quantidade, valorUnitario) => {
    const dbvId = numeroSeguro(dbv_id);
    const itemId = numeroSeguro(item_id);
    const qtd = numeroSeguro(quantidade);
    const valor = numeroSeguro(valorUnitario);
    const dataLimpa = String(data ?? '').trim();
    if (!dbvId || !itemId || !dataLimpa) return;

    const item = get().itens.find((i) => i.id === itemId);

    if (Platform.OS === 'web') {
      const clubeId = getClubeAtivoId();
      const historico = {
        item_nome: item?.nome ?? null,
        item_valor: item?.valor ?? valor,
      };
      const { data: existente } = await supabase
        .from('pontuacoes_custom')
        .select('id, quantidade, pontos')
        .eq('clube_id', clubeId)
        .eq('dbv_id', dbvId)
        .eq('data', dataLimpa)
        .eq('item_id', itemId)
        .maybeSingle();
      if (existente?.id) {
        // Preserva pontos históricos se a quantidade não mudou
        const pontosFinais = (existente.quantidade === qtd && qtd > 0)
          ? existente.pontos
          : qtd * valor;
        const { error } = await supabase
          .from('pontuacoes_custom')
          .update({ quantidade: qtd, pontos: pontosFinais, updated_at: new Date().toISOString() })
          .eq('id', existente.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('pontuacoes_custom')
          .insert({ clube_id: clubeId, dbv_id: dbvId, data: dataLimpa, item_id: itemId, quantidade: qtd, pontos: qtd * valor, ...historico, updated_at: new Date().toISOString() });
        if (error) throw error;
      }
      return;
    }

    const db = await getDB();
    const existente = await db.getFirstAsync<{ id: number; quantidade: number; pontos: number }>(
      'SELECT id, quantidade, pontos FROM pontuacoes_custom WHERE dbv_id=? AND data=? AND item_id=?',
      [dbvId, dataLimpa, itemId]
    );
    // Preserva pontos históricos se a quantidade não mudou
    const pontosFinais = (existente && existente.quantidade === qtd && qtd > 0)
      ? existente.pontos
      : qtd * valor;

    if (existente) {
      await db.runAsync(
        `UPDATE pontuacoes_custom SET quantidade=?, pontos=?, updated_at=datetime('now'), sincronizado=0 WHERE id=?`,
        [qtd, pontosFinais, existente.id]
      );
      await adicionarFilaSync('pontuacoes_custom', 'UPDATE', {
        id: existente.id, clube_id: getClubeAtivoId(), dbv_id: dbvId, data: dataLimpa, item_id: itemId,
        item_nome: item?.nome ?? null, item_valor: item?.valor ?? valor,
        quantidade: qtd, pontos: pontosFinais,
      });
    } else {
      await db.runAsync(
        `INSERT INTO pontuacoes_custom
         (dbv_id, data, item_id, item_nome, item_valor, quantidade, pontos, updated_at, sincronizado)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 0)`,
        [dbvId, dataLimpa, itemId, item?.nome ?? null, item?.valor ?? valor, qtd, pontosFinais]
      );
      const row = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM pontuacoes_custom WHERE dbv_id=? AND data=? AND item_id=?',
        [dbvId, dataLimpa, itemId]
      );
      await adicionarFilaSync('pontuacoes_custom', 'INSERT', {
        id: row?.id ?? null, clube_id: getClubeAtivoId(), dbv_id: dbvId, data: dataLimpa, item_id: itemId,
        item_nome: item?.nome ?? null, item_valor: item?.valor ?? valor,
        quantidade: qtd, pontos: pontosFinais,
      });
    }
  },

  carregarCustomPorData: async (data) => {
    try {
      const { data: rows, error } = await supabase
        .from('pontuacoes_custom')
        .select('dbv_id, item_id, quantidade')
        .eq('clube_id', getClubeAtivoId())
        .eq('data', data);
      if (error) throw error;
      const map: Record<number, Record<number, number>> = {};
      for (const r of rows ?? []) {
        if (!map[r.dbv_id]) map[r.dbv_id] = {};
        map[r.dbv_id][r.item_id] = r.quantidade;
      }
      return map;
    } catch {
      if (Platform.OS === 'web') return {};
      // Offline no app instalado: cai pro cache local.
    }

    const db = await getDB();
    const rows = await db.getAllAsync<{ dbv_id: number; item_id: number; quantidade: number }>(
      'SELECT dbv_id, item_id, quantidade FROM pontuacoes_custom WHERE data=?',
      [data]
    );
    const map: Record<number, Record<number, number>> = {};
    for (const r of rows) {
      if (!map[r.dbv_id]) map[r.dbv_id] = {};
      map[r.dbv_id][r.item_id] = r.quantidade;
    }
    return map;
  },

  carregarPontuacoesUnidades: async (data) => {
    if (Platform.OS === 'web') {
      let query = supabase
        .from('pontuacoes_unidades')
        .select('*')
        .eq('clube_id', getClubeAtivoId())
        .order('data', { ascending: false })
        .order('created_at', { ascending: false });
      if (data) query = query.eq('data', data);
      const { data: rows, error } = await query;
      if (error) throw error;
      set({ pontuacoesUnidades: (rows ?? []) as PontuacaoUnidade[] });
      return;
    }

    const db = await getDB();
    const rows = data
      ? await db.getAllAsync<PontuacaoUnidade>('SELECT * FROM pontuacoes_unidades WHERE data=? ORDER BY data DESC, id DESC', [data])
      : await db.getAllAsync<PontuacaoUnidade>('SELECT * FROM pontuacoes_unidades ORDER BY data DESC, id DESC');
    set({ pontuacoesUnidades: rows });
  },

  criarPontuacaoUnidade: async (dados) => {
    const unidadeNome = String(dados.unidade_nome ?? '').trim();
    const data = String(dados.data ?? '').trim();
    const descricao = String(dados.descricao ?? '').trim();
    const pontos = numeroSeguro(dados.pontos);
    if (!unidadeNome) throw new Error('Selecione uma unidade.');
    if (!data) throw new Error('Informe a data.');
    if (!descricao) throw new Error('Informe a descrição.');
    if (!pontos) throw new Error('Informe uma pontuação diferente de zero.');

    if (Platform.OS === 'web') {
      const { error } = await supabase.from('pontuacoes_unidades').insert({
        clube_id: getClubeAtivoId(),
        programa_id: getProgramaAtivoId(),
        unidade_id: dados.unidade_id ?? null,
        unidade_nome: unidadeNome,
        data,
        pontos,
        descricao,
        lancado_por: dados.lancado_por ?? null,
      });
      if (error) throw error;
      await get().carregarPontuacoesUnidades();
      return;
    }

    const db = await getDB();
    const result = await db.runAsync(
      `INSERT INTO pontuacoes_unidades
       (unidade_id, unidade_nome, data, pontos, descricao, lancado_por, updated_at, sincronizado)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 0)`,
      [dados.unidade_id ?? null, unidadeNome, data, pontos, descricao, dados.lancado_por ?? null]
    );
    await adicionarFilaSync('pontuacoes_unidades', 'INSERT', {
      id: result.lastInsertRowId,
      clube_id: getClubeAtivoId(),
      programa_id: getProgramaAtivoId(),
      unidade_id: dados.unidade_id ?? null,
      unidade_nome: unidadeNome,
      data,
      pontos,
      descricao,
      lancado_por: dados.lancado_por ?? null,
    });
    await get().carregarPontuacoesUnidades();
  },

  atualizarPontuacaoUnidade: async (id, dados) => {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (dados.unidade_id !== undefined) payload.unidade_id = dados.unidade_id;
    if (dados.unidade_nome !== undefined) payload.unidade_nome = String(dados.unidade_nome ?? '').trim();
    if (dados.data !== undefined) payload.data = String(dados.data ?? '').trim();
    if (dados.pontos !== undefined) payload.pontos = numeroSeguro(dados.pontos);
    if (dados.descricao !== undefined) payload.descricao = String(dados.descricao ?? '').trim();
    if (dados.lancado_por !== undefined) payload.lancado_por = dados.lancado_por ?? null;

    if (!payload.unidade_nome && dados.unidade_nome !== undefined) throw new Error('Selecione uma unidade.');
    if (!payload.data && dados.data !== undefined) throw new Error('Informe a data.');
    if (!payload.descricao && dados.descricao !== undefined) throw new Error('Informe a descrição.');
    if (payload.pontos !== undefined && !numeroSeguro(payload.pontos)) throw new Error('Informe uma pontuação diferente de zero.');

    if (Platform.OS === 'web') {
      const { error } = await supabase
        .from('pontuacoes_unidades')
        .update(payload)
        .eq('clube_id', getClubeAtivoId())
        .eq('id', id);
      if (error) throw error;
      await get().carregarPontuacoesUnidades();
      return;
    }

    const db = await getDB();
    await db.runAsync(
      `UPDATE pontuacoes_unidades
       SET unidade_id=?, unidade_nome=?, data=?, pontos=?, descricao=?, lancado_por=?, updated_at=datetime('now'), sincronizado=0
       WHERE id=?`,
      [
        dados.unidade_id ?? null,
        String(dados.unidade_nome ?? '').trim(),
        String(dados.data ?? '').trim(),
        numeroSeguro(dados.pontos),
        String(dados.descricao ?? '').trim(),
        dados.lancado_por ?? null,
        id,
      ]
    );
    await adicionarFilaSync('pontuacoes_unidades', 'UPDATE', { id, clube_id: getClubeAtivoId(), ...dados });
    await get().carregarPontuacoesUnidades();
  },

  excluirPontuacaoUnidade: async (id) => {
    if (Platform.OS === 'web') {
      const { error } = await supabase
        .from('pontuacoes_unidades')
        .delete()
        .eq('clube_id', getClubeAtivoId())
        .eq('id', id);
      if (error) throw error;
      set((s) => ({ pontuacoesUnidades: s.pontuacoesUnidades.filter((p) => p.id !== id) }));
      return;
    }

    const db = await getDB();
    await db.runAsync('DELETE FROM pontuacoes_unidades WHERE id=?', [id]);
    await adicionarFilaSync('pontuacoes_unidades', 'DELETE', { id });
    set((s) => ({ pontuacoesUnidades: s.pontuacoesUnidades.filter((p) => p.id !== id) }));
  },

  getRankingUnidades: async () => {
    const cfg = get().config;

    // Mesmo raciocínio de getRankingGeral: busca direto do Supabase sempre
    // que possível, só cai pro SQLite local (app instalado) se estiver offline.
    try {
      const clubeId = getClubeAtivoId();
      const [{ data: membros, error: erroM }, { data: pontuacoes, error: erroP }, { data: custom, error: erroC }, { data: diretas, error: erroD }] = await Promise.all([
        supabase
          .from('desbravadores')
          .select('id, nome, unidade_id, unidade_nome, cargo')
          .eq('clube_id', clubeId)
          .neq('ativo', false),
        supabase.from('pontuacoes').select('*').eq('clube_id', clubeId),
        supabase.from('pontuacoes_custom').select('dbv_id, pontos').eq('clube_id', clubeId),
        supabase.from('pontuacoes_unidades').select('unidade_id, unidade_nome, pontos').eq('clube_id', clubeId),
      ]);
      if (erroM) throw erroM;
      if (erroP) throw erroP;
      if (erroC) throw erroC;
      if (erroD) throw erroD;

      const membrosPorId = new Map<number, any>();
      for (const m of membros ?? []) membrosPorId.set(Number(m.id), m);

      const totaisMembros = new Map<string, RankingUnidade>();
      const obter = (unidade_id: number | null, nome: string) => {
        const chave = `${unidade_id ?? 'nome'}:${nome}`;
        const atual = totaisMembros.get(chave);
        if (atual) return atual;
        const novo: RankingUnidade = { unidade_id, nome, total: 0, total_membros: 0, total_direto: 0 };
        totaisMembros.set(chave, novo);
        return novo;
      };

      for (const p of pontuacoes ?? []) {
        const m = membrosPorId.get(Number(p.dbv_id));
        if (!m) continue;
        const nome = m.unidade_nome ?? 'Sem unidade';
        if (nome === 'Diretoria' || nome === 'Sem unidade') continue;
        const item = obter(m.unidade_id ?? null, nome);
        item.total_membros += pontuacaoMembroParaUnidade(somaPontuacaoBase(p, cfg));
      }
      for (const c of custom ?? []) {
        const m = membrosPorId.get(Number(c.dbv_id));
        if (!m) continue;
        const nome = m.unidade_nome ?? 'Sem unidade';
        if (nome === 'Diretoria' || nome === 'Sem unidade') continue;
        const item = obter(m.unidade_id ?? null, nome);
        item.total_membros += pontuacaoMembroParaUnidade(Number(c.pontos) || 0);
      }
      for (const d of diretas ?? []) {
        const nome = d.unidade_nome ?? 'Sem unidade';
        if (nome === 'Diretoria' || nome === 'Sem unidade') continue;
        const item = obter(d.unidade_id ?? null, nome);
        item.total_direto += Number(d.pontos) || 0;
      }
      return Array.from(totaisMembros.values())
        .map((u) => ({ ...u, total: u.total_membros + u.total_direto }))
        .filter((u) => u.total !== 0)
        .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
    } catch (erro) {
      if (Platform.OS === 'web') throw erro;
      // Offline no app instalado: cai pro cache local.
    }

    const db = await getDB();
    return db.getAllAsync<RankingUnidade>(
      `SELECT
        x.unidade_id,
        x.nome,
        SUM(x.total_membros) as total_membros,
        SUM(x.total_direto) as total_direto,
        SUM(x.total_membros + x.total_direto) as total
       FROM (
        SELECT d.unidade_id, d.unidade_nome as nome,
          (
            COALESCE((SELECT SUM(${calcSQL(cfg)}) FROM pontuacoes p WHERE p.dbv_id = d.id), 0)
            + COALESCE((SELECT SUM(pc.pontos) FROM pontuacoes_custom pc WHERE pc.dbv_id = d.id), 0)
          ) * ${FATOR_RANKING_UNIDADE_MEMBROS} as total_membros,
          0 as total_direto
        FROM desbravadores d
        WHERE (d.ativo IS NULL OR d.ativo = 1)
          AND COALESCE(d.unidade_nome, '') NOT IN ('Diretoria', 'Sem unidade', '')
        UNION ALL
        SELECT pu.unidade_id, pu.unidade_nome as nome, 0 as total_membros, pu.pontos as total_direto
        FROM pontuacoes_unidades pu
        WHERE COALESCE(pu.unidade_nome, '') NOT IN ('Diretoria', 'Sem unidade', '')
       ) x
       GROUP BY x.unidade_id, x.nome
       HAVING total != 0
       ORDER BY total DESC, nome`
    );
  },

  getExtratoUnidade: async (unidadeId, unidadeNome) => {
    const cfg = get().config;
    if (Platform.OS === 'web') {
      const clubeId = getClubeAtivoId();
      const membroQuery = supabase
        .from('desbravadores')
        .select('id, nome, unidade_id, unidade_nome')
        .eq('clube_id', clubeId)
        .neq('ativo', false);
      const { data: membros, error: membrosErro } = unidadeId
        ? await membroQuery.eq('unidade_id', unidadeId)
        : await membroQuery.eq('unidade_nome', unidadeNome ?? '');
      if (membrosErro) throw membrosErro;
      const ids = (membros ?? []).map((m) => Number(m.id));
      const [pontResp, customResp, diretasResp] = await Promise.all([
        ids.length
          ? supabase.from('pontuacoes').select('*').eq('clube_id', clubeId).in('dbv_id', ids)
          : Promise.resolve({ data: [], error: null } as any),
        ids.length
          ? supabase.from('pontuacoes_custom').select('dbv_id, data, item_nome, pontos').eq('clube_id', clubeId).in('dbv_id', ids)
          : Promise.resolve({ data: [], error: null } as any),
        unidadeId
          ? supabase.from('pontuacoes_unidades').select('*').eq('clube_id', clubeId).eq('unidade_id', unidadeId)
          : supabase.from('pontuacoes_unidades').select('*').eq('clube_id', clubeId).eq('unidade_nome', unidadeNome ?? ''),
      ]);
      if (pontResp.error) throw pontResp.error;
      if (customResp.error) throw customResp.error;
      if (diretasResp.error) throw diretasResp.error;

      const membrosMap = new Map((membros ?? []).map((m) => [Number(m.id), m]));
      const dias = new Map<string, ExtratoUnidadeDia>();
      const obterDia = (data: string) => {
        const atual = dias.get(data);
        if (atual) return atual;
        const novo: ExtratoUnidadeDia = { data, membros: [], diretos: [], subtotal_membros: 0, subtotal_direto: 0, subtotal: 0 };
        dias.set(data, novo);
        return novo;
      };
      const membroDia = new Map<string, { dbv_id: number; nome: string; total: number }>();
      const somarMembro = (data: string, dbvId: number, pontos: number) => {
        const membro = membrosMap.get(dbvId);
        if (!membro || !pontos) return;
        const dia = obterDia(data);
        const chave = `${data}:${dbvId}`;
        let linha = membroDia.get(chave);
        if (!linha) {
          linha = { dbv_id: dbvId, nome: membro.nome, total: 0 };
          membroDia.set(chave, linha);
          dia.membros.push(linha);
        }
        const pontosUnidade = pontuacaoMembroParaUnidade(pontos);
        linha.total += pontosUnidade;
        dia.subtotal_membros += pontosUnidade;
        dia.subtotal += pontosUnidade;
      };
      for (const p of pontResp.data ?? []) somarMembro(p.data, Number(p.dbv_id), somaPontuacaoBase(p, cfg));
      for (const c of customResp.data ?? []) somarMembro(c.data, Number(c.dbv_id), Number(c.pontos) || 0);
      for (const d of diretasResp.data ?? []) {
        const dia = obterDia(d.data);
        const row = d as PontuacaoUnidade;
        dia.diretos.push(row);
        dia.subtotal_direto += Number(row.pontos) || 0;
        dia.subtotal += Number(row.pontos) || 0;
      }
      return Array.from(dias.values())
        .filter((d) => d.subtotal !== 0)
        .map((d) => ({
          ...d,
          membros: d.membros.sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR')),
          diretos: d.diretos.sort((a, b) => b.id - a.id),
        }))
        .sort((a, b) => b.data.localeCompare(a.data));
    }

    const db = await getDB();
    const membros = unidadeId
      ? await db.getAllAsync<any>('SELECT id, nome FROM desbravadores WHERE unidade_id=? AND (ativo IS NULL OR ativo=1)', [unidadeId])
      : await db.getAllAsync<any>('SELECT id, nome FROM desbravadores WHERE unidade_nome=? AND (ativo IS NULL OR ativo=1)', [unidadeNome ?? '']);
    const ids = membros.map((m) => Number(m.id));
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const pontuacoes = await db.getAllAsync<any>(`SELECT * FROM pontuacoes WHERE dbv_id IN (${placeholders})`, ids);
    const custom = await db.getAllAsync<any>(`SELECT * FROM pontuacoes_custom WHERE dbv_id IN (${placeholders})`, ids);
    const diretas = unidadeId
      ? await db.getAllAsync<PontuacaoUnidade>('SELECT * FROM pontuacoes_unidades WHERE unidade_id=?', [unidadeId])
      : await db.getAllAsync<PontuacaoUnidade>('SELECT * FROM pontuacoes_unidades WHERE unidade_nome=?', [unidadeNome ?? '']);
    const membrosMap = new Map(membros.map((m) => [Number(m.id), m]));
    const dias = new Map<string, ExtratoUnidadeDia>();
    const obterDia = (data: string) => dias.get(data) ?? (() => {
      const novo: ExtratoUnidadeDia = { data, membros: [], diretos: [], subtotal_membros: 0, subtotal_direto: 0, subtotal: 0 };
      dias.set(data, novo);
      return novo;
    })();
    const membroDia = new Map<string, { dbv_id: number; nome: string; total: number }>();
    const somarMembro = (data: string, dbvId: number, pontos: number) => {
      const membro = membrosMap.get(dbvId);
      if (!membro || !pontos) return;
      const dia = obterDia(data);
      const chave = `${data}:${dbvId}`;
      let linha = membroDia.get(chave);
      if (!linha) {
        linha = { dbv_id: dbvId, nome: membro.nome, total: 0 };
        membroDia.set(chave, linha);
        dia.membros.push(linha);
      }
      const pontosUnidade = pontuacaoMembroParaUnidade(pontos);
      linha.total += pontosUnidade;
      dia.subtotal_membros += pontosUnidade;
      dia.subtotal += pontosUnidade;
    };
    for (const p of pontuacoes) somarMembro(p.data, Number(p.dbv_id), somaPontuacaoBase(p, cfg));
    for (const c of custom) somarMembro(c.data, Number(c.dbv_id), Number(c.pontos) || 0);
    for (const d of diretas) {
      const dia = obterDia(d.data);
      dia.diretos.push(d);
      dia.subtotal_direto += Number(d.pontos) || 0;
      dia.subtotal += Number(d.pontos) || 0;
    }
    return Array.from(dias.values()).sort((a, b) => b.data.localeCompare(a.data));
  },

  carregarPorData: async (data) => {
    try {
      const { data: lista, error } = await supabase
        .from('pontuacoes')
        .select('*')
        .eq('clube_id', getClubeAtivoId())
        .eq('data', data);
      if (error) throw error;
      set({ pontuacoes: (lista ?? []) as Pontuacao[] });
      return;
    } catch {
      if (Platform.OS === 'web') { set({ pontuacoes: [] }); return; }
      // Offline no app instalado: cai pro cache local.
    }

    const db = await getDB();
    const lista = await db.getAllAsync<Pontuacao>(
      'SELECT * FROM pontuacoes WHERE data = ?',
      [data]
    );
    set({ pontuacoes: lista });
  },

  lancarPontuacao: async (dados) => {
    const dadosLimpos = {
      ...dados,
      dbv_id: numeroSeguro(dados.dbv_id),
      data: String(dados.data ?? '').trim(),
      presenca: !!dados.presenca,
      pontualidade: !!dados.pontualidade,
      material: !!dados.material,
      uniforme: !!dados.uniforme,
      bom_biblia: numeroSeguro(dados.bom_biblia),
      pontos_extras: numeroSeguro(dados.pontos_extras),
      classe_biblica: numeroSeguro(dados.classe_biblica),
      especialidade: numeroSeguro(dados.especialidade),
      pgm_especial: numeroSeguro(dados.pgm_especial),
      atividade_unidade: numeroSeguro(dados.atividade_unidade),
      observacao: textoSeguro(dados.observacao),
      lancado_por: textoSeguro(dados.lancado_por),
    };
    if (!dadosLimpos.dbv_id || !dadosLimpos.data) throw new Error('Pontuação sem membro ou data.');

    if (Platform.OS === 'web') {
      const clubeId = getClubeAtivoId();
      const cfg = get().config;
      const payload = {
        ...dadosLimpos,
        clube_id: clubeId,
        presenca_pts:     dadosLimpos.presenca     ? cfg.presenca     : 0,
        pontualidade_pts: dadosLimpos.pontualidade ? cfg.pontualidade : 0,
        material_pts:     dadosLimpos.material     ? cfg.material     : 0,
        uniforme_pts:     dadosLimpos.uniforme     ? cfg.uniforme     : 0,
        updated_at: new Date().toISOString(),
      };
      const { data: existente } = await supabase
        .from('pontuacoes')
        .select('id')
        .eq('clube_id', clubeId)
        .eq('dbv_id', dadosLimpos.dbv_id)
        .eq('data', dadosLimpos.data)
        .maybeSingle();
      let salvo: Pontuacao | null = null;
      if (existente?.id) {
        const { data, error } = await supabase.from('pontuacoes').update(payload).eq('id', existente.id).select('*').single();
        if (error) throw error;
        salvo = data as Pontuacao;
      } else {
        const { data, error } = await supabase.from('pontuacoes').insert(payload).select('*').single();
        if (error) throw error;
        salvo = data as Pontuacao;
      }
      if (salvo) {
        set((s) => {
          const semAtual = s.pontuacoes.filter((p) => !(p.dbv_id === salvo!.dbv_id && p.data === salvo!.data));
          return { pontuacoes: [...semAtual, salvo!] };
        });
      }
      return;
    }

    const db = await getDB();
    const existente = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM pontuacoes WHERE dbv_id = ? AND data = ?',
      [dadosLimpos.dbv_id, dadosLimpos.data]
    );

    const cfg = get().config;
    const presencaPts     = dadosLimpos.presenca     ? cfg.presenca     : 0;
    const pontualidadePts = dadosLimpos.pontualidade ? cfg.pontualidade : 0;
    const materialPts     = dadosLimpos.material     ? cfg.material     : 0;
    const uniformePts     = dadosLimpos.uniforme     ? cfg.uniforme     : 0;

    if (existente) {
      await db.runAsync(
        `UPDATE pontuacoes SET
          presenca=?, pontualidade=?, material=?, uniforme=?,
          presenca_pts=?, pontualidade_pts=?, material_pts=?, uniforme_pts=?,
          bom_biblia=?, pontos_extras=?, classe_biblica=?,
          especialidade=?, pgm_especial=?, atividade_unidade=?,
          observacao=?, updated_at=datetime('now'), sincronizado=0
         WHERE id=?`,
        [
          dadosLimpos.presenca ? 1 : 0, dadosLimpos.pontualidade ? 1 : 0,
          dadosLimpos.material ? 1 : 0, dadosLimpos.uniforme ? 1 : 0,
          presencaPts, pontualidadePts, materialPts, uniformePts,
          dadosLimpos.bom_biblia, dadosLimpos.pontos_extras, dadosLimpos.classe_biblica,
          dadosLimpos.especialidade, dadosLimpos.pgm_especial, dadosLimpos.atividade_unidade,
          dadosLimpos.observacao, existente.id,
        ]
      );
      await adicionarFilaSync('pontuacoes', 'UPDATE', { id: existente.id, clube_id: getClubeAtivoId(), ...dadosLimpos, presenca_pts: presencaPts, pontualidade_pts: pontualidadePts, material_pts: materialPts, uniforme_pts: uniformePts });
    } else {
      const result = await db.runAsync(
        `INSERT INTO pontuacoes
          (dbv_id, data, presenca, pontualidade, material, uniforme,
           presenca_pts, pontualidade_pts, material_pts, uniforme_pts,
           bom_biblia, pontos_extras, classe_biblica, especialidade,
           pgm_especial, atividade_unidade, observacao, lancado_por)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          dadosLimpos.dbv_id, dadosLimpos.data,
          dadosLimpos.presenca ? 1 : 0, dadosLimpos.pontualidade ? 1 : 0,
          dadosLimpos.material ? 1 : 0, dadosLimpos.uniforme ? 1 : 0,
          presencaPts, pontualidadePts, materialPts, uniformePts,
          dadosLimpos.bom_biblia, dadosLimpos.pontos_extras, dadosLimpos.classe_biblica,
          dadosLimpos.especialidade, dadosLimpos.pgm_especial, dadosLimpos.atividade_unidade,
          dadosLimpos.observacao, dadosLimpos.lancado_por,
        ]
      );
      await adicionarFilaSync('pontuacoes', 'INSERT', { id: result.lastInsertRowId, clube_id: getClubeAtivoId(), ...dadosLimpos, presenca_pts: presencaPts, pontualidade_pts: pontualidadePts, material_pts: materialPts, uniforme_pts: uniformePts });
    }
  },

  adicionarPontosExtras: async (dbv_ids, data, pontos, observacao, lancado_por) => {
    if (Platform.OS === 'web') {
      const clubeId = getClubeAtivoId();
      for (const dbv_id of dbv_ids) {
        const { data: existente } = await supabase
          .from('pontuacoes')
          .select('id, pontos_extras')
          .eq('clube_id', clubeId)
          .eq('dbv_id', dbv_id)
          .eq('data', data)
          .maybeSingle();

        if (existente?.id) {
          const { error } = await supabase
            .from('pontuacoes')
            .update({
              pontos_extras: (existente.pontos_extras ?? 0) + pontos,
              observacao: observacao || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existente.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('pontuacoes').insert({
            clube_id: clubeId,
            dbv_id,
            data,
            presenca: false,
            pontualidade: false,
            material: false,
            uniforme: false,
            bom_biblia: 0,
            pontos_extras: pontos,
            classe_biblica: 0,
            especialidade: 0,
            pgm_especial: 0,
            atividade_unidade: 0,
            observacao: observacao || null,
            lancado_por: lancado_por ?? null,
          });
          if (error) throw error;
        }
      }
      return;
    }

    const db = await getDB();
    for (const dbv_id of dbv_ids) {
      const existente = await db.getFirstAsync<{ id: number; pontos_extras: number }>(
        'SELECT id, pontos_extras FROM pontuacoes WHERE dbv_id = ? AND data = ?',
        [dbv_id, data]
      );
      if (existente) {
        const novoTotal = (existente.pontos_extras || 0) + pontos;
        await db.runAsync(
          `UPDATE pontuacoes SET pontos_extras=?, observacao=?, updated_at=datetime('now'), sincronizado=0 WHERE id=?`,
          [novoTotal, observacao || null, existente.id]
        );
        await adicionarFilaSync('pontuacoes', 'UPDATE', {
          id: existente.id, clube_id: getClubeAtivoId(), pontos_extras: novoTotal, observacao: observacao || null,
        });
      } else {
        const result = await db.runAsync(
          `INSERT INTO pontuacoes
            (dbv_id, data, presenca, pontualidade, material, uniforme,
             bom_biblia, pontos_extras, classe_biblica, especialidade,
             pgm_especial, atividade_unidade, observacao, lancado_por)
           VALUES (?,?,0,0,0,0,0,?,0,0,0,0,?,?)`,
          [dbv_id, data, pontos, observacao || null, lancado_por ?? null]
        );
        await adicionarFilaSync('pontuacoes', 'INSERT', {
          id: result.lastInsertRowId, clube_id: getClubeAtivoId(), dbv_id, data,
          presenca: 0, pontualidade: 0, material: 0, uniforme: 0,
          bom_biblia: 0, pontos_extras: pontos, observacao: observacao || null,
        });
      }
    }

    // Notifica todos sobre nova pontuação
    const motivo = observacao ? ` — ${observacao}` : '';
    enviarParaTodos(
      '🏆 Nova pontuação registrada',
      `${dbv_ids.length} membro(s) receberam ${pontos > 0 ? '+' : ''}${pontos} pts${motivo}`,
      { tela: 'ranking' }
    ).catch(() => {});
  },

  calcularTotalDBV: async (dbv_id) => {
    if (Platform.OS === 'web') {
      const cfg = get().config;
      const clubeId = getClubeAtivoId();
      const [{ data: pontuacoes }, { data: custom }] = await Promise.all([
        supabase.from('pontuacoes').select('*').eq('clube_id', clubeId).eq('dbv_id', dbv_id),
        supabase.from('pontuacoes_custom').select('pontos').eq('clube_id', clubeId).eq('dbv_id', dbv_id),
      ]);
      const totalBase = (pontuacoes ?? []).reduce((acc, p) => acc + somaPontuacaoBase(p, cfg), 0);
      const totalCustom = (custom ?? []).reduce((acc, p) => acc + (Number(p.pontos) || 0), 0);
      return totalBase + totalCustom;
    }

    const db = await getDB();
    const cfg = get().config;
    const row = await db.getFirstAsync<{ total: number }>(
      `SELECT
        COALESCE((SELECT SUM(${calcSQL(cfg)}) FROM pontuacoes p WHERE p.dbv_id = ?), 0)
        + COALESCE((SELECT SUM(pontos) FROM pontuacoes_custom WHERE dbv_id = ?), 0)
        as total`,
      [dbv_id, dbv_id]
    );
    return row?.total ?? 0;
  },

  getRankingGeral: async (grupo) => {
    const cfg = get().config;
    const clubeId = getClubeAtivoId();

    // Busca direto do Supabase sempre que possível — o ranking depende de
    // pontuações lançadas de qualquer dispositivo, então ler só do SQLite
    // local do aparelho (que pode estar sem sincronizar) deixava o ranking
    // vazio/desatualizado no app instalado. Só cai pro SQLite local se
    // estiver offline.
    try {
      const [{ data: membros, error: erroM }, { data: pontuacoes, error: erroP }, { data: custom, error: erroC }] = await Promise.all([
        supabase
          .from('desbravadores')
          .select('id, nome, unidade_nome, cargo, foto_url')
          .eq('clube_id', clubeId)
          .neq('ativo', false)
          .order('nome'),
        supabase.from('pontuacoes').select('*').eq('clube_id', clubeId),
        supabase.from('pontuacoes_custom').select('dbv_id, pontos').eq('clube_id', clubeId),
      ]);
      if (erroM) throw erroM;
      if (erroP) throw erroP;
      if (erroC) throw erroC;

      const totais = new Map<number, number>();
      for (const p of pontuacoes ?? []) {
        const dbvId = Number(p.dbv_id);
        totais.set(dbvId, (totais.get(dbvId) ?? 0) + somaPontuacaoBase(p, cfg));
      }
      for (const p of custom ?? []) {
        const dbvId = Number(p.dbv_id);
        totais.set(dbvId, (totais.get(dbvId) ?? 0) + (Number(p.pontos) || 0));
      }

      return (membros ?? [])
        .filter((m) => {
          const unidade = m.unidade_nome ?? '';
          const conselheiro = ehCargoConselheiro(m.cargo);
          if (grupo === 'diretoria') return unidade === 'Diretoria';
          if (grupo === 'conselheiros') return conselheiro;
          if (grupo === 'desbravadores') return unidade !== 'Diretoria' && !conselheiro;
          return true;
        })
        .map((m) => ({
          dbv_id: Number(m.id),
          nome: m.nome,
          unidade: m.unidade_nome ?? 'Sem unidade',
          foto_url: m.foto_url ?? undefined,
          total: totais.get(Number(m.id)) ?? 0,
        }))
        .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
    } catch (erro) {
      if (Platform.OS === 'web') throw erro;
      // Offline no app instalado: cai pro cache local.
    }

    const db = await getDB();
    let whereGrupo = '';
    const ehConselheiro = `(LOWER(COALESCE(d.cargo, '')) LIKE '%conselheiro%' OR LOWER(COALESCE(d.cargo, '')) LIKE '%conselheira%' OR UPPER(COALESCE(d.cargo, '')) = 'CON')`;
    if (grupo === 'diretoria')          whereGrupo = `AND d.unidade_nome = 'Diretoria'`;
    else if (grupo === 'desbravadores') whereGrupo = `AND (d.unidade_nome IS NULL OR d.unidade_nome != 'Diretoria') AND NOT ${ehConselheiro}`;
    else if (grupo === 'conselheiros')  whereGrupo = `AND ${ehConselheiro}`;

    return db.getAllAsync<{ dbv_id: number; nome: string; unidade: string; total: number; foto_url?: string }>(
      `SELECT
        d.id as dbv_id,
        d.nome,
        d.unidade_nome as unidade,
        d.foto_url,
        COALESCE((
          SELECT SUM(${calcSQL(cfg)}) FROM pontuacoes p WHERE p.dbv_id = d.id
        ), 0) + COALESCE((
          SELECT SUM(pc.pontos) FROM pontuacoes_custom pc WHERE pc.dbv_id = d.id
        ), 0) as total
       FROM desbravadores d
       WHERE (d.ativo IS NULL OR d.ativo = 1) ${whereGrupo}
       ORDER BY total DESC`
    );
  },
}));
