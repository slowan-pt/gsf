import { Platform } from 'react-native';
import { supabase } from './supabase';

/**
 * Fluxo de aprovação de classes (migration 133):
 *   membro conclui -> diretoria -> regional -> aguardando investidura
 * Recusa devolve a classe para correção (requisitos recusados voltam desmarcados).
 */

export type EtapaFluxo = 'diretoria' | 'regional' | 'correcao' | 'concluida';

export interface RequisitoRecusado {
  id: number;
  codigo: string;
  subitem: string | null;
  texto: string;
}

export interface ItemFluxo {
  id: number;
  dbvId: number;
  dbvNome: string;
  unidadeNome: string;
  itemNome: string;
  etapa: EtapaFluxo;
  recusadoPor: 'diretoria' | 'regional' | null;
  motivo: string | null;
  requisitosRecusados: RequisitoRecusado[];
  reenviada: boolean;
  atualizadoEm: string;
  /** Classe do catálogo que originou o item (regular ou agrupada) e se é avançada. */
  classeCatalogo: string;
  avancada: boolean;
}

export interface RequisitoDoItem {
  id: number;
  codigo: string;
  subitem: string | null;
  texto: string;
  secao: string;
}

interface Aviso {
  tokens: string[];
  titulo: string;
  corpo: string;
  dados?: Record<string, string>;
}

const NOME_AVANCADA: Record<string, string> = {
  Amigo: 'Amigo da Natureza',
  Companheiro: 'Companheiro de Excursionismo',
  Pesquisador: 'Pesquisador de Campos e Bosques',
  Pioneiro: 'Pioneiro de Novas Fronteiras',
  Excursionista: 'Excursionista na Mata',
  Guia: 'Guia de Exploração',
};

/** Chave da classe na ficha (mesmo formato de ResumoClasseSeparado.chave). */
export function chaveFichaClasse(item: ItemFluxo): string {
  return `${item.classeCatalogo}::${item.avancada ? 'av' : 'reg'}`;
}

/** Mesma chave do banco (fluxo_chave_item): regular e agrupadas compartilham o item. */
export function chaveItemFluxo(classeCatalogo: string, avancada: boolean): string {
  const base = avancada ? (NOME_AVANCADA[classeCatalogo] ?? classeCatalogo) : classeCatalogo;
  const limpo = base.replace(/\s*-\s*Agrupadas\s*$/i, '').trim();
  return /^Pesquisador de Campo/i.test(limpo) ? 'Pesquisador de Campos e Bosques' : limpo;
}

function paraItem(l: any): ItemFluxo {
  return {
    id: Number(l.id),
    dbvId: Number(l.dbv_id),
    dbvNome: l.dbv_nome ?? `Membro ${l.dbv_id}`,
    unidadeNome: l.unidade_nome ?? 'Sem unidade',
    itemNome: String(l.item_nome),
    etapa: l.etapa as EtapaFluxo,
    recusadoPor: (l.recusado_por ?? null) as ItemFluxo['recusadoPor'],
    motivo: l.motivo ?? null,
    requisitosRecusados: Array.isArray(l.requisitos_recusados) ? l.requisitos_recusados : [],
    reenviada: !!l.reenviada,
    atualizadoEm: String(l.updated_at ?? ''),
    classeCatalogo: String(l.classe_catalogo ?? l.item_nome),
    avancada: !!l.avancada,
  };
}

/** Classes nas etapas diretoria, regional e correção do clube (quem pode aprovar). */
export async function carregarFilaClasses(clubeId: number): Promise<ItemFluxo[]> {
  const { data, error } = await supabase.rpc('classe_fila', { p_clube_id: clubeId });
  if (error) throw error;
  return ((data ?? []) as any[]).map(paraItem);
}

export async function carregarRequisitosDoItem(clubeId: number, dbvId: number, itemNome: string): Promise<RequisitoDoItem[]> {
  const { data, error } = await supabase.rpc('classe_requisitos_do_item', {
    p_clube_id: clubeId, p_dbv_id: dbvId, p_item_nome: itemNome,
  });
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    id: Number(r.id), codigo: String(r.codigo), subitem: r.subitem ?? null, texto: String(r.texto), secao: String(r.secao ?? ''),
  }));
}

/** Pendências de correção de um membro (a própria ficha, via RLS). */
export async function carregarPendenciasMembro(clubeId: number, dbvId: number): Promise<ItemFluxo[]> {
  const { data, error } = await supabase
    .from('classe_aprovacoes')
    .select('id,dbv_id,item_nome,etapa,recusado_por,motivo,requisitos_recusados,reenviada,updated_at,classe_catalogo,avancada')
    .eq('clube_id', clubeId)
    .eq('dbv_id', dbvId)
    .eq('etapa', 'correcao');
  if (error) throw error;
  return ((data ?? []) as any[]).map(paraItem);
}

export async function aprovarClasse(clubeId: number, dbvId: number, itemNome: string): Promise<{ concluida: boolean }> {
  const { data, error } = await supabase.rpc('classe_aprovar', { p_clube_id: clubeId, p_dbv_id: dbvId, p_item_nome: itemNome });
  if (error) throw error;
  void enviarAvisos((data as any)?.avisos);
  return { concluida: !!(data as any)?.concluida };
}

export async function recusarClasse(params: {
  clubeId: number; dbvId: number; itemNome: string; requisitoIds: number[]; motivo: string;
}): Promise<void> {
  const { data, error } = await supabase.rpc('classe_recusar', {
    p_clube_id: params.clubeId, p_dbv_id: params.dbvId, p_item_nome: params.itemNome,
    p_requisito_ids: params.requisitoIds, p_motivo: params.motivo,
  });
  if (error) throw error;
  void enviarAvisos((data as any)?.avisos);
}

/**
 * Chamada depois de marcar requisitos: se a classe acabou de ficar completa (ou voltou
 * corrigida), avisa a diretoria uma única vez. O banco decide (avisado_em) — sem efeito
 * se a classe ainda não está completa.
 */
export async function avisarDiretoriaSeNova(clubeId: number, dbvId: number, classeCatalogo: string, avancada: boolean): Promise<void> {
  try {
    const { data, error } = await supabase.rpc('classe_avisar_diretoria', {
      p_clube_id: clubeId, p_dbv_id: dbvId, p_item_nome: chaveItemFluxo(classeCatalogo, avancada),
    });
    if (error) return;
    await enviarAvisos((data as any)?.avisos);
  } catch {
    // Notificação nunca atrapalha a marcação.
  }
}

function tokenExpoValido(token: string) {
  return /^ExponentPushToken\[[^\]]+\]$|^ExpoPushToken\[[^\]]+\]$/.test(token);
}

/** Envia os avisos devolvidos pelo banco. Falha de push nunca derruba a ação principal. */
export async function enviarAvisos(avisos?: Aviso[] | null): Promise<void> {
  try {
    const mensagens = (avisos ?? [])
      .map((a) => ({ ...a, tokens: Array.from(new Set((a.tokens ?? []).filter(tokenExpoValido))) }))
      .filter((a) => a.tokens.length > 0);
    if (mensagens.length === 0) return;

    if (Platform.OS === 'web') {
      const { data: sessao } = await supabase.auth.getSession();
      const jwt = sessao.session?.access_token;
      if (!jwt) return;
      await fetch('/api/push-avisos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ mensagens }),
      });
      return;
    }

    const lote = mensagens.flatMap((a) => a.tokens.map((to) => ({
      to, title: a.titulo, body: a.corpo, data: a.dados ?? {}, sound: 'default', channelId: 'default', priority: 'high',
    })));
    for (let i = 0; i < lote.length; i += 100) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(lote.slice(i, i + 100)),
      });
    }
  } catch (e) {
    console.warn('[push] não foi possível enviar o aviso do fluxo de classes', e);
  }
}
