import AsyncStorage from '@react-native-async-storage/async-storage';
import { puxarDeSupabase } from './sync';
import { carregarCatalogoClasses } from './classesRequisitos';
import { carregarCatalogoEspecialidades } from './especialidades';
import { carregarDocumentosModelo, carregarCargosModelo } from './modelosPrograma';

const CHAVE_CARGA = 'primeira_carga_v1';

export interface EtapaCarga {
  rotulo: string;
  executar: () => Promise<unknown>;
}

/**
 * Tudo o que o app precisa ter em mãos para navegar sem esperar. Rodamos isso
 * de uma vez na primeira abertura, em vez de cada tela buscar o seu quando é
 * aberta pela primeira vez — que era o que dava a sensação de app lento.
 */
export const ETAPAS_CARGA: EtapaCarga[] = [
  {
    rotulo: 'Membros, pontuações e mensagens',
    // puxarDeSupabase devolve false em vez de lançar quando falha; sem essa
    // verificação a etapa era dada como concluída mesmo sem baixar nada.
    executar: async () => {
      const ok = await puxarDeSupabase();
      if (!ok) throw new Error('Não foi possível baixar os dados do clube.');
    },
  },
  { rotulo: 'Requisitos das classes', executar: () => carregarCatalogoClasses() },
  { rotulo: 'Catálogo de especialidades', executar: () => carregarCatalogoEspecialidades() },
  { rotulo: 'Documentos e cargos do clube', executar: () => Promise.all([
      carregarDocumentosModelo(),
      carregarCargosModelo(),
    ]) },
];

export async function primeiraCargaConcluida(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CHAVE_CARGA)) === '1';
  } catch {
    // Sem storage não dá pra saber; segue como já concluída para não travar o app.
    return true;
  }
}

export async function marcarPrimeiraCargaConcluida(): Promise<void> {
  try {
    await AsyncStorage.setItem(CHAVE_CARGA, '1');
  } catch {
    // Não conseguir gravar só faz a carga rodar de novo na próxima abertura.
  }
}

/**
 * Executa a carga inicial informando o progresso.
 *
 * Uma etapa que falhe não interrompe as demais, mas a carga só é dada como
 * concluída se TODAS derem certo — senão a marcação não é gravada e o download
 * é refeito na próxima abertura. Antes o app marcava como concluída mesmo com
 * falhas, então a barra chegava a 100% sem os dados terem vindo.
 */
export async function executarPrimeiraCarga(
  aoProgredir?: (feitas: number, total: number, rotulo: string) => void
): Promise<{ completa: boolean; falhas: string[] }> {
  const total = ETAPAS_CARGA.length;
  const falhas: string[] = [];

  for (let i = 0; i < total; i++) {
    const etapa = ETAPAS_CARGA[i];
    aoProgredir?.(i, total, etapa.rotulo);
    try {
      await etapa.executar();
    } catch {
      falhas.push(etapa.rotulo);
    }
  }

  const completa = falhas.length === 0;
  aoProgredir?.(total, total, completa ? 'Pronto' : 'Concluído com pendências');
  if (completa) await marcarPrimeiraCargaConcluida();
  return { completa, falhas };
}
