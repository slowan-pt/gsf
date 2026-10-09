import { supabase } from './supabase';
import { getClubeAtivoId } from './contextoAtual';
import { buscarPaginado } from './supabasePaginado';

/**
 * Investidura em duas etapas (ver migration 132):
 *   aprovado/concluído  ->  AGUARDANDO investidura  ->  INVESTIDO (recebido)
 *
 * Fonte única: `investidura_itens`. A especialidade/classe em si continua registrada
 * (especialidades.status = 'OK' / progresso_classes.campo = 'OK'); o que decide se
 * já foi recebida é `aguardando`. Itens antigos (aguardando = false) valem como recebidos.
 */

export type TipoItemFormativo = 'especialidade' | 'classe' | 'mestrado';

export interface ItemAguardando {
  id: number;
  dbvId: number;
  tipo: TipoItemFormativo;
  nome: string;
  membroNome: string;
  unidadeNome: string;
  origem: string | null;
  aprovadoEm: string | null;
}

export interface ItemInvestido extends ItemAguardando {
  entregueEm: string | null;
}

export const chaveItem = (tipo: string, nome: string) => `${tipo}|${nome}`;

/** Marca um item concluído como "aguardando investidura". */
export async function marcarAguardandoInvestidura(params: {
  clubeId?: number;
  dbvId: number;
  tipo: TipoItemFormativo;
  nome: string;
  origem: 'manual' | 'atividade' | 'classe';
  atividadeId?: number | null;
  planoId?: number | null;
}): Promise<void> {
  const { error } = await supabase.from('investidura_itens').upsert(
    {
      clube_id: params.clubeId ?? getClubeAtivoId(),
      dbv_id: params.dbvId,
      tipo: params.tipo,
      item_nome: params.nome,
      atividade_id: params.atividadeId ?? null,
      plano_formativo_id: params.planoId ?? null,
      aguardando: true,
      entregue: false,
      marcado: false,
      aprovado_em: new Date().toISOString(),
      entregue_em: null,
      entregue_por: null,
      origem: params.origem,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'clube_id,dbv_id,tipo,item_nome' },
  );
  if (error) throw error;
}

async function nomesDosMembros(clubeId: number, ids: number[]) {
  const mapa = new Map<number, { nome: string; unidade: string }>();
  if (ids.length === 0) return mapa;
  const unicos = Array.from(new Set(ids));
  const data = await buscarPaginado(
    (q) => q.eq('clube_id', clubeId).in('id', unicos),
    'desbravadores',
    'id,nome,unidade_nome',
  );
  for (const m of data as any[]) {
    mapa.set(Number(m.id), { nome: m.nome ?? `Membro ${m.id}`, unidade: m.unidade_nome || 'Sem unidade' });
  }
  return mapa;
}

function paraItem(l: any, membros: Map<number, { nome: string; unidade: string }>): ItemAguardando {
  const m = membros.get(Number(l.dbv_id));
  return {
    id: Number(l.id),
    dbvId: Number(l.dbv_id),
    tipo: l.tipo === 'classe' ? 'classe' : l.tipo === 'mestrado' ? 'mestrado' : 'especialidade',
    nome: String(l.item_nome),
    membroNome: m?.nome ?? `Membro ${l.dbv_id}`,
    unidadeNome: m?.unidade ?? 'Sem unidade',
    origem: l.origem ?? null,
    aprovadoEm: l.aprovado_em ?? null,
  };
}

/** Itens aguardando investidura (de um membro ou de todo o clube). */
export async function carregarAguardandoInvestidura(clubeId: number, dbvId?: number): Promise<ItemAguardando[]> {
  let consulta = supabase
    .from('investidura_itens')
    .select('id,dbv_id,tipo,item_nome,origem,aprovado_em')
    .eq('clube_id', clubeId)
    .eq('aguardando', true);
  if (dbvId != null) consulta = consulta.eq('dbv_id', dbvId);
  const { data, error } = await consulta;
  if (error) throw error;
  const linhas = (data ?? []) as any[];
  const membros = await nomesDosMembros(clubeId, linhas.map((l) => Number(l.dbv_id)));
  return linhas
    .map((l) => paraItem(l, membros))
    .sort((a, b) => a.tipo.localeCompare(b.tipo) || a.nome.localeCompare(b.nome, 'pt-BR') || a.membroNome.localeCompare(b.membroNome, 'pt-BR'));
}

/** Conjunto "tipo|nome" dos itens de um membro que ainda aguardam investidura. */
export async function chavesAguardando(clubeId: number, dbvId: number): Promise<Set<string>> {
  const itens = await carregarAguardandoInvestidura(clubeId, dbvId);
  return new Set(itens.map((i) => chaveItem(i.tipo, i.nome)));
}

/** Investidura realizada: os itens saem de "aguardando" e viram recebidos, com a data. */
export async function registrarInvestidura(ids: number[], data: string, usuarioId?: string | null): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from('investidura_itens')
    .update({
      aguardando: false,
      entregue: true,
      entregue_em: data,
      entregue_por: usuarioId ?? null,
      updated_at: new Date().toISOString(),
    })
    .in('id', ids);
  if (error) throw error;
}

/** Devolve um item já recebido para "aguardando investidura". */
export async function devolverParaAguardando(params: {
  dbvId: number;
  tipo: TipoItemFormativo;
  nome: string;
}): Promise<void> {
  await marcarAguardandoInvestidura({ dbvId: params.dbvId, tipo: params.tipo, nome: params.nome, origem: 'manual' });
}

/** Itens já investidos (opcionalmente numa data), do mais recente para o mais antigo. */
export async function carregarInvestidos(clubeId: number, dataIso?: string): Promise<ItemInvestido[]> {
  let consulta = supabase
    .from('investidura_itens')
    .select('id,dbv_id,tipo,item_nome,origem,aprovado_em,entregue_em')
    .eq('clube_id', clubeId)
    .eq('entregue', true)
    .not('entregue_em', 'is', null);
  if (dataIso) consulta = consulta.eq('entregue_em', dataIso);
  const { data, error } = await consulta;
  if (error) throw error;
  const linhas = (data ?? []) as any[];
  const membros = await nomesDosMembros(clubeId, linhas.map((l) => Number(l.dbv_id)));
  return linhas
    .map((l) => ({ ...paraItem(l, membros), entregueEm: (l.entregue_em ?? null) as string | null }))
    .sort((a, b) => String(b.entregueEm).localeCompare(String(a.entregueEm)) || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Agrupa por item para a "lista de compras": item -> membros. */
export function agruparPorItem<T extends ItemAguardando>(itens: T[]) {
  const mapa = new Map<string, { tipo: TipoItemFormativo; nome: string; itens: T[] }>();
  for (const i of itens) {
    const k = chaveItem(i.tipo, i.nome);
    if (!mapa.has(k)) mapa.set(k, { tipo: i.tipo, nome: i.nome, itens: [] });
    mapa.get(k)!.itens.push(i);
  }
  return Array.from(mapa.values()).sort((a, b) => a.tipo.localeCompare(b.tipo) || a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function totais<T extends ItemAguardando>(itens: T[]) {
  const classes = itens.filter((i) => i.tipo === 'classe');
  const espec = itens.filter((i) => i.tipo === 'especialidade');
  return {
    classes: classes.length,
    especialidades: espec.length,
    total: itens.length,
    membros: new Set(itens.map((i) => i.dbvId)).size,
    tiposClasses: new Set(classes.map((i) => i.nome)).size,
    tiposEspecialidades: new Set(espec.map((i) => i.nome)).size,
  };
}
