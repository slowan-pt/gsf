import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from './supabase';
import { buscarPaginado } from './supabasePaginado';
import { carregarConfigRanking, anosEfetivosRanking } from './rankingConfig';
import { linhasCategoriasPontuacao } from './categoriasPontuacao';

/**
 * Extrato de pontos de um membro — fonte única.
 *
 * Vive aqui, e não dentro da tela de extrato, porque a tela de Ranking
 * também mostra o extrato do próprio usuário quando o clube esconde a lista
 * completa. Duas cópias da mesma conta foi exatamente o que fez o ranking
 * divergir do extrato antes (ver src/lib/categoriasPontuacao.ts).
 */

const PONTOS_FALLBACK = { presenca: 25, pontualidade: 100, material: 25, uniforme: 25 };

export interface LinhaExtrato {
  label: string;
  pts: number;
  icon: string;
  observacao?: string;
  tipo?: 'base' | 'extra' | 'custom';
}

export interface RegistroDia {
  data: string;
  dataFormatada: string;
  lancado_por?: string;
  linhas: LinhaExtrato[];
  subtotal: number;
}

export interface ExtratoMembro {
  nome: string;
  unidade_nome: string;
  foto_url?: string | null;
  total: number;
  dias: RegistroDia[];
}

function anoDaData(data: string): number {
  return Number(String(data).slice(0, 4));
}

export function formatarDataExtrato(data: string): string {
  try {
    const txt = format(parseISO(data), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  } catch {
    return data;
  }
}

/** Lê do Supabase. Lança se estiver offline — quem chama decide o fallback. */
export async function carregarExtratoMembro(dbvId: number, clubeId: number): Promise<ExtratoMembro> {
  const [
    membroResp,
    cfgResp,
    pontuacoes,
    custom,
    itensResp,
    extrasItens,
    configRanking,
  ] = await Promise.all([
    supabase.from('desbravadores').select('nome, unidade_nome, foto_url').eq('id', dbvId).maybeSingle(),
    supabase
      .from('config_pontuacao')
      .select('presenca, pontualidade, material, uniforme')
      .eq('clube_id', clubeId)
      .maybeSingle(),
    // Mesmo filtro do ranking (clube_id + dbv_id) e paginado como ele: as duas
    // telas precisam ler exatamente a mesma base, senão voltam a divergir.
    buscarPaginado<any>(
      (q) => q.eq('clube_id', clubeId).eq('dbv_id', dbvId).order('data', { ascending: false }),
      'pontuacoes',
      `data,
        presenca, presenca_pts,
        pontualidade, pontualidade_pts,
        material, material_pts,
        uniforme, uniforme_pts,
        bom_biblia,
        pontos_extras,
        classe_biblica,
        especialidade,
        pgm_especial,
        atividade_unidade,
        observacao,
        lancado_por`,
    ),
    buscarPaginado<any>(
      (q) => q.eq('clube_id', clubeId).eq('dbv_id', dbvId).order('data', { ascending: false }),
      'pontuacoes_custom',
      'data, item_id, item_nome, item_valor, quantidade, pontos',
    ),
    supabase.from('pontuacao_itens').select('id, titulo, valor').eq('clube_id', clubeId),
    buscarPaginado<any>(
      (q) => q.eq('clube_id', clubeId).eq('dbv_id', dbvId),
      'pontuacoes_extras_itens',
      'data, pontos, observacao',
    ),
    carregarConfigRanking(clubeId),
  ]);

  if (membroResp.error) throw membroResp.error;
  if (cfgResp.error) throw cfgResp.error;
  if (itensResp.error) throw itensResp.error;

  // Mesmo filtro de anos usado no ranking, pra bater com o total exibido lá.
  const anos = new Set(anosEfetivosRanking(configRanking));
  const pontosDoAno = pontuacoes.filter((p) => anos.has(anoDaData(p.data)));
  const customDoAno = custom.filter((c) => anos.has(anoDaData(c.data)));
  const extrasDoAno = extrasItens.filter((it) => anos.has(anoDaData(it.data)));

  const cfg = cfgResp.data ?? PONTOS_FALLBACK;
  const itensPorId = new Map((itensResp.data ?? []).map((i: any) => [Number(i.id), i]));

  const extrasPorData = new Map<string, { pontos: number; observacao: string | null }[]>();
  for (const it of extrasDoAno) {
    const lista = extrasPorData.get(it.data) ?? [];
    lista.push({ pontos: Number(it.pontos) || 0, observacao: it.observacao });
    extrasPorData.set(it.data, lista);
  }

  const porData = new Map<string, RegistroDia>();
  const obterDia = (data: string): RegistroDia => {
    const existente = porData.get(data);
    if (existente) return existente;
    const novo: RegistroDia = { data, dataFormatada: formatarDataExtrato(data), linhas: [], subtotal: 0 };
    porData.set(data, novo);
    return novo;
  };

  for (const p of pontosDoAno) {
    const dia = obterDia(p.data);
    dia.lancado_por = p.lancado_por ?? dia.lancado_por;

    for (const l of linhasCategoriasPontuacao(p, cfg)) {
      dia.linhas.push({ ...l, tipo: 'base' });
      dia.subtotal += l.pts;
    }

    const extrasPts = Number(p.pontos_extras) || 0;
    if (extrasPts !== 0) {
      const itensDoDia = extrasPorData.get(p.data) ?? [];
      for (const it of itensDoDia) {
        dia.linhas.push({ label: 'Pontos Extras', pts: it.pontos, icon: 'flash-outline', observacao: it.observacao ?? undefined, tipo: 'extra' });
        dia.subtotal += it.pontos;
      }
      // Parte do agregado sem lançamento correspondente no ledger (ex.: pontos
      // lançados antes da tabela de itens existir) — sem isso a tela descartava
      // essa diferença em vez de somá-la, subestimando o extrato do membro.
      const somaItens = itensDoDia.reduce((acc, it) => acc + it.pontos, 0);
      const resto = extrasPts - somaItens;
      if (resto !== 0) {
        dia.linhas.push({ label: 'Pontos Extras', pts: resto, icon: 'flash-outline', observacao: p.observacao ?? undefined, tipo: 'extra' });
        dia.subtotal += resto;
      }
    }
  }

  for (const c of customDoAno) {
    const dia = obterDia(c.data);
    const item: any = itensPorId.get(Number(c.item_id));
    const quantidade = Number(c.quantidade) || 0;
    const pontos = Number(c.pontos) || 0;
    if (quantidade === 0 && pontos === 0) continue;
    dia.linhas.push({
      label: c.item_nome ?? item?.titulo ?? 'Pontuação personalizada',
      pts: pontos,
      icon: 'add-circle-outline',
      tipo: 'custom',
      observacao: quantidade > 1 ? `${quantidade}x ${c.item_valor ?? item?.valor ?? ''} pts` : undefined,
    });
    dia.subtotal += pontos;
  }

  const dias = Array.from(porData.values())
    .filter((d) => d.linhas.length > 0)
    .sort((a, b) => b.data.localeCompare(a.data));

  return {
    nome: membroResp.data?.nome ?? '—',
    unidade_nome: membroResp.data?.unidade_nome ?? '—',
    foto_url: membroResp.data?.foto_url ?? null,
    total: dias.reduce((acc, d) => acc + d.subtotal, 0),
    dias,
  };
}
