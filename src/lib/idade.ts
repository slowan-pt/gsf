import { idadePorNascimento } from './classesRequisitos';

/**
 * A coluna `idade` do cadastro é um número gravado numa data e envelhece. A idade correta é
 * sempre a calculada pela data de nascimento; só usa o valor gravado se não houver data.
 */
export function comIdadeAtual<T extends { data_nascimento?: string | null; idade?: number | null }>(membro: T): T;
export function comIdadeAtual<T extends { data_nascimento?: string | null; idade?: number | null }>(membro: T | null): T | null;
export function comIdadeAtual<T extends { data_nascimento?: string | null; idade?: number | null }>(membro: T | null): T | null {
  if (!membro) return membro;
  const calculada = idadePorNascimento(membro.data_nascimento ?? null);
  return calculada === null ? membro : { ...membro, idade: calculada };
}

export function comIdadeAtualLista<T extends { data_nascimento?: string | null; idade?: number | null }>(lista: T[]): T[] {
  return lista.map((m) => comIdadeAtual<T>(m) as T);
}
