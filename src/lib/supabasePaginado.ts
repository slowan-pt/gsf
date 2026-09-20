import { supabase } from './supabase';

/** Teto de linhas por requisição no PostgREST. */
export const PAGINA_SUPABASE = 1000;

/**
 * Baixa o resultado INTEIRO de uma consulta, em páginas.
 *
 * Um `select()` simples devolve no máximo mil linhas, SEM erro e SEM aviso —
 * quem lê acha que recebeu tudo. Qualquer leitura que varra o clube inteiro
 * (ranking, relatórios, extrato de unidade) precisa passar por aqui: com o
 * clube crescendo, a query silenciosamente passa a devolver um pedaço e os
 * totais ficam menores que a realidade, divergindo de telas que consultam
 * um membro só (essas cabem numa página e por isso vinham certas).
 *
 * Exemplo:
 *   const linhas = await buscarPaginado((q) => q.eq('clube_id', clubeId), 'pontuacoes', '*');
 */
export async function buscarPaginado<T = any>(
  filtro: ((consulta: any) => any) | undefined,
  tabela: string,
  colunas = '*',
  ordenarPor?: string,
): Promise<T[]> {
  const todas: T[] = [];
  for (let pagina = 0; ; pagina++) {
    let consulta = supabase.from(tabela).select(colunas);
    if (filtro) consulta = filtro(consulta);
    if (ordenarPor) consulta = consulta.order(ordenarPor);
    consulta = consulta.range(pagina * PAGINA_SUPABASE, pagina * PAGINA_SUPABASE + PAGINA_SUPABASE - 1);
    const { data, error } = await consulta;
    if (error) throw error;
    const lote = (data ?? []) as T[];
    todas.push(...lote);
    if (lote.length < PAGINA_SUPABASE) return todas;
  }
}
