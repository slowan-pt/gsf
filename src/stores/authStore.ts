import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { puxarDeSupabase } from '../lib/sync';
import { usuarioPrecisaAceitarTermo } from '../lib/lgpd';
import { useContextoStore } from './contextoStore';
import type { Usuario } from '../types';

const OFFLINE_AUTH_KEY = 'fonseca_offline_auth_v1';
const SESSION_META_KEY = 'fonseca_session_meta_v1';
const ADMIN_SESSION_MS = 48 * 60 * 60 * 1000;
const MEMBER_SESSION_MS = 7 * 24 * 60 * 60 * 1000;

function duracaoSessao(perfil?: string | null) {
  return [
    'admin_total', 'admin_geral', 'admin_diretoria',
    'admin_ti', 'admin_clube', 'usuario_secretaria', 'usuario_diretoria',
  ].includes(perfil ?? '')
    ? ADMIN_SESSION_MS
    : MEMBER_SESSION_MS;
}

async function limparLegadoOffline() {
  await AsyncStorage.removeItem(OFFLINE_AUTH_KEY).catch(() => {});
}

async function salvarControleSessao(usuario: Usuario) {
  const expiresAt = Date.now() + duracaoSessao(usuario.perfil);
  await AsyncStorage.setItem(SESSION_META_KEY, JSON.stringify({ userId: usuario.id, expiresAt }));
}

async function sessaoLocalExpirada(userId?: string) {
  const raw = await AsyncStorage.getItem(SESSION_META_KEY);
  if (!raw) return null;
  try {
    const meta = JSON.parse(raw) as { userId?: string; expiresAt?: number };
    if (userId && meta.userId && meta.userId !== userId) return true;
    return typeof meta.expiresAt === 'number' && Date.now() > meta.expiresAt;
  } catch {
    return true;
  }
}

interface AuthState {
  usuario: Usuario | null;
  mfaPendente: 'setup' | 'verify' | null;
  usuarioMfaPendente: Usuario | null;
  consentimentoPendente: boolean;
  usuarioConsentimentoPendente: Usuario | null;
  carregando: boolean;
  erro: string | null;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
  carregarUsuario: () => Promise<void>;
  concluirMfa: () => Promise<void>;
  cancelarMfa: () => Promise<void>;
  concluirConsentimento: () => Promise<void>;
  cancelarConsentimento: () => Promise<void>;
  atualizarUsuarioLocal: (usuario: Usuario) => void;
}

function ehAdmin(usuario?: Usuario | null) {
  return [
    'admin_total',
    'admin_geral',
    'admin_diretoria',
    'admin_ti',
    'admin_clube',
    'usuario_secretaria',
    'usuario_diretoria',
  ].includes(usuario?.perfil ?? '');
}

async function definirMfaPendente(usuario: Usuario): Promise<'setup' | 'verify' | null> {
  if (!ehAdmin(usuario)) return null;

  const mfa = (supabase.auth as any).mfa;
  if (!mfa) return null;

  const factors = await mfa.listFactors?.();
  const totp = factors?.data?.totp ?? [];
  const verificados = totp.filter((f: any) => f.status === 'verified');

  if (verificados.length === 0) {
    const pendentes = totp.filter((f: any) => f.status !== 'verified');
    for (const fator of pendentes) {
      await mfa.unenroll?.({ factorId: fator.id }).catch(() => {});
    }
    return 'setup';
  }

  const aal = await mfa.getAuthenticatorAssuranceLevel?.();
  if (aal?.data?.currentLevel === 'aal2') return null;

  return 'verify';
}

export const useAuthStore = create<AuthState>((set) => ({
  usuario: null,
  mfaPendente: null,
  usuarioMfaPendente: null,
  consentimentoPendente: false,
  usuarioConsentimentoPendente: null,
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

      const usuarioPerfil = perfil as Usuario;
      const mfaPendente = await definirMfaPendente(usuarioPerfil);
      if (mfaPendente) {
        set({
          usuario: null,
          usuarioMfaPendente: usuarioPerfil,
          mfaPendente,
          consentimentoPendente: false,
          usuarioConsentimentoPendente: null,
          carregando: false,
        });
        return;
      }

      if (await usuarioPrecisaAceitarTermo(usuarioPerfil.id)) {
        set({
          usuario: null,
          usuarioMfaPendente: null,
          mfaPendente: null,
          usuarioConsentimentoPendente: usuarioPerfil,
          consentimentoPendente: true,
          carregando: false,
        });
        return;
      }

      set({ usuario: usuarioPerfil, usuarioMfaPendente: null, mfaPendente: null, carregando: false });
      await limparLegadoOffline();
      await salvarControleSessao(usuarioPerfil).catch(() => {});
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
    await AsyncStorage.removeItem(SESSION_META_KEY).catch(() => {});
    await limparLegadoOffline();
    await useContextoStore.getState().limparContexto();
    set({ usuario: null, usuarioMfaPendente: null, mfaPendente: null, consentimentoPendente: false, usuarioConsentimentoPendente: null });
  },

  carregarUsuario: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      await limparLegadoOffline();
      set({ usuario: null, usuarioMfaPendente: null, mfaPendente: null, consentimentoPendente: false, usuarioConsentimentoPendente: null });
      return;
    }

    if (await sessaoLocalExpirada(data.session.user.id)) {
      await supabase.auth.signOut();
      await AsyncStorage.removeItem(SESSION_META_KEY).catch(() => {});
      await limparLegadoOffline();
      await useContextoStore.getState().limparContexto();
      set({ usuario: null, usuarioMfaPendente: null, mfaPendente: null, consentimentoPendente: false, usuarioConsentimentoPendente: null });
      return;
    }

    const { data: perfil } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', data.session.user.id)
      .single();

    if (perfil) {
      const usuarioPerfil = perfil as Usuario;
      const mfaPendente = await definirMfaPendente(usuarioPerfil);
      if (mfaPendente) {
        set({ usuario: null, usuarioMfaPendente: usuarioPerfil, mfaPendente, consentimentoPendente: false, usuarioConsentimentoPendente: null });
        return;
      }
      if (await usuarioPrecisaAceitarTermo(usuarioPerfil.id)) {
        set({ usuario: null, usuarioMfaPendente: null, mfaPendente: null, usuarioConsentimentoPendente: usuarioPerfil, consentimentoPendente: true });
        return;
      }
      set({ usuario: usuarioPerfil, usuarioMfaPendente: null, mfaPendente: null, consentimentoPendente: false, usuarioConsentimentoPendente: null });
      await salvarControleSessao(usuarioPerfil).catch(() => {});
    }
  },

  concluirMfa: async () => {
    const usuario = useAuthStore.getState().usuarioMfaPendente;
    if (!usuario) return;

    if (ehAdmin(usuario)) {
      const mfa = (supabase.auth as any).mfa;
      if (mfa) {
        const aal = await mfa.getAuthenticatorAssuranceLevel?.();
        if (aal?.data?.currentLevel !== 'aal2') {
          set({ erro: 'Verificação MFA não concluída. Tente novamente.' });
          return;
        }
      }
    }

    if (await usuarioPrecisaAceitarTermo(usuario.id)) {
      set({
        usuario: null,
        usuarioMfaPendente: null,
        mfaPendente: null,
        usuarioConsentimentoPendente: usuario,
        consentimentoPendente: true,
        erro: null,
      });
      return;
    }
    set({ usuario, usuarioMfaPendente: null, mfaPendente: null, consentimentoPendente: false, usuarioConsentimentoPendente: null, erro: null });
    await limparLegadoOffline();
    await salvarControleSessao(usuario).catch(() => {});
    puxarDeSupabase().catch(() => {});
  },

  cancelarMfa: async () => {
    await supabase.auth.signOut();
    await AsyncStorage.removeItem(SESSION_META_KEY).catch(() => {});
    await useContextoStore.getState().limparContexto();
    set({ usuario: null, usuarioMfaPendente: null, mfaPendente: null, consentimentoPendente: false, usuarioConsentimentoPendente: null, erro: null });
  },

  concluirConsentimento: async () => {
    const usuario = useAuthStore.getState().usuarioConsentimentoPendente;
    if (!usuario) return;
    set({ usuario, usuarioMfaPendente: null, mfaPendente: null, usuarioConsentimentoPendente: null, consentimentoPendente: false, erro: null });
    await limparLegadoOffline();
    await salvarControleSessao(usuario).catch(() => {});
    puxarDeSupabase().catch(() => {});
  },

  cancelarConsentimento: async () => {
    await supabase.auth.signOut();
    await AsyncStorage.removeItem(SESSION_META_KEY).catch(() => {});
    await useContextoStore.getState().limparContexto();
    set({ usuario: null, usuarioMfaPendente: null, mfaPendente: null, consentimentoPendente: false, usuarioConsentimentoPendente: null, erro: null });
  },

  atualizarUsuarioLocal: (usuario) => set({ usuario }),
}));
