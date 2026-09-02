/**
 * Normaliza texto pra busca: remove acentos, baixa a caixa e tira espaços
 * nas pontas. Usar em TODO campo de busca/filtro do app — "Agatha" tem que
 * achar "Ágatha".
 */
export function semAcento(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Verdadeiro se `alvo` contém `termo`, ignorando acentos e caixa. */
export function combinaBusca(alvo: string | null | undefined, termo: string): boolean {
  const t = semAcento(termo);
  if (!t) return true;
  return semAcento(alvo).includes(t);
}
