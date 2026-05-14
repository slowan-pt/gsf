import { create } from 'zustand';
import { Platform } from 'react-native';
import { getDB } from '../lib/database';
import { adicionarFilaSync, puxarDeSupabase } from '../lib/sync';
import { popularBancoDeDados } from '../lib/seed_local';
import { supabase } from '../lib/supabase';
import type { Desbravador, Documento, ProgressoClasse } from '../types';

type DBVInput = Partial<Omit<Desbravador, 'id' | 'created_at' | 'updated_at'>>;

function valorDB(v: unknown) {
  return v === undefined ? null : v;
}

async function buscarDesbravadoresSupabase(): Promise<Desbravador[]> {
  const { data, error } = await supabase
    .from('desbravadores')
    .select('*')
    .order('unidade_nome', { ascending: true, nullsFirst: false })
    .order('nome', { ascending: true });
  if (error || !data) return [];
  return data as Desbravador[];
}

interface DBVState {
  desbravadores: Desbravador[];
  carregando: boolean;
  carregar: () => Promise<void>;
  buscar: (texto: string) => Desbravador[];
  filtrarPorUnidade: (unidade_id: number) => Desbravador[];
  criarDesbravador: (dados: DBVInput) => Promise<number>;
  editarDesbravador: (id: number, dados: DBVInput) => Promise<void>;
  excluirDesbravador: (id: number) => Promise<void>;
  atualizarCampori: (dbv_id: number, vai: boolean) => Promise<void>;
  atualizarDocumento: (dbv_id: number, campo: string, valor: string) => Promise<void>;
  atualizarClasse: (dbv_id: number, campo: string, valor: string) => Promise<void>;
  moverParaUnidade: (dbv_id: number, unidade_id: number | null, unidade_nome: string | null) => Promise<void>;
  atualizarFoto: (dbv_id: number, foto_url: string) => Promise<void>;
}

export const useDBVStore = create<DBVState>((set, get) => ({
  desbravadores: [],
  carregando: false,

  carregar: async () => {
    set({ carregando: true });
    if (Platform.OS === 'web') {
      const remotos = await buscarDesbravadoresSupabase();
      if (remotos.length > 0) {
        set({ desbravadores: remotos, carregando: false });
        return;
      }
    }

    const db = await getDB();
    let lista = await db.getAllAsync<Desbravador>(
      'SELECT * FROM desbravadores ORDER BY unidade_nome, nome'
    );
    if (lista.length === 0) {
      await popularBancoDeDados();
      puxarDeSupabase().catch(() => {});
      lista = await db.getAllAsync<Desbravador>(
        'SELECT * FROM desbravadores ORDER BY unidade_nome, nome'
      );
    }
    if (lista.length === 0 && Platform.OS === 'web') {
      lista = await buscarDesbravadoresSupabase();
    }
    set({ desbravadores: lista, carregando: false });
  },

  buscar: (texto) => {
    const t = texto.toLowerCase();
    return get().desbravadores.filter((d) => d.nome.toLowerCase().includes(t));
  },

  filtrarPorUnidade: (unidade_id) =>
    get().desbravadores.filter((d) => d.unidade_id === unidade_id),

  criarDesbravador: async (dados) => {
    if (Platform.OS === 'web') {
      const { data, error } = await supabase
        .from('desbravadores')
        .insert({
          nome: dados.nome ?? '',
          genero: dados.genero ?? null,
          data_nascimento: dados.data_nascimento ?? null,
          idade: dados.idade ?? null,
          cargo: dados.cargo ?? null,
          unidade_id: dados.unidade_id ?? null,
          unidade_nome: dados.unidade_nome ?? null,
          contato: dados.contato ?? null,
          email: dados.email ?? null,
          camisa: dados.camisa ?? null,
          campori_dsa: !!dados.campori_dsa,
          nome_responsavel: dados.nome_responsavel ?? null,
          contato_responsavel: dados.contato_responsavel ?? null,
        })
        .select('id')
        .single();
      if (error) throw error;
      await get().carregar();
      return data.id;
    }

    const db = await getDB();
    const r = await db.runAsync(
      `INSERT INTO desbravadores (nome, genero, data_nascimento, idade, cargo, unidade_id, unidade_nome,
        contato, email, camisa, campori_dsa, nome_responsavel, contato_responsavel)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        dados.nome ?? '', dados.genero ?? null, dados.data_nascimento ?? null,
        dados.idade ?? null, dados.cargo ?? null, dados.unidade_id ?? null,
        dados.unidade_nome ?? null, dados.contato ?? null, dados.email ?? null,
        dados.camisa ?? null, dados.campori_dsa ? 1 : 0,
        dados.nome_responsavel ?? null, dados.contato_responsavel ?? null,
      ]
    );
    // Cria documentos e progresso zerados
    await db.runAsync('INSERT OR IGNORE INTO documentos (dbv_id) VALUES (?)', [r.lastInsertRowId]);
    await db.runAsync('INSERT OR IGNORE INTO progresso_classes (dbv_id) VALUES (?)', [r.lastInsertRowId]);
    await adicionarFilaSync('desbravadores', 'INSERT', { id: r.lastInsertRowId, ...dados });
    await get().carregar();
    return r.lastInsertRowId;
  },

  editarDesbravador: async (id, dados) => {
    if (Platform.OS === 'web') {
      const payload = Object.fromEntries(
        Object.entries(dados)
          .filter(([k]) => k !== 'id')
          .map(([k, v]) => [k, valorDB(v)])
      );
      if (Object.keys(payload).length === 0) return;
      const { error } = await supabase
        .from('desbravadores')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      set((s) => ({
        desbravadores: s.desbravadores.map((d) =>
          d.id === id ? { ...d, ...(payload as Partial<Desbravador>) } : d
        ),
      }));
      return;
    }

    const db = await getDB();
    const campos = Object.keys(dados).filter((k) => k !== 'id');
    if (campos.length === 0) return;
    const sets = campos.map((k) => `${k} = ?`).join(', ');
    const vals = campos.map((k) => valorDB((dados as any)[k])) as any[];
    await db.runAsync(
      `UPDATE desbravadores SET ${sets}, updated_at = datetime('now'), sincronizado = 0 WHERE id = ?`,
      [...vals, id]
    );
    await adicionarFilaSync('desbravadores', 'UPDATE', { id, ...dados });
    await get().carregar();
  },

  excluirDesbravador: async (id) => {
    if (Platform.OS === 'web') {
      const { error } = await supabase.from('desbravadores').delete().eq('id', id);
      if (error) throw error;
      set((s) => ({ desbravadores: s.desbravadores.filter((d) => d.id !== id) }));
      return;
    }

    const db = await getDB();
    await db.runAsync('DELETE FROM pontuacoes WHERE dbv_id = ?', [id]);
    await db.runAsync('DELETE FROM documentos WHERE dbv_id = ?', [id]);
    await db.runAsync('DELETE FROM progresso_classes WHERE dbv_id = ?', [id]);
    await db.runAsync('DELETE FROM especialidades WHERE dbv_id = ?', [id]);
    await db.runAsync('DELETE FROM documento_imagens WHERE dbv_id = ?', [id]);
    await db.runAsync('DELETE FROM desbravadores WHERE id = ?', [id]);
    await adicionarFilaSync('desbravadores', 'DELETE', { id });
    set((s) => ({ desbravadores: s.desbravadores.filter((d) => d.id !== id) }));
  },

  atualizarCampori: async (dbv_id, vai) => {
    const db = await getDB();
    const val = vai ? 1 : 0;
    await db.runAsync(
      'UPDATE desbravadores SET campori_dsa = ?, updated_at = datetime("now"), sincronizado = 0 WHERE id = ?',
      [val, dbv_id]
    );
    await adicionarFilaSync('desbravadores', 'UPDATE', { id: dbv_id, campori_dsa: val });
    set((s) => ({
      desbravadores: s.desbravadores.map((d) =>
        d.id === dbv_id ? { ...d, campori_dsa: vai } : d
      ),
    }));
  },

  atualizarDocumento: async (dbv_id, campo, valor) => {
    const db = await getDB();
    await db.runAsync(
      `UPDATE documentos SET ${campo} = ?, updated_at = datetime('now'), sincronizado = 0 WHERE dbv_id = ?`,
      [valor, dbv_id]
    );
    await adicionarFilaSync('documentos', 'UPDATE', { dbv_id, [campo]: valor });
  },

  atualizarClasse: async (dbv_id, campo, valor) => {
    const db = await getDB();
    await db.runAsync(
      `UPDATE progresso_classes SET ${campo} = ?, updated_at = datetime('now'), sincronizado = 0 WHERE dbv_id = ?`,
      [valor, dbv_id]
    );
    await adicionarFilaSync('progresso_classes', 'UPDATE', { dbv_id, [campo]: valor });
  },

  atualizarFoto: async (dbv_id, foto_url) => {
    const db = await getDB();
    await db.runAsync(
      `UPDATE desbravadores SET foto_url = ?, updated_at = datetime('now'), sincronizado = 0 WHERE id = ?`,
      [foto_url, dbv_id]
    );
    await adicionarFilaSync('desbravadores', 'UPDATE', { id: dbv_id, foto_url });
    set((s) => ({
      desbravadores: s.desbravadores.map((d) =>
        d.id === dbv_id ? { ...d, foto_url } : d
      ),
    }));
  },

  moverParaUnidade: async (dbv_id, unidade_id, unidade_nome) => {
    if (Platform.OS === 'web') {
      const { error } = await supabase
        .from('desbravadores')
        .update({
          unidade_id,
          unidade_nome,
          updated_at: new Date().toISOString(),
        })
        .eq('id', dbv_id);
      if (error) throw error;
      set((s) => ({
        desbravadores: s.desbravadores.map((d) =>
          d.id === dbv_id ? { ...d, unidade_id: unidade_id as number, unidade_nome: unidade_nome ?? '' } : d
        ),
      }));
      return;
    }

    const db = await getDB();
    await db.runAsync(
      `UPDATE desbravadores SET unidade_id = ?, unidade_nome = ?, updated_at = datetime('now'), sincronizado = 0 WHERE id = ?`,
      [unidade_id, unidade_nome, dbv_id]
    );
    await adicionarFilaSync('desbravadores', 'UPDATE', { id: dbv_id, unidade_id, unidade_nome });
    set((s) => ({
      desbravadores: s.desbravadores.map((d) =>
        d.id === dbv_id ? { ...d, unidade_id: unidade_id as number, unidade_nome: unidade_nome ?? '' } : d
      ),
    }));
  },
}));
