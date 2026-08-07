import { supabase } from './supabase';

export interface RequisitoCatalogo {
  id: number;
  classe_nome: string;
  secao: string;
  secao_ordem: number;
  ordem: number;
  codigo: string;
  codigo_raiz: string;
  subitem: string | null;
  texto: string;
  tipo: string;
  pagina: number | null;
  especialidade_nome: string | null;
  avancada: boolean;
  pontua: boolean;
}

export interface ProgressoRequisito {
  id?: number;
  dbv_id: number;
  requisito_id: number;
  classe_nome: string;
  concluido: boolean;
  origem: 'manual' | 'atividade' | 'especialidade';
  observacao?: string | null;
  concluido_em?: string | null;
}

export interface ResumoClasse {
  classe: string;
  total: number;
  concluidos: number;
  pct: number;
  nivel: NivelGamificado;
}

export interface NivelGamificado {
  id: string;
  titulo: string;
  emoji: string;
  cor: string;
  minPct: number;
}

/** Trilha de progressão exibida nas barras/medalhas. */
export const NIVEIS: NivelGamificado[] = [
  { id: 'inicio', titulo: 'Começando a jornada', emoji: '🌱', cor: '#94a3b8', minPct: 0 },
  { id: 'explorador', titulo: 'Explorador', emoji: '🧭', cor: '#0ea5e9', minPct: 20 },
  { id: 'trilheiro', titulo: 'Trilheiro', emoji: '🥾', cor: '#6366f1', minPct: 40 },
  { id: 'veterano', titulo: 'Veterano', emoji: '🔥', cor: '#f59e0b', minPct: 60 },
  { id: 'quase', titulo: 'Reta final', emoji: '⚡', cor: '#ea580c', minPct: 80 },
  { id: 'investido', titulo: 'Pronto para investidura!', emoji: '🏅', cor: '#16a34a', minPct: 100 },
];

export function nivelPara(pct: number): NivelGamificado {
  let atual = NIVEIS[0];
  for (const n of NIVEIS) if (pct >= n.minPct) atual = n;
  return atual;
}

export function corProgresso(pct: number) {
  return nivelPara(pct).cor;
}

export async function carregarCatalogoClasses(): Promise<RequisitoCatalogo[]> {
  const { data, error } = await supabase
    .from('classes_requisitos_catalogo')
    .select('id,classe_nome,secao,secao_ordem,ordem,codigo,codigo_raiz,subitem,texto,tipo,pagina,especialidade_nome,avancada,pontua')
    .eq('ativo', true)
    .order('classe_nome', { ascending: true })
    .order('secao_ordem', { ascending: true })
    .order('ordem', { ascending: true });
  if (error) throw error;
  return (data ?? []) as RequisitoCatalogo[];
}

export async function carregarProgressoClube(clubeId: number, dbvIds?: number[]): Promise<ProgressoRequisito[]> {
  let query = supabase
    .from('classes_requisitos_progresso')
    .select('id,dbv_id,requisito_id,classe_nome,concluido,origem,observacao,concluido_em')
    .eq('clube_id', clubeId)
    .eq('concluido', true);
  if (dbvIds && dbvIds.length > 0) query = query.in('dbv_id', dbvIds);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ProgressoRequisito[];
}

/** Marca ou desmarca um requisito para um membro. */
export async function definirRequisito(params: {
  clubeId: number;
  dbvId: number;
  requisito: RequisitoCatalogo;
  concluido: boolean;
  usuarioId?: string | null;
}) {
  const { clubeId, dbvId, requisito, concluido, usuarioId } = params;
  if (!concluido) {
    const { error } = await supabase
      .from('classes_requisitos_progresso')
      .delete()
      .eq('clube_id', clubeId)
      .eq('dbv_id', dbvId)
      .eq('requisito_id', requisito.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('classes_requisitos_progresso').upsert(
    {
      clube_id: clubeId,
      dbv_id: dbvId,
      requisito_id: requisito.id,
      classe_nome: requisito.classe_nome,
      concluido: true,
      origem: 'manual',
      concluido_por: usuarioId ?? null,
      concluido_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'clube_id,dbv_id,requisito_id' }
  );
  if (error) throw error;
}

/** Lista de classes distintas no catálogo, em ordem de progressão. */
export function classesDoCatalogo(catalogo: RequisitoCatalogo[]): string[] {
  return Array.from(new Set(catalogo.map((r) => r.classe_nome)));
}

/**
 * Resume o progresso de um membro por classe. Só requisitos com `pontua = true`
 * (os requisitos-raiz) entram na conta — subitens são detalhamento.
 */
export function resumirPorClasse(
  catalogo: RequisitoCatalogo[],
  concluidos: Set<number>
): ResumoClasse[] {
  const porClasse = new Map<string, { total: number; feitos: number }>();
  for (const req of catalogo) {
    if (!req.pontua) continue;
    const atual = porClasse.get(req.classe_nome) ?? { total: 0, feitos: 0 };
    atual.total += 1;
    if (concluidos.has(req.id)) atual.feitos += 1;
    porClasse.set(req.classe_nome, atual);
  }
  return Array.from(porClasse.entries()).map(([classe, { total, feitos }]) => {
    const pct = total > 0 ? Math.round((feitos / total) * 100) : 0;
    return { classe, total, concluidos: feitos, pct, nivel: nivelPara(pct) };
  });
}

/** Agrupa o catálogo de uma classe em seções → requisitos-raiz → subitens. */
export interface SecaoAgrupada {
  secao: string;
  avancada: boolean;
  raizes: { raiz: RequisitoCatalogo; filhos: RequisitoCatalogo[] }[];
}

export function agruparClasse(catalogo: RequisitoCatalogo[], classe: string): SecaoAgrupada[] {
  const daClasse = catalogo.filter((r) => r.classe_nome === classe);
  const secoes: SecaoAgrupada[] = [];
  for (const req of daClasse) {
    let secao = secoes.find((s) => s.secao === req.secao);
    if (!secao) {
      secao = { secao: req.secao, avancada: req.avancada, raizes: [] };
      secoes.push(secao);
    }
    if (req.pontua) {
      secao.raizes.push({ raiz: req, filhos: [] });
      continue;
    }
    const pai = [...secao.raizes].reverse().find((r) => r.raiz.codigo === req.codigo_raiz);
    if (pai) pai.filhos.push(req);
    // Subitem sem raiz correspondente vira um requisito próprio para não sumir da tela.
    else secao.raizes.push({ raiz: req, filhos: [] });
  }
  return secoes;
}
