import { supabase } from './supabase';
import type { BadgeFoto } from '../components/common/Avatar';
import { useAuthStore } from '../stores/authStore';
import { useContextoStore } from '../stores/contextoStore';

type BadgeResponsavel = BadgeFoto & { usuario_id?: string | null };

function aplicarFotoDoResponsavelLogado(mapa: Map<number, BadgeResponsavel[]>) {
  const usuario = useAuthStore.getState().usuario;
  if (!usuario?.foto_url) return mapa;

  const membroIds = useContextoStore.getState().contextos
    .filter((ctx) => ctx.tipo === 'responsavel' && ctx.usuario_id === usuario.id && ctx.membro_id != null)
    .map((ctx) => Number(ctx.membro_id));

  for (const membroId of membroIds) {
    const lista = mapa.get(membroId);
    if (!lista || lista.length === 0) continue;
    const nomeUsuario = usuario.nome || 'Responsável';
    const existente = lista.find((badge) => badge.usuario_id === usuario.id)
      ?? lista.find((badge) => badge.nome === nomeUsuario)
      ?? lista[0];
    existente.nome = existente.nome || nomeUsuario;
    existente.foto_url = usuario.foto_url;
  }

  return mapa;
}

/**
 * Busca em lote, para uma lista de dbv_id, até 2 responsáveis ativos de cada
 * um (nome + foto) — usado para o selo "tem responsável vinculado" no avatar
 * de membros menores de 16 anos em listas (Membros, Início).
 */
export async function carregarBadgesResponsaveis(dbvIds: number[]): Promise<Map<number, BadgeFoto[]>> {
  const mapa = new Map<number, BadgeResponsavel[]>();
  const ids = [...new Set(dbvIds)].filter((id) => Number.isFinite(id));
  if (ids.length === 0) return mapa as Map<number, BadgeFoto[]>;

  const { data: badgesRpc, error: erroRpc } = await supabase
    .rpc('badges_responsaveis_membros', { p_membro_ids: ids });
  if (!erroRpc && badgesRpc) {
    for (const badge of badgesRpc as Array<{ membro_id: number; usuario_id?: string | null; nome: string; foto_url: string | null }>) {
      const lista = mapa.get(badge.membro_id) ?? [];
      if (lista.length >= 2) continue;
      lista.push({ usuario_id: badge.usuario_id ?? null, nome: badge.nome || 'Responsável', foto_url: badge.foto_url ?? null });
      mapa.set(badge.membro_id, lista);
    }
    return aplicarFotoDoResponsavelLogado(mapa) as Map<number, BadgeFoto[]>;
  }

  const { data: vinculos } = await supabase
    .from('responsavel_membros')
    .select('membro_id, usuario_id, nome_cache')
    .in('membro_id', ids)
    .eq('ativo', true);
  if (!vinculos || vinculos.length === 0) return mapa as Map<number, BadgeFoto[]>;

  const usuarioIds = [...new Set(vinculos.map((v: any) => v.usuario_id).filter(Boolean))];
  const fotoPorUsuario = new Map<string, { nome: string; foto_url: string | null }>();
  if (usuarioIds.length > 0) {
    const { data: usuarios } = await supabase.from('usuarios').select('id, nome, foto_url').in('id', usuarioIds);
    for (const u of (usuarios ?? []) as any[]) fotoPorUsuario.set(u.id, { nome: u.nome, foto_url: u.foto_url ?? null });
  }

  for (const v of vinculos as any[]) {
    const lista = mapa.get(v.membro_id) ?? [];
    if (lista.length >= 2) continue;
    const u = fotoPorUsuario.get(v.usuario_id);
    lista.push({ usuario_id: v.usuario_id ?? null, nome: u?.nome ?? v.nome_cache ?? 'Responsável', foto_url: u?.foto_url ?? null });
    mapa.set(v.membro_id, lista);
  }
  return aplicarFotoDoResponsavelLogado(mapa) as Map<number, BadgeFoto[]>;
}
