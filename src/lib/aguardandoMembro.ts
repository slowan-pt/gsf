import { supabase } from './supabase';
import { carregarAguardandoInvestidura } from './investidura';
import { normalizarNomeParaComparar } from './especialidades';

/**
 * O que está "Aguardando aprovação" para um membro: classes na fila da diretoria ou do regional
 * e itens no ambiente intermediário (aguardando investidura). Serve para o selo laranja da Início.
 * Listas simples (JSON) para caberem no cache da Início.
 */
export interface AguardandoMembro {
  /** Classes na fila da diretoria ou do regional (nome como no fluxo, sem o sufixo de agrupadas). */
  classes: string[];
  /** Classes devolvidas para correção (recusadas pela diretoria ou pelo regional). */
  correcoes?: string[];
  /** Nome normalizado (sem acento/maiúscula) das especialidades. */
  especialidades: string[];
}

export async function carregarAguardandoMembro(clubeId: number, dbvId: number): Promise<AguardandoMembro> {
  const classes = new Set<string>();
  const correcoes = new Set<string>();
  const especialidades = new Set<string>();

  try {
    const { data } = await supabase
      .from('classe_aprovacoes')
      .select('item_nome,etapa')
      .eq('clube_id', clubeId)
      .eq('dbv_id', dbvId)
      .in('etapa', ['diretoria', 'regional', 'correcao']);
    for (const l of (data ?? []) as any[]) {
      if (l.etapa === 'correcao') correcoes.add(String(l.item_nome));
      else classes.add(String(l.item_nome));
    }
  } catch {
    // sem a migration 133 ou sem permissão: segue só com o intermediário
  }

  try {
    // Classe só vira "concluída" para o membro quando o regional aprova; o intermediário
    // (aguardando investidura) vale para as especialidades.
    for (const i of await carregarAguardandoInvestidura(clubeId, dbvId)) {
      if (i.tipo === 'especialidade') especialidades.add(normalizarNomeParaComparar(i.nome));
    }
  } catch {
    // idem
  }

  return { classes: Array.from(classes), correcoes: Array.from(correcoes), especialidades: Array.from(especialidades) };
}
