import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import type { ContextoAcesso, Perfil, Usuario } from '../types';

const CONTEXTO_ATIVO_KEY = 'fonseca_contexto_ativo_v1';

const PERFIS_NOMES: Record<string, string> = {
  admin_ti: 'Admin TI',
  admin_clube: 'Admin do clube',
  admin_total: 'Admin total',
  admin_geral: 'Admin diretoria',
  admin_diretoria: 'Diretoria',
  usuario_secretaria: 'Secretaria',
  usuario_tesouraria: 'Tesouraria',
  usuario_conselheiro: 'Conselheiro(a)',
  usuario_diretoria: 'Diretoria',
  usuario_desbravador: 'Desbravador',
  usuario_aventureiro: 'Aventureiro',
  usuario_pais: 'Pais/Responsável',
  usuario_regional: 'Regional',
  usuario_distrital: 'Distrital',
  usuario_pastor: 'Pastor',
  usuario_capelao: 'Capelão',
  desbravador: 'Desbravador',
  responsavel: 'Responsável',
};

interface ProgramaRow {
  id: number;
  codigo: string;
  nome: string;
}

interface ClubeRow {
  id: number;
  programa_id: number;
  nome: string;
  nome_curto?: string | null;
}

interface ContextoState {
  contextos: ContextoAcesso[];
  contextoAtivo: ContextoAcesso | null;
  selecaoPendente: boolean;
  carregando: boolean;
  erro: string | null;
  carregarContextos: (usuario: Usuario) => Promise<void>;
  escolherContexto: (contexto: ContextoAcesso) => Promise<void>;
  limparContexto: () => Promise<void>;
}

function perfilNome(perfil: string) {
  return PERFIS_NOMES[perfil] ?? perfil;
}

function legadoParaNovoPerfil(perfil: string): Perfil {
  if (perfil === 'admin_total') return 'admin_ti';
  if (perfil === 'admin_geral') return 'admin_clube';
  if (perfil === 'admin_diretoria') return 'usuario_diretoria';
  if (perfil === 'desbravador') return 'usuario_desbravador';
  return perfil as Perfil;
}

async function buscarMapas(clubeIds: number[]) {
  const ids = Array.from(new Set(clubeIds.filter(Boolean)));
  const clubesMap = new Map<number, ClubeRow>();
  const programasMap = new Map<number, ProgramaRow>();

  if (ids.length === 0) return { clubesMap, programasMap };

  const { data: clubes } = await supabase
    .from('clubes')
    .select('id, programa_id, nome, nome_curto')
    .in('id', ids);

  for (const c of (clubes ?? []) as ClubeRow[]) {
    clubesMap.set(c.id, c);
  }

  const programaIds = Array.from(new Set((clubes ?? []).map((c: any) => c.programa_id).filter(Boolean)));
  if (programaIds.length > 0) {
    const { data: programas } = await supabase
      .from('programas')
      .select('id, codigo, nome')
      .in('id', programaIds);
    for (const p of (programas ?? []) as ProgramaRow[]) {
      programasMap.set(p.id, p);
    }
  }

  return { clubesMap, programasMap };
}

async function buscarTodosClubes() {
  const { data: clubes } = await supabase
    .from('clubes')
    .select('id, programa_id, nome, nome_curto')
    .eq('ativo', true)
    .order('nome');

  const clubesLista = (clubes ?? []) as ClubeRow[];
  const clubesMap = new Map<number, ClubeRow>();
  const programasMap = new Map<number, ProgramaRow>();

  for (const c of clubesLista) {
    clubesMap.set(c.id, c);
  }

  const programaIds = Array.from(new Set(clubesLista.map((c) => c.programa_id).filter(Boolean)));
  if (programaIds.length > 0) {
    const { data: programas } = await supabase
      .from('programas')
      .select('id, codigo, nome')
      .in('id', programaIds);
    for (const p of (programas ?? []) as ProgramaRow[]) {
      programasMap.set(p.id, p);
    }
  }

  return { clubesLista, clubesMap, programasMap };
}

async function buscarNomesMembros(ids: number[]) {
  const membroIds = Array.from(new Set(ids.filter(Boolean)));
  const membrosMap = new Map<number, string>();
  if (membroIds.length === 0) return membrosMap;

  const { data } = await supabase
    .from('desbravadores')
    .select('id, nome')
    .in('id', membroIds);

  for (const m of (data ?? []) as Array<{ id: number; nome: string }>) {
    membrosMap.set(m.id, m.nome);
  }
  return membrosMap;
}

function criarContextoLegado(usuario: Usuario): ContextoAcesso {
  const perfil = legadoParaNovoPerfil(usuario.perfil);
  return {
    id: `legado:1:${perfil}:${usuario.dbv_id ?? 'sem-membro'}`,
    tipo: 'legado',
    usuario_id: usuario.id,
    clube_id: 1,
    clube_nome: 'Clube de Desbravadores Fonseca',
    clube_nome_curto: 'Fonseca',
    programa_id: 1,
    programa_codigo: 'desbravadores',
    programa_nome: 'Desbravadores',
    perfil,
    perfil_nome: perfilNome(perfil),
    unidade_id: typeof usuario.unidade_id === 'string' ? Number(usuario.unidade_id) : (usuario.unidade_id as any),
    membro_id: usuario.dbv_id ?? null,
    subtitulo: 'Contexto legado do Clube Fonseca',
  };
}

export const useContextoStore = create<ContextoState>((set, get) => ({
  contextos: [],
  contextoAtivo: null,
  selecaoPendente: false,
  carregando: false,
  erro: null,

  carregarContextos: async (usuario) => {
    set({ carregando: true, erro: null });
    try {
      const [{ data: vinculos, error: erroVinculos }, { data: responsaveis, error: erroResp }] = await Promise.all([
        supabase
          .from('usuario_clubes')
          .select('id, usuario_id, clube_id, membro_id, perfil, unidade_id, ativo')
          .eq('usuario_id', usuario.id)
          .eq('ativo', true),
        supabase
          .from('responsavel_membros')
          .select('id, usuario_id, membro_id, clube_id, programa_id, parentesco, ativo')
          .eq('usuario_id', usuario.id)
          .eq('ativo', true),
      ]);

      if (erroVinculos) throw erroVinculos;
      if (erroResp) throw erroResp;

      const clubeIds = [
        ...((vinculos ?? []) as any[]).map((v) => v.clube_id),
        ...((responsaveis ?? []) as any[]).map((r) => r.clube_id),
      ];
      const membroIds = [
        ...((vinculos ?? []) as any[]).map((v) => v.membro_id).filter(Boolean),
        ...((responsaveis ?? []) as any[]).map((r) => r.membro_id).filter(Boolean),
      ];

      const [{ clubesMap, programasMap }, membrosMap] = await Promise.all([
        buscarMapas(clubeIds),
        buscarNomesMembros(membroIds),
      ]);

      const lista: ContextoAcesso[] = [];
      const usuarioPerfil = legadoParaNovoPerfil(usuario.perfil);

      if (usuarioPerfil === 'admin_ti') {
        const { clubesLista, programasMap } = await buscarTodosClubes();
        for (const clube of clubesLista) {
          const programa = programasMap.get(clube.programa_id);
          lista.push({
            id: `admin_ti:${clube.id}`,
            tipo: 'clube',
            usuario_id: usuario.id,
            clube_id: clube.id,
            clube_nome: clube.nome,
            clube_nome_curto: clube.nome_curto,
            programa_id: clube.programa_id,
            programa_codigo: programa?.codigo ?? 'desbravadores',
            programa_nome: programa?.nome ?? 'Desbravadores',
            perfil: 'admin_ti',
            perfil_nome: perfilNome('admin_ti'),
            unidade_id: null,
            membro_id: null,
            membro_nome: null,
            subtitulo: `Admin TI - ${clube.nome_curto ?? clube.nome}`,
          });
        }
      }

      for (const v of (vinculos ?? []) as any[]) {
        if (usuarioPerfil === 'admin_ti') continue;
        const clube = clubesMap.get(v.clube_id);
        const programa = clube ? programasMap.get(clube.programa_id) : null;
        lista.push({
          id: `clube:${v.id}`,
          tipo: 'clube',
          usuario_id: usuario.id,
          clube_id: v.clube_id,
          clube_nome: clube?.nome ?? 'Clube',
          clube_nome_curto: clube?.nome_curto,
          programa_id: clube?.programa_id ?? 1,
          programa_codigo: programa?.codigo ?? 'desbravadores',
          programa_nome: programa?.nome ?? 'Desbravadores',
          perfil: v.perfil,
          perfil_nome: perfilNome(v.perfil),
          unidade_id: v.unidade_id ?? null,
          membro_id: v.membro_id ?? null,
          membro_nome: v.membro_id ? membrosMap.get(v.membro_id) ?? null : null,
          subtitulo: `${perfilNome(v.perfil)} - ${clube?.nome_curto ?? clube?.nome ?? 'Clube'}`,
        });
      }

      for (const r of (responsaveis ?? []) as any[]) {
        const clube = clubesMap.get(r.clube_id);
        const programa = clube ? programasMap.get(clube.programa_id) : null;
        const membroNome = membrosMap.get(r.membro_id) ?? 'Membro';
        lista.push({
          id: `responsavel:${r.id}`,
          tipo: 'responsavel',
          usuario_id: usuario.id,
          clube_id: r.clube_id,
          clube_nome: clube?.nome ?? 'Clube',
          clube_nome_curto: clube?.nome_curto,
          programa_id: r.programa_id ?? clube?.programa_id ?? 1,
          programa_codigo: programa?.codigo ?? 'desbravadores',
          programa_nome: programa?.nome ?? 'Desbravadores',
          perfil: 'responsavel',
          perfil_nome: r.parentesco ? `Responsável (${r.parentesco})` : 'Responsável',
          membro_id: r.membro_id,
          membro_nome: membroNome,
          subtitulo: `${membroNome} - ${clube?.nome_curto ?? clube?.nome ?? 'Clube'}`,
        });
      }

      if (lista.length === 0) {
        lista.push(criarContextoLegado(usuario));
      }

      const salvoRaw = await AsyncStorage.getItem(CONTEXTO_ATIVO_KEY);
      const salvo = salvoRaw ? JSON.parse(salvoRaw) as ContextoAcesso : null;
      const salvoValido = salvo ? lista.find((ctx) => ctx.id === salvo.id) ?? null : null;

      if (lista.length === 1) {
        await AsyncStorage.setItem(CONTEXTO_ATIVO_KEY, JSON.stringify(lista[0]));
        set({ contextos: lista, contextoAtivo: lista[0], selecaoPendente: false, carregando: false });
        return;
      }

      if (salvoValido) {
        set({ contextos: lista, contextoAtivo: salvoValido, selecaoPendente: false, carregando: false });
        return;
      }

      set({ contextos: lista, contextoAtivo: null, selecaoPendente: true, carregando: false });
    } catch (e: any) {
      const legado = criarContextoLegado(usuario);
      await AsyncStorage.setItem(CONTEXTO_ATIVO_KEY, JSON.stringify(legado)).catch(() => {});
      set({
        contextos: [legado],
        contextoAtivo: legado,
        selecaoPendente: false,
        carregando: false,
        erro: e?.message ?? 'Não foi possível carregar os contextos de acesso.',
      });
    }
  },

  escolherContexto: async (contexto) => {
    await AsyncStorage.setItem(CONTEXTO_ATIVO_KEY, JSON.stringify(contexto));
    set({ contextoAtivo: contexto, selecaoPendente: false });
  },

  limparContexto: async () => {
    await AsyncStorage.removeItem(CONTEXTO_ATIVO_KEY).catch(() => {});
    set({ contextos: [], contextoAtivo: null, selecaoPendente: false, carregando: false, erro: null });
  },
}));
