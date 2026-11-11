/**
 * Relatório de pontuação: ordenação e posição por categoria (ex.: "quem fez mais pontos em Bom da Bíblia").
 * Parte pura, sem imports: roda com "node --test" (ver "npm run test:relatorio-pontuacao").
 */

export interface CategoriasPontuacao {
  presenca: number; pontualidade: number; material: number; uniforme: number;
  bom_biblia: number; classe_biblica: number; especialidade: number;
  pgm_especial: number; atividade_unidade: number; extras: number; custom: number;
}

export type CampoPontuacao = 'total' | keyof CategoriasPontuacao;

export interface LinhaRelatorioPontuacao {
  dbv_id: number;
  nome: string;
  unidade_nome: string;
  foto_url?: string | null;
  total: number;
  categorias?: CategoriasPontuacao;
}

export interface LinhaClassificada extends LinhaRelatorioPontuacao {
  /** 1 = primeiro lugar; empatados dividem a mesma posição (1, 1, 3...). */
  posicao: number;
  /** Pontos no campo escolhido (a categoria ou o total geral). */
  valor: number;
}

export const CATEGORIAS_VAZIAS = (): CategoriasPontuacao => ({
  presenca: 0, pontualidade: 0, material: 0, uniforme: 0, bom_biblia: 0,
  classe_biblica: 0, especialidade: 0, pgm_especial: 0, atividade_unidade: 0, extras: 0, custom: 0,
});

/** Nomes mostrados nas telas e nos relatórios (mesmos rótulos de categoriasPontuacao.ts). */
export const ROTULO_CAMPO: Record<CampoPontuacao, string> = {
  total: 'Total geral',
  presenca: 'Presença', pontualidade: 'Pontualidade', material: 'Material', uniforme: 'Uniforme',
  bom_biblia: 'Bom da Bíblia', classe_biblica: 'Classe Bíblica', especialidade: 'Especialidade',
  pgm_especial: 'Pgm Especial', atividade_unidade: 'Ativ. Unidade', extras: 'Extras', custom: 'Personalizados',
};

export const OPCOES_CAMPO: { id: CampoPontuacao; nome: string }[] =
  (Object.keys(ROTULO_CAMPO) as CampoPontuacao[]).map((id) => ({ id, nome: ROTULO_CAMPO[id] }));

export function valorNoCampo(l: LinhaRelatorioPontuacao, campo: CampoPontuacao): number {
  if (campo === 'total') return Number(l.total) || 0;
  return Number(l.categorias?.[campo]) || 0;
}

/**
 * Ordena do maior para o menor pelo campo escolhido e numera as posições (empate = mesma posição; desempate visual por
 * total geral e nome). `soQuemPontuou` tira quem ficou com zero no campo (útil em "Bom da Bíblia").
 */
export function classificar(linhas: LinhaRelatorioPontuacao[], campo: CampoPontuacao, soQuemPontuou = false): LinhaClassificada[] {
  const base = linhas
    .map((l) => ({ ...l, valor: valorNoCampo(l, campo) }))
    .filter((l) => !soQuemPontuou || l.valor > 0)
    .sort((a, b) => b.valor - a.valor || b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
  let posicao = 0;
  let anterior: number | null = null;
  return base.map((l, i) => {
    if (anterior === null || l.valor !== anterior) { posicao = i + 1; anterior = l.valor; }
    return { ...l, posicao };
  });
}

/** Título do relatório: "Relatório de Pontuação — Bom da Bíblia — Mês atual". */
export function tituloPontuacao(periodoLabel: string, campo: CampoPontuacao): string {
  return campo === 'total'
    ? `Relatório de Pontuação — ${periodoLabel}`
    : `Relatório de Pontuação — ${ROTULO_CAMPO[campo]} — ${periodoLabel}`;
}
