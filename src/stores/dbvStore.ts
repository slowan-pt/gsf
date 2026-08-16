import { create } from 'zustand';
import { Platform } from 'react-native';
import { getDB } from '../lib/database';
import { adicionarFilaSync, puxarDeSupabase } from '../lib/sync';
import { popularBancoDeDados } from '../lib/seed_local';
import { supabase } from '../lib/supabase';
import { getClubeAtivoId } from '../lib/contextoAtual';
import type { Desbravador, Documento, ProgressoClasse } from '../types';

type DBVInput = Partial<Omit<Desbravador, 'id' | 'created_at' | 'updated_at'>>;

const CAMPOS_DOCUMENTO = new Set(['rg','cpf','rg_resp','cartao_sus','cartao_plano','ficha_saude','carteira_vacinacao','laudo_medico','ficha_reg','comp_residencia','aut_saida','aut_viagem','ri_assinado','foto','ant_criminais']);
const CAMPOS_CLASSE = new Set(['amigo','amigo_nat','companheiro','comp_exc','pesquisador','pesquisador_cb','pioneiro','pioneiro_nf','excursionista','exc_mata','guia','guia_exp','agrupada','lider','lider_master','lider_ma']);
const CAMPOS_DBV = new Set(['idx','id_sgc','nome','data_nascimento','idade','genero','unidade_id','unidade_nome','cargo','cargo_adicional','contato','email','camisa','calca','campori_dsa','nome_responsavel','contato_responsavel','foto_url','ativo','sincronizado']);

function valorDB(v: unknown) {
  return v === undefined ? null : v;
}

async function buscarDesbravadoresSupabase(incluirInativos = false): Promise<Desbravador[]> {
  const clubeId = getClubeAtivoId();
  let query = supabase
    .from('desbravadores')
    .select('*')
    .eq('clube_id', clubeId)
    .order('unidade_nome', { ascending: true, nullsFirst: false })
    .order('nome', { ascending: true });
  if (!incluirInativos) query = query.neq('ativo', false);
  const { data, error } = await query;
  if (error || !data) return [];
  return data as Desbravador[];
}

interface DBVState {
  desbravadores: Desbravador[];
  carregando: boolean;
  carregar: (incluirInativos?: boolean) => Promise<void>;
  buscar: (texto: string) => Desbravador[];
  filtrarPorUnidade: (unidade_id: number) => Desbravador[];
  criarDesbravador: (dados: DBVInput) => Promise<number>;
  editarDesbravador: (id: number, dados: DBVInput) => Promise<void>;
  excluirDesbravador: (id: number) => Promise<void>;
  inativarDesbravador: (id: number) => Promise<void>;
  atualizarCampori: (dbv_id: number, vai: boolean) => Promise<void>;
  atualizarDocumento: (dbv_id: number, campo: string, valor: string) => Promise<void>;
  atualizarClasse: (dbv_id: number, campo: string, valor: string) => Promise<void>;
  moverParaUnidade: (dbv_id: number, unidade_id: number | null, unidade_nome: string | null) => Promise<void>;
  atualizarFoto: (dbv_id: number, foto_url: string) => Promise<void>;
}

export const useDBVStore = create<DBVState>((set, get) => ({
  desbravadores: [],
  carregando: false,

  carregar: async (incluirInativos = false) => {
    set({ carregando: true });

    // SERVIDOR PRIMEIRO, sempre. Ler o SQLite antes travava esta função durante
    // todo o download inicial: puxarDeSupabase mantém uma transação exclusiva
    // aberta, e qualquer consulta local fica na fila até ela terminar. Por isso
    // Membros/Pontuação/Extras ficavam vazios enquanto Ranking e Classes — que
    // vão direto ao servidor — já mostravam tudo.
    const remotos = await buscarDesbravadoresSupabase(incluirInativos);
    if (remotos.length > 0) {
      set({ desbravadores: remotos, carregando: false });
      return;
    }

    // Sem resposta do servidor (offline): aí sim usa o cache local.
    const db = await getDB();
    const filtroAtivo = incluirInativos ? '' : 'WHERE (ativo IS NULL OR ativo = 1)';
    const lista = await db.getAllAsync<Desbravador>(
      `SELECT * FROM desbravadores ${filtroAtivo} ORDER BY unidade_nome, nome`
    );

    if (lista.length === 0 && !incluirInativos) {
      await popularBancoDeDados();
      puxarDeSupabase().catch(() => {});
      const aposSeed = await db.getAllAsync<Desbravador>(
        'SELECT * FROM desbravadores WHERE (ativo IS NULL OR ativo = 1) ORDER BY unidade_nome, nome'
      );
      set({ desbravadores: aposSeed, carregando: false });
      return;
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
      const clubeId = getClubeAtivoId();
      const { data: ultimoIdx } = await supabase
        .from('desbravadores')
        .select('idx')
        .eq('clube_id', clubeId)
        .not('idx', 'is', null)
        .order('idx', { ascending: false })
        .limit(1)
        .maybeSingle();
      const proximoIdx = Number(ultimoIdx?.idx ?? 0) + 1;
      const payload = {
        idx: proximoIdx,
        clube_id: clubeId,
        nome: dados.nome ?? '',
        genero: dados.genero ?? null,
        data_nascimento: dados.data_nascimento ?? null,
        idade: dados.idade ?? null,
        cargo: dados.cargo ?? null,
        cargo_adicional: dados.cargo_adicional ?? null,
        unidade_id: dados.unidade_id ?? null,
        unidade_nome: dados.unidade_nome ?? null,
        contato: dados.contato ?? null,
        email: dados.email ?? null,
        camisa: dados.camisa ?? null,
        calca: dados.calca ?? null,
        campori_dsa: !!dados.campori_dsa,
        nome_responsavel: dados.nome_responsavel ?? null,
        contato_responsavel: dados.contato_responsavel ?? null,
        ativo: true,
      };
      const { data: novoMembro, error } = await supabase
        .from('desbravadores')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;
      const novoId = novoMembro.id;
      await Promise.allSettled([
        supabase.from('documentos').insert({ dbv_id: novoId, clube_id: clubeId }),
        supabase.from('progresso_classes').insert({ dbv_id: novoId, clube_id: clubeId }),
      ]);
      await get().carregar();
      return novoId;
    }

    const db = await getDB();
    const r = await db.runAsync(
      `INSERT INTO desbravadores (nome, genero, data_nascimento, idade, cargo, cargo_adicional, unidade_id, unidade_nome,
        contato, email, camisa, calca, campori_dsa, nome_responsavel, contato_responsavel)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        dados.nome ?? '', dados.genero ?? null, dados.data_nascimento ?? null,
        dados.idade ?? null, dados.cargo ?? null, dados.cargo_adicional ?? null, dados.unidade_id ?? null,
        dados.unidade_nome ?? null, dados.contato ?? null, dados.email ?? null,
        dados.camisa ?? null, dados.calca ?? null, dados.campori_dsa ? 1 : 0,
        dados.nome_responsavel ?? null, dados.contato_responsavel ?? null,
      ]
    );
    // Cria documentos e progresso zerados
    await db.runAsync('INSERT OR IGNORE INTO documentos (dbv_id) VALUES (?)', [r.lastInsertRowId]);
    await db.runAsync('INSERT OR IGNORE INTO progresso_classes (dbv_id) VALUES (?)', [r.lastInsertRowId]);
    // clube_id é obrigatório: sem ele o membro chega ao servidor "sem clube" e
    // some de todas as telas, que filtram por clube.
    await adicionarFilaSync('desbravadores', 'INSERT', {
      id: r.lastInsertRowId, clube_id: getClubeAtivoId(), ...dados,
    });
    await get().carregar();
    return r.lastInsertRowId;
  },

  editarDesbravador: async (id, dados) => {
    if (Platform.OS === 'web') {
      const payload = Object.fromEntries(
        Object.entries(dados)
          .filter(([k]) => k !== 'id' && k !== 'clube_id')
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
    const campos = Object.keys(dados).filter((k) => CAMPOS_DBV.has(k));
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
      const clubeId = getClubeAtivoId();
      await Promise.allSettled([
        supabase.from('pontuacoes_custom').delete().eq('clube_id', clubeId).eq('dbv_id', id),
        supabase.from('pontuacoes').delete().eq('clube_id', clubeId).eq('dbv_id', id),
        supabase.from('documento_imagens').delete().eq('clube_id', clubeId).eq('dbv_id', id),
        supabase.from('documentos').delete().eq('clube_id', clubeId).eq('dbv_id', id),
        supabase.from('progresso_classes').delete().eq('clube_id', clubeId).eq('dbv_id', id),
        supabase.from('especialidades').delete().eq('clube_id', clubeId).eq('dbv_id', id),
        supabase.from('atividades_respostas').delete().eq('clube_id', clubeId).eq('dbv_id', id),
      ]);
      const { error } = await supabase.from('desbravadores').delete().eq('clube_id', clubeId).eq('id', id);
      if (error) throw error;
      set((s) => ({ desbravadores: s.desbravadores.filter((d) => d.id !== id) }));
      return;
    }

    const db = await getDB();
    await db.runAsync('DELETE FROM pontuacoes WHERE dbv_id = ?', [id]);
    await db.runAsync('DELETE FROM pontuacoes_custom WHERE dbv_id = ?', [id]);
    await db.runAsync('DELETE FROM documentos WHERE dbv_id = ?', [id]);
    await db.runAsync('DELETE FROM progresso_classes WHERE dbv_id = ?', [id]);
    await db.runAsync('DELETE FROM especialidades WHERE dbv_id = ?', [id]);
    await db.runAsync('DELETE FROM documento_imagens WHERE dbv_id = ?', [id]);
    await db.runAsync('DELETE FROM atividades_respostas WHERE dbv_id = ?', [id]);
    await db.runAsync('DELETE FROM investidura_itens WHERE dbv_id = ?', [id]);
    await db.runAsync('DELETE FROM desbravadores WHERE id = ?', [id]);
    await adicionarFilaSync('desbravadores', 'DELETE', { id });
    set((s) => ({ desbravadores: s.desbravadores.filter((d) => d.id !== id) }));
  },

  inativarDesbravador: async (id) => {
    if (Platform.OS === 'web') {
      const { error } = await supabase
        .from('desbravadores')
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq('clube_id', getClubeAtivoId())
        .eq('id', id);
      if (error) throw error;
      set((s) => ({ desbravadores: s.desbravadores.filter((d) => d.id !== id) }));
      return;
    }

    const db = await getDB();
    await db.runAsync(
      `UPDATE desbravadores SET ativo = 0, updated_at = datetime('now'), sincronizado = 0 WHERE id = ?`,
      [id]
    );
    await adicionarFilaSync('desbravadores', 'UPDATE', { id, ativo: 0 });
    set((s) => ({ desbravadores: s.desbravadores.filter((d) => d.id !== id) }));
  },

  atualizarCampori: async (dbv_id, vai) => {
    if (Platform.OS === 'web') {
      const { error } = await supabase
        .from('desbravadores')
        .update({ campori_dsa: vai, updated_at: new Date().toISOString() })
        .eq('clube_id', getClubeAtivoId())
        .eq('id', dbv_id);
      if (error) throw error;
      set((s) => ({
        desbravadores: s.desbravadores.map((d) =>
          d.id === dbv_id ? { ...d, campori_dsa: vai } : d
        ),
      }));
      return;
    }

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
    if (Platform.OS !== 'web' && !CAMPOS_DOCUMENTO.has(campo)) {
      throw new Error(`Campo inválido: ${campo}`);
    }

    // Web e app seguem o MESMO caminho quando online. Antes o app só enfileirava
    // um upsert sem id e sem clube_id, que criava uma linha duplicada e "sem
    // clube" no servidor em vez de atualizar a existente.
    try {
      const payload = { [campo]: valor || null, updated_at: new Date().toISOString() };
      const { data: existente, error: buscaErro } = await supabase
        .from('documentos')
        .select('id')
        .eq('dbv_id', dbv_id)
        .eq('clube_id', getClubeAtivoId())
        .maybeSingle();
      if (buscaErro) throw buscaErro;
      const resp = existente?.id
        ? await supabase.from('documentos').update(payload).eq('id', existente.id)
        : await supabase.from('documentos').insert({ dbv_id, clube_id: getClubeAtivoId(), [campo]: valor || null });
      if (resp.error) throw resp.error;
      if (Platform.OS !== 'web') {
        const db = await getDB();
        await db.runAsync(
          `UPDATE documentos SET ${campo} = ?, updated_at = datetime('now'), sincronizado = 1 WHERE dbv_id = ?`,
          [valor, dbv_id]
        );
      }
      return;
    } catch (erro) {
      if (Platform.OS === 'web') throw erro;
      // Offline no app instalado: grava local e enfileira.
    }

    const db = await getDB();
    await db.runAsync(
      `UPDATE documentos SET ${campo} = ?, updated_at = datetime('now'), sincronizado = 0 WHERE dbv_id = ?`,
      [valor, dbv_id]
    );
    await adicionarFilaSync('documentos', 'UPDATE', { dbv_id, clube_id: getClubeAtivoId(), [campo]: valor });
  },

  atualizarClasse: async (dbv_id, campo, valor) => {
    if (Platform.OS !== 'web' && !CAMPOS_CLASSE.has(campo)) {
      throw new Error(`Campo inválido: ${campo}`);
    }

    // Mesmo caminho do web quando online (ver atualizarDocumento).
    try {
      const payload = { [campo]: valor || null, updated_at: new Date().toISOString() };
      const { data: existente, error: buscaErro } = await supabase
        .from('progresso_classes')
        .select('id')
        .eq('dbv_id', dbv_id)
        .eq('clube_id', getClubeAtivoId())
        .maybeSingle();
      if (buscaErro) throw buscaErro;
      const resp = existente?.id
        ? await supabase.from('progresso_classes').update(payload).eq('id', existente.id)
        : await supabase.from('progresso_classes').insert({ dbv_id, clube_id: getClubeAtivoId(), [campo]: valor || null });
      if (resp.error) throw resp.error;
      if (Platform.OS !== 'web') {
        const db = await getDB();
        await db.runAsync(
          `UPDATE progresso_classes SET ${campo} = ?, updated_at = datetime('now'), sincronizado = 1 WHERE dbv_id = ?`,
          [valor, dbv_id]
        );
      }
      return;
    } catch (erro) {
      if (Platform.OS === 'web') throw erro;
      // Offline no app instalado: grava local e enfileira.
    }

    const db = await getDB();
    await db.runAsync(
      `UPDATE progresso_classes SET ${campo} = ?, updated_at = datetime('now'), sincronizado = 0 WHERE dbv_id = ?`,
      [valor, dbv_id]
    );
    await adicionarFilaSync('progresso_classes', 'UPDATE', { dbv_id, clube_id: getClubeAtivoId(), [campo]: valor });
  },

  atualizarFoto: async (dbv_id, foto_url) => {
    if (Platform.OS === 'web') {
      const { error } = await supabase
        .from('desbravadores')
        .update({ foto_url, updated_at: new Date().toISOString() })
        .eq('clube_id', getClubeAtivoId())
        .eq('id', dbv_id);
      if (error) throw error;
      set((s) => ({
        desbravadores: s.desbravadores.map((d) =>
          d.id === dbv_id ? { ...d, foto_url } : d
        ),
      }));
      return;
    }

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
        .eq('clube_id', getClubeAtivoId())
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
