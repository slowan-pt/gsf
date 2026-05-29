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
  valor: number;
  ativo: number;
}

const CONFIG_PADRAO: ConfigPontuacao = {
  presenca: 25,
  pontualidade: 100,
  material: 25,
  uniforme: 25,
};

function textoSeguro(v: unknown): string | null {
  const s = String(v ?? '').trim();
  return s.length ? s : null;
}

function numeroSeguro(v: unknown, padrao = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : padrao;
}

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
  config: CONFIG_PADRAO,
  itens: [],

  carregarConfig: async () => {
    if (Platform.OS === 'web') {
      const clubeId = getClubeAtivoId();
      const { data: cfg } = await supabase
        .from('config_pontuacao')
        .select('presenca, pontualidade, material, uniforme')
        .eq('clube_id', clubeId)
        .maybeSingle();
      const { data: itens } = await supabase
        .from('pontuacao_itens')
        .select('id, titulo, valor, ativo')
        .eq('clube_id', clubeId)
        .eq('ativo', true)
        .order('ordem');
      set({
        config: cfg ?? CONFIG_PADRAO,
        itens: (itens ?? []).map((i) => ({ id: i.id, nome: i.titulo, valor: i.valor, ativo: 1 })),
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

    if (Platform.OS === 'web') {
      const clubeId = getClubeAtivoId();
      const sigla = nomeLimpo.split(/\s+/).map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 6) || nomeLimpo.slice(0, 4).toUpperCase();
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
      return;
    }

    const db = await getDB();
    const result = await db.runAsync(
      'INSERT INTO config_pontuacao_itens (nome, valor, ativo) VALUES (?, ?, 1)',
      [nomeLimpo, valorLimpo]
    );
    await adicionarFilaSync('config_pontuacao_itens', 'INSERT', {
      id: result.lastInsertRowId, nome: nomeLimpo, valor: valorLimpo, ativo: 1,
    });
    await get().carregarConfig();
  },

  atualizarItemConfig: async (id, nome, valor, ativo) => {
    const nomeLimpo = textoSeguro(nome);
    const valorLimpo = numeroSeguro(valor);
    if (!nomeLimpo) throw new Error('Informe o título da pontuação.');

    if (Platform.OS === 'web') {
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
      return;
    }

    const db = await getDB();
    await db.runAsync(
      'UPDATE config_pontuacao_itens SET nome=?, valor=?, ativo=?, updated_at=datetime("now") WHERE id=?',
      [nomeLimpo, valorLimpo, ativo ? 1 : 0, id]
    );
    await adicionarFilaSync('config_pontuacao_itens', 'UPDATE', {
      id, nome: nomeLimpo, valor: valorLimpo, ativo: ativo ? 1 : 0,
    });
    await get().carregarConfig();
  },

  excluirItemConfig: async (id) => {
    if (Platform.OS === 'web') {
      const clubeId = getClubeAtivoId();
      const { error } = await supabase
        .from('pontuacao_itens')
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq('clube_id', clubeId)
        .eq('id', id);
      if (error) throw error;
      await get().carregarConfig();
      return;
    }

    const db = await getDB();
    await db.runAsync('UPDATE config_pontuacao_itens SET ativo=0, updated_at=datetime("now") WHERE id=?', [id]);
    await adicionarFilaSync('config_pontuacao_itens', 'UPDATE', { id, ativo: 0 });
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
        id: existente.id, dbv_id: dbvId, data: dataLimpa, item_id: itemId,
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
        id: row?.id ?? null, dbv_id: dbvId, data: dataLimpa, item_id: itemId,
        item_nome: item?.nome ?? null, item_valor: item?.valor ?? valor,
        quantidade: qtd, pontos: pontosFinais,
      });
    }
  },

  carregarCustomPorData: async (data) => {
    if (Platform.OS === 'web') {
      const { data: rows, error } = await supabase
        .from('pontuacoes_custom')
        .select('dbv_id, item_id, quantidade')
        .eq('clube_id', getClubeAtivoId())
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
      const { data: lista } = await supabase
        .from('pontuacoes')
        .select('*')
        .eq('clube_id', getClubeAtivoId())
        .eq('data', data);
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
      await adicionarFilaSync('pontuacoes', 'UPDATE', { id: existente.id, ...dadosLimpos, presenca_pts: presencaPts, pontualidade_pts: pontualidadePts, material_pts: materialPts, uniforme_pts: uniformePts });
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
      await adicionarFilaSync('pontuacoes', 'INSERT', { id: result.lastInsertRowId, ...dadosLimpos, presenca_pts: presencaPts, pontualidade_pts: pontualidadePts, material_pts: materialPts, uniforme_pts: uniformePts });
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
    if (Platform.OS === 'web') {
      const cfg = get().config;
      const clubeId = getClubeAtivoId();
      const [{ data: membros }, { data: pontuacoes }, { data: custom }] = await Promise.all([
        supabase
          .from('desbravadores')
          .select('id, nome, unidade_nome, cargo, foto_url')
          .eq('clube_id', clubeId)
          .neq('ativo', false)
          .order('nome'),
        supabase.from('pontuacoes').select('*').eq('clube_id', clubeId),
        supabase.from('pontuacoes_custom').select('dbv_id, pontos').eq('clube_id', clubeId),
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
       WHERE (d.ativo IS NULL OR d.ativo = 1) ${whereGrupo}
       ORDER BY total DESC`
    );
  },
}));
