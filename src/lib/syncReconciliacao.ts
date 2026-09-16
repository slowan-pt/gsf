/**
 * Lógica pura de reconciliação de id da fila de sincronização offline
 * (src/lib/sync.ts). Extraída para cá sem nenhuma dependência de
 * expo-sqlite/Supabase/React Native para poder ser testada isoladamente
 * (ver src/lib/__tests__/syncReconciliacao.test.ts) — é justamente o trecho
 * que tinha o bug de pontos extras sumindo do ranking/extrato depois de
 * sincronizar (id local de uma linha ainda não reconciliada ficava
 * "grudado" em operações já enfileiradas para a mesma linha).
 */

export interface OperacaoFila {
  id: string;
  tabela: string;
  /** Payload da operação, serializado como JSON — mesmo formato gravado em fila_sync.dados. */
  dados: string;
}

/**
 * Depois que um INSERT é reconciliado (id local -> id real do servidor),
 * propaga o id novo para dentro do payload de QUALQUER outra operação ainda
 * pendente da MESMA tabela que carregue o id local antigo — sejam UPDATEs
 * ou DELETEs, enfileirados antes ou depois deste INSERT.
 *
 * Muta os objetos de `fila` que precisarem de correção (efeito colateral
 * intencional: o chamador usa a mesma referência de array no restante do
 * laço de sincronização) e devolve só os que de fato mudaram, para o
 * chamador persistir no SQLite.
 *
 * Idempotente: rodar de novo depois que uma operação já foi corrigida não
 * faz nada (o id já não é mais `idLocal`), e nunca mexe em operações de
 * outra tabela, outro id, ou a própria operação que originou a reconciliação.
 */
export function propagarIdReconciliado(
  fila: OperacaoFila[],
  opAtualId: string,
  tabela: string,
  idLocal: number,
  idNovo: number
): OperacaoFila[] {
  const alteradas: OperacaoFila[] = [];
  for (const pendente of fila) {
    if (pendente.tabela !== tabela) continue;
    if (pendente.id === opAtualId) continue;

    let dadosPendente: Record<string, unknown>;
    try {
      dadosPendente = JSON.parse(pendente.dados);
    } catch {
      continue;
    }
    if (dadosPendente.id !== idLocal) continue;

    dadosPendente.id = idNovo;
    pendente.dados = JSON.stringify(dadosPendente);
    alteradas.push(pendente);
  }
  return alteradas;
}

/**
 * Decide se um UPDATE cuja linha não foi encontrada no servidor deve ficar
 * pendente (retorna true) em vez de cair no upsert genérico. Só se aplica a
 * tabelas cujo id local nunca é estável no servidor (`tabelasIdGeradoNoServidor`)
 * — para essas, "não achei pelo id" quer dizer "o INSERT correspondente
 * ainda não reconciliou", não "a linha foi apagada". Deixar essas operações
 * caírem no upsert genérico é o que criava linhas incompletas (ex.:
 * `pontuacoes` sem `dbv_id`).
 */
export function deveManterUpdatePendente(
  tabela: string,
  encontradoNoServidor: boolean,
  tabelasIdGeradoNoServidor: ReadonlySet<string>
): boolean {
  return !encontradoNoServidor && tabelasIdGeradoNoServidor.has(tabela);
}
