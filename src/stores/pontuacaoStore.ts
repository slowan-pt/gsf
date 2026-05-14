import { create } from 'zustand';
import { Platform } from 'react-native';
import { getDB } from '../lib/database';
import { adicionarFilaSync } from '../lib/sync';
import { enviarParaTodos } from '../lib/notifications';
import { supabase } from '../lib/supabase';
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
  valor: number;
  ativo: number;
}

const CONFIG_PADRAO: ConfigPontuacao = {
  presenca: 25,
  pontualidade: 100,
  material: 25,
  uniforme: 25,
};

interface PontuacaoState {
  pontuacoes: Pontuacao[];
  config: ConfigPontuacao;
  itens: ConfigPontuacaoItem[];
  carregarConfig: () => Promise<void>;
  salvarConfig: (c: ConfigPontuacao) => Promise<void>;
  criarItemConfig: (nome: string, valor: number) => Promise<void>;
  atualizarItemConfig: (id: number, nome: string, valor: number, ativo: boolean) => Promise<void>;
  excluirItemConfig: (id: number) => Promise<void>;
  salvarCustom: (dbv_id: number, data: string, item_id: number, quantidade: number, valorUnitario: number) => Promise<void>;
  carregarCustomPorData: (data: string) => Promise<Record<number, Record<number, number>>>;
  carregarPorData: (data: string) => Promise<void>;
  lancarPontuacao: (dados: Omit<Pontuacao, 'id' | 'created_at' | 'updated_at' | 'sincronizado'>) => Promise<void>;
  adicionarPontosExtras: (dbv_ids: number[], data: string, pontos: number, observacao: string, lancado_por?: string) => Promise<void>;
  calcularTotalDBV: (dbv_id: number) => Promise<number>;
  getRankingGeral: (grupo?: 'desbravadores' | 'diretoria' | 'conselheiros') => Promise<Array<{ dbv_id: number; nome: string; unidade: string; total: number; foto_url?: string }>>;
}

function calcSQL(cfg: ConfigPontuacao) {
  return `(p.presenca * ${cfg.presenca}) + (p.pontualidade * ${cfg.pontualidade}) + (p.material * ${cfg.material}) + (p.uniforme * ${cfg.uniforme}) + p.pontos_extras`;
}

function somaPontuacaoBase(p: any, cfg: ConfigPontuacao): number {
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
  config: CONFIG_PADRAO,
  itens: [],

  carregarConfig: async () => {
    if (Platform.OS === 'web') {
      const { data: cfg } = await supabase
        .from('config_pontuacao')
        .select('presenca, pontualidade, material, uniforme')
        .eq('id', 1)
        .maybeSingle();
      const { data: itens } = await supabase
        .from('config_pontuacao_itens')
        .select('id, nome, valor, ativo')
        .order('nome');
      set({
        config: cfg ?? CONFIG_PADRAO,
        itens: (itens ?? []).map((i) => ({ ...i, ativo: i.ativo ? 1 : 0 })),
      });
      return;
    }

    const db = await getDB();
    const row = await db.getFirstAsync<ConfigPontuacao>(
      'SELECT presenca, pontualidade, material, uniforme FROM config_pontuacao WHERE id = 1'
    );
    if (row) set({ config: row });
    const itens = await db.getAllAsync<ConfigPontuacaoItem>(
      'SELECT id, nome, valor, ativo FROM config_pontuacao_itens ORDER BY nome'
    );
    set({ itens });
  },

  salvarConfig: async (c) => {
    if (Platform.OS === 'web') {
      const { error } = await supabase
        .from('config_pontuacao')
        .upsert({ id: 1, ...c, updated_at: new Date().toISOString() });
      if (error) throw error;
      set({ config: c });
      return;
    }

    const db = await getDB();
    await db.runAsync(
      `UPDATE config_pontuacao SET presenca=?, pontualidade=?, material=?, uniforme=?, updated_at=datetime('now') WHERE id=1`,
      [c.presenca, c.pontualidade, c.material, c.uniforme]
    );
    await adicionarFilaSync('config_pontuacao', 'UPDATE', { id: 1, ...c });
    set({ config: c });
  },

  criarItemConfig: async (nome, valor) => {
    if (Platform.OS === 'web') {
      const { error } = await supabase
        .from('config_pontuacao_itens')
        .insert({ nome: nome.trim(), valor, ativo: true });
      if (error) throw error;
      await get().carregarConfig();
      return;
    }

    const db = await getDB();
    const result = await db.runAsync(
      'INSERT INTO config_pontuacao_itens (nome, valor, ativo) VALUES (?, ?, 1)',
      [nome.trim(), valor]
    );
    await adicionarFilaSync('config_pontuacao_itens', 'INSERT', {
      id: result.lastInsertRowId, nome: nome.trim(), valor, ativo: 1,
    });
    await get().carregarConfig();
  },

  atualizarItemConfig: async (id, nome, valor, ativo) => {
    if (Platform.OS === 'web') {
      const { error } = await supabase
        .from('config_pontuacao_itens')
        .update({
          nome: nome.trim(),
          valor,
          ativo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
      await get().carregarConfig();
      return;
    }

    const db = await getDB();
    await db.runAsync(
      'UPDATE config_pontuacao_itens SET nome=?, valor=?, ativo=?, updated_at=datetime("now") WHERE id=?',
      [nome.trim(), valor, ativo ? 1 : 0, id]
    );
    await adicionarFilaSync('config_pontuacao_itens', 'UPDATE', {
      id, nome: nome.trim(), valor, ativo: ativo ? 1 : 0,
    });
    await get().carregarConfig();
  },

  excluirItemConfig: async (id) => {
    if (Platform.OS === 'web') {
      await supabase.from('pontuacoes_custom').delete().eq('item_id', id);
      const { error } = await supabase.from('config_pontuacao_itens').delete().eq('id', id);
      if (error) throw error;
      await get().carregarConfig();
      return;
    }

    const db = await getDB();
    await db.runAsync('DELETE FROM pontuacoes_custom WHERE item_id=?', [id]);
    await db.runAsync('DELETE FROM config_pontuacao_itens WHERE id=?', [id]);
    await adicionarFilaSync('config_pontuacao_itens', 'DELETE', { id });
    await get().carregarConfig();
  },

  salvarCustom: async (dbv_id, data, item_id, quantidade, valorUnitario) => {
    if (Platform.OS === 'web') {
      const pontos = quantidade * valorUnitario;
      const { data: existente } = await supabase
        .from('pontuacoes_custom')
        .select('id')
        .eq('dbv_id', dbv_id)
        .eq('data', data)
        .eq('item_id', item_id)
        .maybeSingle();
      if (existente?.id) {
        const { error } = await supabase
          .from('pontuacoes_custom')
          .update({ quantidade, pontos, updated_at: new Date().toISOString() })
          .eq('id', existente.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('pontuacoes_custom')
          .insert({ dbv_id, data, item_id, quantidade, pontos, updated_at: new Date().toISOString() });
        if (error) throw error;
      }
      return;
    }

    const db = await getDB();
    const pontos = quantidade * valorUnitario;
    await db.runAsync(
      `INSERT OR REPLACE INTO pontuacoes_custom
       (dbv_id, data, item_id, quantidade, pontos, updated_at, sincronizado)
       VALUES (?, ?, ?, ?, ?, datetime('now'), 0)`,
      [dbv_id, data, item_id, quantidade, pontos]
    );
    const row = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM pontuacoes_custom WHERE dbv_id=? AND data=? AND item_id=?',
      [dbv_id, data, item_id]
    );
    await adicionarFilaSync('pontuacoes_custom', 'INSERT', {
      id: row?.id, dbv_id, data, item_id, quantidade, pontos,
    });
  },

  carregarCustomPorData: async (data) => {
    if (Platform.OS === 'web') {
      const { data: rows, error } = await supabase
        .from('pontuacoes_custom')
        .select('dbv_id, item_id, quantidade')
        .eq('data', data);
      if (error) return {};
      const map: Record<number, Record<number, number>> = {};
      for (const r of rows ?? []) {
        if (!map[r.dbv_id]) map[r.dbv_id] = {};
        map[r.dbv_id][r.item_id] = r.quantidade;
      }
      return map;
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

  carregarPorData: async (data) => {
    if (Platform.OS === 'web') {
      const { data: lista } = await supabase.from('pontuacoes').select('*').eq('data', data);
      set({ pontuacoes: (lista ?? []) as Pontuacao[] });
      return;
    }

    const db = await getDB();
    const lista = await db.getAllAsync<Pontuacao>(
      'SELECT * FROM pontuacoes WHERE data = ?',
      [data]
    );
    set({ pontuacoes: lista });
  },

  lancarPontuacao: async (dados) => {
    if (Platform.OS === 'web') {
      const payload = {
        ...dados,
        presenca: !!dados.presenca,
        pontualidade: !!dados.pontualidade,
        material: !!dados.material,
        uniforme: !!dados.uniforme,
        updated_at: new Date().toISOString(),
      };
      const { data: existente } = await supabase
        .from('pontuacoes')
        .select('id')
        .eq('dbv_id', dados.dbv_id)
        .eq('data', dados.data)
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
      [dados.dbv_id, dados.data]
    );

    if (existente) {
      await db.runAsync(
        `UPDATE pontuacoes SET
          presenca=?, pontualidade=?, material=?, uniforme=?,
          bom_biblia=?, pontos_extras=?, classe_biblica=?,
          especialidade=?, pgm_especial=?, atividade_unidade=?,
          observacao=?, updated_at=datetime('now'), sincronizado=0
         WHERE id=?`,
        [
          dados.presenca ? 1 : 0, dados.pontualidade ? 1 : 0,
          dados.material ? 1 : 0, dados.uniforme ? 1 : 0,
          dados.bom_biblia, dados.pontos_extras, dados.classe_biblica,
          dados.especialidade, dados.pgm_especial, dados.atividade_unidade,
          dados.observacao ?? null, existente.id,
        ]
      );
      await adicionarFilaSync('pontuacoes', 'UPDATE', { id: existente.id, ...dados });
    } else {
      const result = await db.runAsync(
        `INSERT INTO pontuacoes
          (dbv_id, data, presenca, pontualidade, material, uniforme,
           bom_biblia, pontos_extras, classe_biblica, especialidade,
           pgm_especial, atividade_unidade, observacao, lancado_por)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          dados.dbv_id, dados.data,
          dados.presenca ? 1 : 0, dados.pontualidade ? 1 : 0,
          dados.material ? 1 : 0, dados.uniforme ? 1 : 0,
          dados.bom_biblia, dados.pontos_extras, dados.classe_biblica,
          dados.especialidade, dados.pgm_especial, dados.atividade_unidade,
          dados.observacao ?? null, dados.lancado_por ?? null,
        ]
      );
      await adicionarFilaSync('pontuacoes', 'INSERT', { id: result.lastInsertRowId, ...dados });
    }
  },

  adicionarPontosExtras: async (dbv_ids, data, pontos, observacao, lancado_por) => {
    if (Platform.OS === 'web') {
      for (const dbv_id of dbv_ids) {
        const { data: existente } = await supabase
          .from('pontuacoes')
          .select('id, pontos_extras')
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
          id: existente.id, pontos_extras: novoTotal, observacao: observacao || null,
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
          id: result.lastInsertRowId, dbv_id, data,
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
      const [{ data: pontuacoes }, { data: custom }] = await Promise.all([
        supabase.from('pontuacoes').select('*').eq('dbv_id', dbv_id),
        supabase.from('pontuacoes_custom').select('pontos').eq('dbv_id', dbv_id),
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
    if (Platform.OS === 'web') {
      const cfg = get().config;
      const [{ data: membros }, { data: pontuacoes }, { data: custom }] = await Promise.all([
        supabase
          .from('desbravadores')
          .select('id, nome, unidade_nome, cargo, foto_url')
          .order('nome'),
        supabase.from('pontuacoes').select('*'),
        supabase.from('pontuacoes_custom').select('dbv_id, pontos'),
      ]);

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
    }

    const db = await getDB();
    const cfg = get().config;
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
       WHERE 1=1 ${whereGrupo}
       ORDER BY total DESC`
    );
  },
}));
