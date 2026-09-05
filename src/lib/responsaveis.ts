import { supabase } from './supabase';
import type { BadgeFoto } from '../components/common/Avatar';

/**
 * Busca em lote, para uma lista de dbv_id, até 2 responsáveis ativos de cada
 * um (nome + foto) — usado para o selo "tem responsável vinculado" no avatar
 * de membros menores de 16 anos em listas (Membros, Início).
 */
export async function carregarBadgesResponsaveis(dbvIds: number[]): Promise<Map<number, BadgeFoto[]>> {
  const mapa = new Map<number, BadgeFoto[]>();
  const ids = [...new Set(dbvIds)].filter((id) => Number.isFinite(id));
  if (ids.length === 0) return mapa;

  const { data: vinculos } = await supabase
    .from('responsavel_membros')
    .select('membro_id, usuario_id, nome_cache')
    .in('membro_id', ids)
    .eq('ativo', true);
  if (!vinculos || vinculos.length === 0) return mapa;

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
    lista.push({ nome: u?.nome ?? v.nome_cache ?? 'Responsável', foto_url: u?.foto_url ?? null });
    mapa.set(v.membro_id, lista);
  }
  return mapa;
}
