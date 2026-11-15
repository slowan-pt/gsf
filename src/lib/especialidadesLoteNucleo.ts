/**
 * Regra do "adicionar especialidade em lote": quem já tem a especialidade é ignorado, nunca regravado.
 * Parte pura, sem imports: roda com "node --test" (ver "npm run test:especialidades-lote").
 */

/** Mesma comparação de especialidades.ts (sem acento, minúsculo, espaços simples). */
export function chaveEspecialidade(nome: string): string {
  return nome.trim().replace(/\s+/g, ' ').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export interface ParLote { membroId: number; especialidade: string }

export interface PlanoLote {
  /** Combinações que serão gravadas. */
  gravar: ParLote[];
  /** Combinações ignoradas porque o membro já tem a especialidade. */
  ignorar: ParLote[];
}

/**
 * Cruza membros × especialidades escolhidos com o que cada membro já tem.
 * `jaTem` guarda, por membro, as especialidades já concluídas (nomes passados por `chaveEspecialidade`).
 */
export function planejarLote(
  membroIds: readonly number[],
  especialidades: readonly string[],
  jaTem: ReadonlyMap<number, ReadonlySet<string>>,
): PlanoLote {
  const gravar: ParLote[] = [];
  const ignorar: ParLote[] = [];
  const vistos = new Set<string>();
  for (const membroId of membroIds) {
    for (const especialidade of especialidades) {
      const chave = chaveEspecialidade(especialidade);
      const unica = `${membroId}|${chave}`;
      if (vistos.has(unica)) continue; // a mesma especialidade escolhida duas vezes não conta em dobro
      vistos.add(unica);
      (jaTem.get(membroId)?.has(chave) ? ignorar : gravar).push({ membroId, especialidade });
    }
  }
  return { gravar, ignorar };
}

/** Quem, entre os membros escolhidos, já tem a especialidade. */
export function quemJaTem(
  membroIds: readonly number[],
  especialidade: string,
  jaTem: ReadonlyMap<number, ReadonlySet<string>>,
): number[] {
  const chave = chaveEspecialidade(especialidade);
  return membroIds.filter((id) => jaTem.get(id)?.has(chave));
}
