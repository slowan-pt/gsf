import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { puxarDeSupabase } from '../lib/sync';
import type { Usuario } from '../types';

interface AuthState {
  usuario: Usuario | null;
  carregando: boolean;
  erro: string | null;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
  carregarUsuario: () => Promise<void>;
  atualizarUsuarioLocal: (usuario: Usuario) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  usuario: null,
  carregando: false,
  erro: null,

  login: async (email, senha) => {
    set({ carregando: true, erro: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;

      let { data: perfil } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', data.user.id)
        .single();

      // Fallback: RLS pode bloquear a leitura antes da política ser criada
      if (!perfil) {
        const meta = data.user.user_metadata ?? {};
        perfil = {
          id: data.user.id,
          email: data.user.email ?? email,
          nome: (meta.nome as string) ?? email.split('@')[0],
          perfil: (meta.perfil as string) ?? 'admin_geral',
          unidade_id: meta.unidade_id ?? null,
          created_at: new Date().toISOString(),
        } as unknown as typeof perfil;
      }

      set({ usuario: perfil, carregando: false });
      // Sincroniza sem bloquear o login. No web, o SQLite pode demorar/travar
      // e não deve prender o usuário na tela de entrada.
      puxarDeSupabase().catch(() => {});
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao fazer login';
      set({ erro: msg, carregando: false });
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ usuario: null });
  },

  carregarUsuario: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;

    const { data: perfil } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', data.session.user.id)
      .single();

    if (perfil) set({ usuario: perfil });
  },

  atualizarUsuarioLocal: (usuario) => set({ usuario }),
}));
