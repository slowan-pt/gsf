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
  {
    rotulo: 'Documentos e cargos do clube',
    executar: () => Promise.all([carregarDocumentosModelo(), carregarCargosModelo()]),
  },
];

/** Esperas entre tentativas. O app tenta sozinho — o usuário nunca precisa reabrir. */
const ESPERAS_ENTRE_TENTATIVAS_MS = [3_000, 8_000, 20_000, 45_000];

export async function primeiraCargaConcluida(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CHAVE_CARGA)) === '1';
  } catch {
    // Sem storage não dá pra saber; segue como já concluída para não travar o app.
    return true;
  }
}

async function marcarConcluida(): Promise<void> {
  try {
    await AsyncStorage.setItem(CHAVE_CARGA, '1');
  } catch {
    // Não conseguir gravar só faz a carga rodar de novo na próxima abertura.
  }
}

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ProgressoCarga {
  feitas: number;
  total: number;
  rotulo: string;
  /** Número da tentativa atual (1 = primeira). */
  tentativa: number;
}

/** Guarda quais etapas ainda faltam entre tentativas e chamadas. */
let etapasPendentes: EtapaCarga[] = [...ETAPAS_CARGA];
let cargaEmAndamento: Promise<boolean> | null = null;

/**
 * Baixa tudo e INSISTE até conseguir: cada rodada tenta apenas o que ficou
 * faltando, com esperas crescentes entre as tentativas.
 *
 * Antes, uma etapa que falhasse só era refeita quando o usuário fechava e
 * reabria o app — o que é péssimo. Agora o app se resolve sozinho.
 *
 * Chamadas concorrentes reaproveitam a mesma execução.
 */
export function baixarTudo(
  aoProgredir?: (p: ProgressoCarga) => void
): Promise<boolean> {
  if (cargaEmAndamento) return cargaEmAndamento;
  cargaEmAndamento = executarComTentativas(aoProgredir).finally(() => {
    cargaEmAndamento = null;
  });
  return cargaEmAndamento;
}

async function executarComTentativas(
  aoProgredir?: (p: ProgressoCarga) => void
): Promise<boolean> {
  const totalGeral = ETAPAS_CARGA.length;

  for (let tentativa = 1; tentativa <= ESPERAS_ENTRE_TENTATIVAS_MS.length + 1; tentativa++) {
    const falharam: EtapaCarga[] = [];
    // Etapas já concluídas em rodadas anteriores não são refeitas.
    const jaFeitas = totalGeral - etapasPendentes.length;

    for (let i = 0; i < etapasPendentes.length; i++) {
      const etapa = etapasPendentes[i];
      aoProgredir?.({
        feitas: jaFeitas + i,
        total: totalGeral,
        rotulo: etapa.rotulo,
        tentativa,
      });
      try {
        await etapa.executar();
      } catch {
        falharam.push(etapa);
      }
    }

    etapasPendentes = falharam;

    if (etapasPendentes.length === 0) {
      aoProgredir?.({ feitas: totalGeral, total: totalGeral, rotulo: 'Pronto', tentativa });
      await marcarConcluida();
      return true;
    }

    const espera = ESPERAS_ENTRE_TENTATIVAS_MS[tentativa - 1];
    if (espera === undefined) break;
    await esperar(espera);
  }

  return false;
}

/** Ainda falta alguma coisa da carga inicial? */
export function temCargaPendente(): boolean {
  return etapasPendentes.length > 0;
}
