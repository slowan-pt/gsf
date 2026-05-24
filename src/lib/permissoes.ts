import { useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useContextoStore } from '../stores/contextoStore';
import type { ContextoAcesso, Perfil, Usuario } from '../types';

export type Permissao =
  | 'admin_plataforma'
  | 'admin_clube'
  | 'gerenciar_acessos'
  | 'gerenciar_clubes'
  | 'gerenciar_membros'
  | 'gerenciar_documentos'
  | 'gerenciar_pontuacao'
  | 'gerenciar_unidades'
  | 'gerenciar_agenda'
  | 'gerenciar_atividades'
  | 'enviar_mensagens'
  | 'ver_relatorios'
  | 'ver_financeiro'
  | 'ver_filhos'
  | 'ver_unidade';

const PERFIS_LEGADOS: Record<string, Perfil> = {
  admin_total: 'admin_ti',
  admin_geral: 'admin_clube',
  admin_diretoria: 'usuario_diretoria',
  desbravador: 'usuario_desbravador',
};

const MATRIZ: Record<string, Permissao[]> = {
  admin_ti: [
    'admin_plataforma',
    'admin_clube',
    'gerenciar_acessos',
    'gerenciar_clubes',
    'gerenciar_membros',
    'gerenciar_pontuacao',
    'gerenciar_unidades',
    'gerenciar_agenda',
    'gerenciar_atividades',
    'enviar_mensagens',
    'ver_relatorios',
    'ver_financeiro',
    'ver_filhos',
    'ver_unidade',
  ],
  admin_clube: [
    'admin_clube',
    'gerenciar_acessos',
    'gerenciar_membros',
    'gerenciar_pontuacao',
    'gerenciar_unidades',
    'gerenciar_agenda',
    'gerenciar_atividades',
    'enviar_mensagens',
    'ver_relatorios',
    'ver_financeiro',
    'ver_filhos',
    'ver_unidade',
  ],
  usuario_secretaria: [
    'gerenciar_membros',
    'gerenciar_documentos',
    'gerenciar_agenda',
    'enviar_mensagens',
    'ver_relatorios',
    'ver_unidade',
  ],
  usuario_tesouraria: ['ver_financeiro', 'ver_relatorios'],
  usuario_conselheiro: [
    'gerenciar_pontuacao',
    'gerenciar_atividades',
    'gerenciar_agenda',
    'ver_relatorios',
    'ver_unidade',
  ],
  usuario_diretoria: [
    'gerenciar_membros',
    'gerenciar_pontuacao',
    'gerenciar_unidades',
    'gerenciar_agenda',
    'gerenciar_atividades',
    'enviar_mensagens',
    'ver_relatorios',
    'ver_financeiro',
    'ver_unidade',
  ],
  usuario_regional: ['ver_relatorios', 'ver_unidade'],
  usuario_distrital: ['ver_relatorios', 'ver_unidade'],
  usuario_pastor: ['ver_relatorios', 'ver_unidade'],
  usuario_capelao: ['gerenciar_atividades', 'enviar_mensagens', 'ver_relatorios', 'ver_unidade'],
  usuario_pais: ['ver_filhos'],
  responsavel: ['ver_filhos'],
  usuario_desbravador: [],
  usuario_aventureiro: [],
};

export function normalizarPerfil(perfil?: string | null): string | null {
  if (!perfil) return null;
  return PERFIS_LEGADOS[perfil] ?? perfil;
}

export function perfilEfetivo(usuario?: Usuario | null, contexto?: ContextoAcesso | null): string | null {
  return normalizarPerfil(contexto?.perfil ?? usuario?.perfil ?? null);
}

export function temPerfil(perfis: string[], usuario?: Usuario | null, contexto?: ContextoAcesso | null): boolean {
  const perfil = perfilEfetivo(usuario, contexto);
  return !!perfil && perfis.map(normalizarPerfil).includes(perfil);
}

export function pode(
  permissao: Permissao,
  usuario?: Usuario | null,
  contexto?: ContextoAcesso | null
): boolean {
  const perfil = perfilEfetivo(usuario, contexto);
  if (!perfil) return false;
  return MATRIZ[perfil]?.includes(permissao) ?? false;
}

export function podeAlguma(
  permissoes: Permissao[],
  usuario?: Usuario | null,
  contexto?: ContextoAcesso | null
): boolean {
  return permissoes.some((permissao) => pode(permissao, usuario, contexto));
}

/**
 * Calcula o conjunto unificado de permissões de todos os contextos
 * do mesmo clube que o contexto ativo. Isso permite que um usuário
 * que é, por exemplo, conselheiro E pai no mesmo clube tenha ambos
 * os conjuntos de permissões sem precisar trocar de contexto.
 */
function permissoesMescladas(
  contextoAtivo: ContextoAcesso | null,
  todosContextos: ContextoAcesso[]
): Set<Permissao> {
  if (!contextoAtivo) return new Set();
  const mesmoClube = todosContextos.filter((c) => c.clube_id === contextoAtivo.clube_id);
  const merged = new Set<Permissao>();
  for (const ctx of mesmoClube) {
    const p = normalizarPerfil(ctx.perfil);
    if (p) (MATRIZ[p] ?? []).forEach((perm) => merged.add(perm));
  }
  return merged;
}

export function usePermissoes() {
  const usuario = useAuthStore((s) => s.usuario);
  const contextoAtivo = useContextoStore((s) => s.contextoAtivo);
  const contextos = useContextoStore((s) => s.contextos);
  const perfil = perfilEfetivo(usuario, contextoAtivo);

  const permissoes = useMemo(
    () => permissoesMescladas(contextoAtivo, contextos),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contextoAtivo?.clube_id, contextos]
  );

  return {
    usuario,
    contextoAtivo,
    perfil,
    pode: (permissao: Permissao) => permissoes.has(permissao),
    podeAlguma: (lista: Permissao[]) => lista.some((p) => permissoes.has(p)),
    temPerfil: (perfis: string[]) => temPerfil(perfis, usuario, contextoAtivo),
  };
}
