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

/** Duck type mínimo do SQLiteDatabase real — só o necessário pra consultar a memória de reconciliação. */
export interface BancoConsultavel {
  getFirstAsync<T>(sql: string, params: any[]): Promise<T | null>;
}

/**
 * Consulta a memória durável de reconciliação (tabela local
 * `sync_id_reconciliado`) — a "chave segura" usada para localizar o id
 * definitivo de uma operação pendente mesmo depois de reiniciar o app,
 * quando a reconciliação (linha local já corrigida) aconteceu numa sessão
 * anterior e a fila nunca chegou a ser corrigida.
 */
export async function resolverIdViaMapeamento(
  db: BancoConsultavel,
  tabela: string,
  idAntigo: number,
  tabelasIdGeradoNoServidor: ReadonlySet<string>
): Promise<number | null> {
  if (!tabelasIdGeradoNoServidor.has(tabela)) return null;
  const mapeado = await db.getFirstAsync<{ id_novo: number }>(
    'SELECT id_novo FROM sync_id_reconciliado WHERE tabela = ? AND id_antigo = ?',
    [tabela, idAntigo]
  );
  return mapeado?.id_novo ?? null;
}

/**
 * Decide se um INSERT reenviado pode ser recuperado por chave natural
 * depois de bater numa violação de unicidade (Postgres 23505) — sinal de
 * que o servidor já recebeu esse INSERT antes (ex.: app fechou ou a rede
 * caiu entre o servidor processar e a resposta chegar). Só recupera quando
 * a tabela tem uma chave natural conhecida E o payload realmente carrega
 * todos os campos dessa chave — nunca adivinha.
 */
export function chaveNaturalParaRecuperar(
  tabela: string,
  codigoErro: string | undefined,
  payload: Record<string, unknown>,
  chaveNaturalPorTabela: Readonly<Record<string, string[]>>
): string[] | null {
  if (codigoErro !== '23505') return null;
  const chave = chaveNaturalPorTabela[tabela];
  if (!chave || chave.length === 0) return null;
  return chave.every((campo) => payload[campo] != null) ? chave : null;
}
