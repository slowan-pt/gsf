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
  { rotulo: 'Membros, pontuações e mensagens', executar: () => puxarDeSupabase() },
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
 * Executa a carga inicial informando o progresso. Uma etapa que falhe (rede
 * instável, por exemplo) não impede as demais nem trava a entrada no app — o
 * que faltar é buscado normalmente quando a tela for aberta.
 */
export async function executarPrimeiraCarga(
  aoProgredir?: (feitas: number, total: number, rotulo: string) => void
): Promise<void> {
  const total = ETAPAS_CARGA.length;
  for (let i = 0; i < total; i++) {
    const etapa = ETAPAS_CARGA[i];
    aoProgredir?.(i, total, etapa.rotulo);
    try {
      await etapa.executar();
    } catch {
      // Segue para a próxima etapa.
    }
  }
  aoProgredir?.(total, total, 'Pronto');
  await marcarPrimeiraCargaConcluida();
}
