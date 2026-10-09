import { getClubeAtivoId } from './contextoAtual';
import { carregarAguardandoMembro } from './aguardandoMembro';
import { carregarResumoCatalogoClasses, carregarProgressoClube, resumirPorClasseSeparado, CLASSES_BASE_ORDEM } from './classesRequisitos';
import { chaveItemFluxo } from './fluxoClasses';

/**
 * Classes que já valem como conquistadas para a faixa/uniforme: requisitos todos concluídos e a classe
 * já fora da fila de aprovação (diretoria/regional) e de correção. Regular e agrupadas contam como a mesma.
 *
 * As chaves são "<classe base>|<avançada?>", ex.: "Amigo|false", "Amigo|true", "Líder Máster|true".
 */
export const chaveSlotClasse = (base: string, avancada: boolean) => `${base}|${avancada}`;

const semAgrupadas = (nome: string) => nome.replace(/\s*-\s*Agrupadas\s*$/i, '').trim();

export interface ClassesConquistadas {
  chaves: Set<string>;
  ehLider: boolean;
}

export async function carregarClassesConquistadas(dbvId: number, idade: number | null): Promise<ClassesConquistadas> {
  const clubeId = getClubeAtivoId();
  const [catalogo, progresso, fluxo] = await Promise.all([
    carregarResumoCatalogoClasses(),
    carregarProgressoClube(clubeId, [dbvId]),
    carregarAguardandoMembro(clubeId, dbvId).catch(() => ({ classes: [] as string[], correcoes: [] as string[] })),
  ]);
  const concluidos = new Set(progresso.map((p) => p.requisito_id));
  const resumos = resumirPorClasseSeparado(catalogo, concluidos, idade);
  const emFluxo = new Set([...(fluxo.classes ?? []), ...((fluxo as any).correcoes ?? [])]);
  const chaves = new Set<string>();
  for (const r of resumos) {
    if (r.total <= 0 || r.concluidos < r.total) continue;
    if (emFluxo.has(chaveItemFluxo(r.classe, r.avancada))) continue;
    chaves.add(chaveSlotClasse(semAgrupadas(r.classe), r.avancada));
  }
  return { chaves, ehLider: chaves.has(chaveSlotClasse('Líder', false)) };
}

/** As seis classes de idade, na ordem das insígnias. */
export const ORDEM_CLASSES = CLASSES_BASE_ORDEM;
