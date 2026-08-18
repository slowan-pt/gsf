import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  puxarAtividades,
  puxarCampori,
  puxarClassesEspecialidades,
  puxarComunicacao,
  puxarDocumentos,
  puxarMembros,
  puxarPontuacoes,
} from './sync';
import { carregarCatalogoClasses } from './classesRequisitos';
import { carregarCatalogoEspecialidades } from './especialidades';
import { carregarDocumentosModelo, carregarCargosModelo } from './modelosPrograma';

const CHAVE_CARGA = 'primeira_carga_v1';
/**
 * Independente da carga ter terminado: registra que a TELA de progresso já foi
 * mostrada uma vez. Sem isso, se o download não terminasse a tempo, a tela
 * completa voltava a aparecer em toda reabertura do app — o usuário só devia
 * ver essa tela uma única vez na vida do app.
 */
const CHAVE_TELA_EXIBIDA = 'primeira_carga_tela_exibida_v1';

export interface EtapaCarga {
  rotulo: string;
  executar: () => Promise<unknown>;
  /** Sem isto as telas principais ficam vazias — o app não deve liberar antes. */
  essencial?: boolean;
}

/**
 * Tudo o que o app precisa ter em mãos para navegar sem esperar. Rodamos isso
 * de uma vez na primeira abertura, em vez de cada tela buscar o seu quando é
 * aberta pela primeira vez — que era o que dava a sensação de app lento.
 */
/** Falha explícita: essas funções devolvem false em vez de lançar. */
function exigir(nome: string, tarefa: () => Promise<boolean>) {
  return async () => {
    if (!(await tarefa())) throw new Error(`Não foi possível baixar: ${nome}`);
  };
}

/**
 * ORDEM IMPORTA. O que destrava as telas vem primeiro; o que é pesado e não
 * bloqueia nada (fichas e documentos) vem por último. Antes era tudo num bloco
 * só e o app ficava minutos sem mostrar nem os nomes dos membros.
 */
export const ETAPAS_CARGA: EtapaCarga[] = [
  { rotulo: 'Nomes dos membros', executar: exigir('membros', puxarMembros), essencial: true },
  { rotulo: 'Pontuação e pontos extras', executar: exigir('pontuações', puxarPontuacoes), essencial: true },
  { rotulo: 'Classes e especialidades', executar: exigir('classes', puxarClassesEspecialidades), essencial: true },
  { rotulo: 'Requisitos das classes', executar: () => carregarCatalogoClasses() },
  { rotulo: 'Catálogo de especialidades', executar: () => carregarCatalogoEspecialidades() },
  { rotulo: 'Avisos e agenda', executar: exigir('avisos', puxarComunicacao) },
  {
    rotulo: 'Documentos e cargos do clube',
    executar: () => Promise.all([carregarDocumentosModelo(), carregarCargosModelo()]),
  },
  { rotulo: 'Atividades', executar: () => puxarAtividades() },
  { rotulo: 'Campori', executar: exigir('campori', puxarCampori) },
  // Por último de propósito: é o grupo mais pesado e nenhuma tela principal
  // precisa dele para abrir.
  { rotulo: 'Fichas e documentos dos membros', executar: exigir('documentos', puxarDocumentos) },
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

/** A tela cheia de progresso já apareceu alguma vez? */
export async function telaCargaJaExibida(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CHAVE_TELA_EXIBIDA)) === '1';
  } catch {
    // Sem storage não dá pra saber; assume que sim para não travar o usuário
    // numa tela cheia em toda abertura.
    return true;
  }
}

export async function marcarTelaCargaExibida(): Promise<void> {
  try {
    await AsyncStorage.setItem(CHAVE_TELA_EXIBIDA, '1');
  } catch {
    // Sem gravar, a tela pode voltar a aparecer — não é ideal, mas não é grave.
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
  aoProgredir?: (p: ProgressoCarga) => void,
  aoEssenciaisProntos?: () => void
): Promise<boolean> {
  if (cargaEmAndamento) return cargaEmAndamento;
  cargaEmAndamento = executarComTentativas(aoProgredir, aoEssenciaisProntos).finally(() => {
    cargaEmAndamento = null;
  });
  return cargaEmAndamento;
}

async function executarComTentativas(
  aoProgredir?: (p: ProgressoCarga) => void,
  aoEssenciaisProntos?: () => void
): Promise<boolean> {
  const totalGeral = ETAPAS_CARGA.length;
  let avisouEssenciais = false;

  for (let tentativa = 1; tentativa <= ESPERAS_ENTRE_TENTATIVAS_MS.length + 1; tentativa++) {
    const falharam: EtapaCarga[] = [];
    // Etapas já concluídas em rodadas anteriores não são refeitas.
    const jaFeitas = totalGeral - etapasPendentes.length;
    const restantes = [...etapasPendentes];

    for (let i = 0; i < restantes.length; i++) {
      const etapa = restantes[i];
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

      // Libera o app assim que o essencial chega, sem esperar o resto.
      if (!avisouEssenciais) {
        const aindaFaltaEssencial =
          restantes.slice(i + 1).some((e) => e.essencial) || falharam.some((e) => e.essencial);
        if (!aindaFaltaEssencial) {
          avisouEssenciais = true;
          aoEssenciaisProntos?.();
        }
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

/**
 * Já existe um download rodando? Sem esta checagem, cada evento de rede ou de
 * volta ao primeiro plano reiniciava o aviso, e a tarja ficava alternando entre
 * "baixando" e "concluído" sem parar.
 */
export function cargaEstaRodando(): boolean {
  return cargaEmAndamento !== null;
}
