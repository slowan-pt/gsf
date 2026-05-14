import { create } from 'zustand';
import { getDB } from '../lib/database';
import { adicionarFilaSync } from '../lib/sync';
import type { ConfigCampori, PagamentoCampori, ParcelaCamporiConfig } from '../types';

interface CamporiState {
  config: ConfigCampori | null;
  pagamentos: PagamentoCampori[];
  carregarConfig: () => Promise<void>;
  carregarPagamentos: () => Promise<void>;
  salvarConfig: (numParcelas: number, parcelas: ParcelaCamporiConfig[]) => Promise<void>;
  marcarPago: (dbv_id: number, parcela: number, valor: number, data?: string) => Promise<void>;
  desmarcarPago: (dbv_id: number, parcela: number) => Promise<void>;
  getPagamentosDBV: (dbv_id: number) => PagamentoCampori[];
  getResumoFinanceiro: () => { totalEsperado: number; totalArrecadado: number; totalFaltando: number; dbvsInscritos: number };
}

export const useCamporiStore = create<CamporiState>((set, get) => ({
  config: null,
  pagamentos: [],

  carregarConfig: async () => {
    const db = await getDB();
    const cfg = await db.getFirstAsync<{ id: number; num_parcelas: number; data_vencimento_dia: number; updated_at: string }>(
      'SELECT * FROM config_campori WHERE id = 1'
    );
    const parcelas = await db.getAllAsync<ParcelaCamporiConfig>(
      'SELECT numero, valor, descricao FROM parcelas_campori_config ORDER BY numero'
    );
    if (cfg) {
      set({ config: { ...cfg, parcelas } });
    }
  },

  carregarPagamentos: async () => {
    const db = await getDB();
    const lista = await db.getAllAsync<PagamentoCampori>(
      'SELECT * FROM pagamentos_campori ORDER BY dbv_id, parcela_numero'
    );
    set({ pagamentos: lista });
  },

  salvarConfig: async (numParcelas, parcelas) => {
    const db = await getDB();
    await db.runAsync(
      `UPDATE config_campori SET num_parcelas = ?, updated_at = datetime('now') WHERE id = 1`,
      [numParcelas]
    );
    await db.runAsync('DELETE FROM parcelas_campori_config');
    for (const p of parcelas) {
      await db.runAsync(
        'INSERT INTO parcelas_campori_config (numero, valor, descricao) VALUES (?, ?, ?)',
        [p.numero, p.valor, p.descricao ?? `${p.numero}ª Parcela`]
      );
    }
    await get().carregarConfig();
  },

  marcarPago: async (dbv_id, parcela, valor, data) => {
    const db = await getDB();
    const existe = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM pagamentos_campori WHERE dbv_id = ? AND parcela_numero = ?',
      [dbv_id, parcela]
    );
    const dataStr = data ?? new Date().toISOString().split('T')[0];

    if (existe) {
      await db.runAsync(
        `UPDATE pagamentos_campori SET pago = 1, valor_pago = ?, data_pagamento = ?,
         updated_at = datetime('now'), sincronizado = 0 WHERE id = ?`,
        [valor, dataStr, existe.id]
      );
      await adicionarFilaSync('pagamentos_campori', 'UPDATE', { id: existe.id, pago: 1, valor_pago: valor, data_pagamento: dataStr });
    } else {
      const r = await db.runAsync(
        `INSERT INTO pagamentos_campori (dbv_id, parcela_numero, valor_pago, data_pagamento, pago)
         VALUES (?, ?, ?, ?, 1)`,
        [dbv_id, parcela, valor, dataStr]
      );
      await adicionarFilaSync('pagamentos_campori', 'INSERT', { id: r.lastInsertRowId, dbv_id, parcela_numero: parcela, valor_pago: valor, data_pagamento: dataStr, pago: 1 });
    }
    await get().carregarPagamentos();
  },

  desmarcarPago: async (dbv_id, parcela) => {
    const db = await getDB();
    await db.runAsync(
      `UPDATE pagamentos_campori SET pago = 0, updated_at = datetime('now'), sincronizado = 0
       WHERE dbv_id = ? AND parcela_numero = ?`,
      [dbv_id, parcela]
    );
    await get().carregarPagamentos();
  },

  getPagamentosDBV: (dbv_id) =>
    get().pagamentos.filter((p) => p.dbv_id === dbv_id),

  getResumoFinanceiro: () => {
    const { config, pagamentos } = get();
    if (!config) return { totalEsperado: 0, totalArrecadado: 0, totalFaltando: 0, dbvsInscritos: 0 };

    const valorTotal = config.parcelas.reduce((s, p) => s + p.valor, 0);
    const dbvsInscritos = new Set(pagamentos.map((p) => p.dbv_id).filter(Boolean)).size;

    // buscar na store de dbvs quantos têm campori = true
    // simplificado: calcula pelos pagamentos existentes
    const totalEsperado = dbvsInscritos * valorTotal;
    const totalArrecadado = pagamentos.filter((p) => p.pago).reduce((s, p) => s + p.valor_pago, 0);

    return {
      totalEsperado,
      totalArrecadado,
      totalFaltando: totalEsperado - totalArrecadado,
      dbvsInscritos,
    };
  },
}));
