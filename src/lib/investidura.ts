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
  /** aaaa-mm-dd; usado na autorização de investidura. */
  dataNascimento?: string | null;
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
  const mapa = new Map<number, { nome: string; unidade: string; nascimento: string | null }>();
  if (ids.length === 0) return mapa;
  const unicos = Array.from(new Set(ids));
  const data = await buscarPaginado(
    (q) => q.eq('clube_id', clubeId).in('id', unicos),
    'desbravadores',
    'id,nome,unidade_nome,data_nascimento',
  );
  for (const m of data as any[]) {
    mapa.set(Number(m.id), { nome: m.nome ?? `Membro ${m.id}`, unidade: m.unidade_nome || 'Sem unidade', nascimento: m.data_nascimento ?? null });
  }
  return mapa;
}

function paraItem(l: any, membros: Map<number, { nome: string; unidade: string; nascimento: string | null }>): ItemAguardando {
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
    dataNascimento: m?.nascimento ?? null,
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

/**
 * Devolve uma especialidade que aguarda investidura: ela é RETIRADA do membro (sai da ficha e da fila). Ele precisa
 * conquistá-la de novo (atividade aprovada volta em "a receber") ou ser marcado de novo pelo líder.
 * Só vale para item ainda aguardando: o que já foi recebido não passa por aqui.
 * O mestrado que dependia dela e deixa de cumprir os requisitos sai junto: quem faz isso é o banco, num gatilho
 * (migration 155), por isso vale também para a exclusão pela ficha do membro.
 */
export async function devolverEspecialidadeAguardando(params: { clubeId?: number; dbvId: number; nome: string }): Promise<void> {
  const clubeId = params.clubeId ?? getClubeAtivoId();
  const { data: aguardando, error: erroLeitura } = await supabase
    .from('investidura_itens')
    .select('id')
    .eq('clube_id', clubeId)
    .eq('dbv_id', params.dbvId)
    .eq('tipo', 'especialidade')
    .eq('item_nome', params.nome)
    .eq('aguardando', true);
  if (erroLeitura) throw erroLeitura;
  if (!aguardando || aguardando.length === 0) throw new Error('Esta especialidade não está mais aguardando investidura.');

  // Primeiro a especialidade (a fonte), depois a fila: se a segunda etapa falhar, repetir a ação conclui o serviço.
  const { error: erroEspec } = await supabase
    .from('especialidades')
    .delete()
    .eq('clube_id', clubeId)
    .eq('dbv_id', params.dbvId)
    .eq('nome', params.nome);
  if (erroEspec) throw erroEspec;

  const { error: erroFila } = await supabase
    .from('investidura_itens')
    .delete()
    .eq('clube_id', clubeId)
    .eq('dbv_id', params.dbvId)
    .eq('tipo', 'especialidade')
    .eq('item_nome', params.nome)
    .eq('aguardando', true);
  if (erroFila) throw erroFila;
}

/**
 * Tira um item da investidura (fila "aguardando" e, se pedido, também o já recebido). Usado quando a especialidade
 * ou a classe é EXCLUÍDA da ficha: ela some de tudo e só volta quando for aprovada de novo.
 */
export async function removerItemInvestidura(params: {
  clubeId?: number; dbvId: number; tipo: 'especialidade' | 'classe'; nome: string; soAguardando?: boolean;
}): Promise<void> {
  let consulta = supabase
    .from('investidura_itens')
    .delete()
    .eq('clube_id', params.clubeId ?? getClubeAtivoId())
    .eq('dbv_id', params.dbvId)
    .eq('tipo', params.tipo)
    .eq('item_nome', params.nome);
  if (params.soAguardando) consulta = consulta.eq('aguardando', true).eq('entregue', false);
  const { error } = await consulta;
  if (error) throw error;
}

/**
 * Classe que saiu de "concluída" na ficha: remove da fila os itens dessa classe (o nome pode vir de várias
 * grafias — "Amigo", "Amigo - Agrupadas" —, por isso quem chama diz quais nomes são dela). Por padrão só o que ainda
 * aguarda; o que já foi recebido continua no histórico.
 */
export async function removerClasseDaInvestidura(params: {
  clubeId?: number; dbvId: number; ehDaClasse: (nome: string) => boolean; soAguardando?: boolean;
}): Promise<number> {
  const clubeId = params.clubeId ?? getClubeAtivoId();
  const soAguardando = params.soAguardando ?? true;
  let consulta = supabase
    .from('investidura_itens')
    .select('id,item_nome')
    .eq('clube_id', clubeId)
    .eq('dbv_id', params.dbvId)
    .eq('tipo', 'classe');
  if (soAguardando) consulta = consulta.eq('aguardando', true).eq('entregue', false);
  const { data, error } = await consulta;
  if (error) throw error;
  const ids = ((data ?? []) as { id: number; item_nome: string }[]).filter((l) => params.ehDaClasse(l.item_nome)).map((l) => l.id);
  if (ids.length === 0) return 0;
  const { error: erroDelete } = await supabase.from('investidura_itens').delete().in('id', ids);
  if (erroDelete) throw erroDelete;
  return ids.length;
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
