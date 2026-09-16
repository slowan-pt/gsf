/**
 * Testes de regressão para a reconciliação de id da fila de sincronização
 * offline (bug: pontos extras somem do ranking/extrato porque um UPDATE
 * enfileirado antes de um INSERT sincronizar ficava com o id LOCAL antigo).
 *
 * Roda com "node --test" direto (Node >= 22.6, sem dependência nova —
 * usa o suporte nativo do Node para stripar tipos de arquivos .ts). Ver
 * "npm run test:sync-reconciliacao".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  propagarIdReconciliado, deveManterUpdatePendente, resolverIdViaMapeamento,
  chaveNaturalParaRecuperar, type OperacaoFila, type BancoConsultavel,
} from '../syncReconciliacao.ts';

/** Fake mínimo de SQLiteDatabase só com o que resolverIdViaMapeamento usa. */
function bancoFake(mapeamentos: Array<{ tabela: string; id_antigo: number; id_novo: number }>): BancoConsultavel {
  return {
    async getFirstAsync<T>(_sql: string, params: unknown[]): Promise<T | null> {
      const [tabela, idAntigo] = params;
      const achado = mapeamentos.find((m) => m.tabela === tabela && m.id_antigo === idAntigo);
      return (achado ? { id_novo: achado.id_novo } : null) as T | null;
    },
  };
}

function opFila(id: string, tabela: string, dados: Record<string, unknown>): OperacaoFila {
  return { id, tabela, dados: JSON.stringify(dados) };
}

function parse(op: OperacaoFila) {
  return JSON.parse(op.dados);
}

test('INSERT -> UPDATE: propaga o id reconciliado para o UPDATE pendente', () => {
  const idLocal = 501;
  const idServidor = 999999;

  // Estado exatamente como descrito no bug: um INSERT (linha base) seguido
  // de um UPDATE (pontos extras) para a MESMA linha, ambos ainda na fila.
  const insertOp = opFila('fila-1', 'pontuacoes', { id: idLocal, clube_id: 7, dbv_id: 42, data: '2026-09-13', pontos_extras: 30 });
  const updateOp = opFila('fila-2', 'pontuacoes', { id: idLocal, clube_id: 7, pontos_extras: 80 });
  const fila = [insertOp, updateOp];

  const alteradas = propagarIdReconciliado(fila, insertOp.id, 'pontuacoes', idLocal, idServidor);

  assert.equal(alteradas.length, 1);
  assert.equal(alteradas[0].id, 'fila-2');
  assert.equal(parse(updateOp).id, idServidor, 'o UPDATE em memória deve passar a usar o id real do servidor');
  assert.equal(parse(insertOp).id, idLocal, 'a própria operação de INSERT que originou a reconciliação não é alterada');
});

test('idempotência: rodar a propagação de novo não muda nada nem duplica', () => {
  const idLocal = 501;
  const idServidor = 999999;
  const insertOp = opFila('fila-1', 'pontuacoes', { id: idLocal, dbv_id: 42 });
  const updateOp = opFila('fila-2', 'pontuacoes', { id: idLocal, pontos_extras: 80 });
  const fila = [insertOp, updateOp];

  propagarIdReconciliado(fila, insertOp.id, 'pontuacoes', idLocal, idServidor);
  assert.equal(parse(updateOp).id, idServidor);

  // Reconciliação "roda de novo" (ex.: reprocessamento) com o mesmo idLocal.
  const segundaRodada = propagarIdReconciliado(fila, insertOp.id, 'pontuacoes', idLocal, idServidor);

  assert.equal(segundaRodada.length, 0, 'nada deveria mudar: o id já não é mais o idLocal antigo');
  assert.equal(parse(updateOp).id, idServidor, 'id permanece o do servidor, sem corromper');
});

test('várias operações pendentes (UPDATE e DELETE) para a mesma linha provisória são todas corrigidas', () => {
  const idLocal = 501;
  const idServidor = 999999;
  const insertOp = opFila('fila-1', 'pontuacoes', { id: idLocal, dbv_id: 42 });
  const updateOp1 = opFila('fila-2', 'pontuacoes', { id: idLocal, pontos_extras: 30 });
  const updateOp2 = opFila('fila-3', 'pontuacoes', { id: idLocal, pontos_extras: 80 });
  const deleteOp = opFila('fila-4', 'pontuacoes', { id: idLocal });
  const fila = [insertOp, updateOp1, updateOp2, deleteOp];

  const alteradas = propagarIdReconciliado(fila, insertOp.id, 'pontuacoes', idLocal, idServidor);

  assert.equal(alteradas.length, 3);
  for (const op of [updateOp1, updateOp2, deleteOp]) {
    assert.equal(parse(op).id, idServidor);
  }
});

test('isolamento: não mexe em operações de outra tabela', () => {
  const idLocal = 501;
  const idServidor = 999999;
  const insertOp = opFila('fila-1', 'pontuacoes', { id: idLocal });
  const outraTabela = opFila('fila-2', 'pontuacoes_custom', { id: idLocal, pontos: 10 });
  const fila = [insertOp, outraTabela];

  const alteradas = propagarIdReconciliado(fila, insertOp.id, 'pontuacoes', idLocal, idServidor);

  assert.equal(alteradas.length, 0);
  assert.equal(parse(outraTabela).id, idLocal, 'operação de outra tabela não deve ser tocada');
});

test('isolamento: não mexe em operações com id local diferente', () => {
  const idLocal = 501;
  const outroIdLocal = 777;
  const idServidor = 999999;
  const insertOp = opFila('fila-1', 'pontuacoes', { id: idLocal });
  const outraLinha = opFila('fila-2', 'pontuacoes', { id: outroIdLocal, pontos_extras: 15 });
  const fila = [insertOp, outraLinha];

  const alteradas = propagarIdReconciliado(fila, insertOp.id, 'pontuacoes', idLocal, idServidor);

  assert.equal(alteradas.length, 0);
  assert.equal(parse(outraLinha).id, outroIdLocal, 'linha de outro dbv_id/data não deve ser tocada');
});

test('isolamento: só troca o campo "id", preserva os demais campos do payload', () => {
  const idLocal = 501;
  const idServidor = 999999;
  const insertOp = opFila('fila-1', 'pontuacoes', { id: idLocal });
  const updateOp = opFila('fila-2', 'pontuacoes', { id: idLocal, clube_id: 7, pontos_extras: 80, observacao: null });
  const fila = [insertOp, updateOp];

  propagarIdReconciliado(fila, insertOp.id, 'pontuacoes', idLocal, idServidor);

  const dados = parse(updateOp);
  assert.equal(dados.id, idServidor);
  assert.equal(dados.clube_id, 7);
  assert.equal(dados.pontos_extras, 80);
  assert.equal(dados.observacao, null);
});

test('reinício do app: uma operação persistida (id já corrigido) é processada com o id definitivo', () => {
  // Simula: o INSERT sincronizou e reconciliou antes do app fechar (a
  // gravação em fila_sync já reflete o id novo, como o código faz via
  // "UPDATE fila_sync SET dados = ? WHERE id = ?"). Na próxima abertura, a
  // fila é lida do zero do SQLite — só precisa continuar consistente.
  const idServidor = 999999;
  const filaRestauradaDoDisco = [
    opFila('fila-2', 'pontuacoes', { id: idServidor, pontos_extras: 80 }),
  ];

  // Reprocessar não deveria encontrar nada para propagar (não há mais
  // nenhuma operação com o id local antigo — ela já foi persistida corrigida).
  const alteradas = propagarIdReconciliado(filaRestauradaDoDisco, 'inexistente', 'pontuacoes', 501, idServidor);
  assert.equal(alteradas.length, 0);
  assert.equal(parse(filaRestauradaDoDisco[0]).id, idServidor);
});

test('deveManterUpdatePendente: mantém pendente só para tabelas de id gerado no servidor quando não encontrado', () => {
  const tabelas = new Set(['pontuacoes', 'pontuacoes_extras_itens']);

  assert.equal(deveManterUpdatePendente('pontuacoes', false, tabelas), true, 'não achou + tabela sensível => mantém pendente');
  assert.equal(deveManterUpdatePendente('pontuacoes', true, tabelas), false, 'achou a linha => segue fluxo normal de diff/update');
  assert.equal(deveManterUpdatePendente('config_pontuacao', false, tabelas), false, 'tabela fora da lista => comportamento antigo (upsert)');
});

test('fechamento entre reconciliação e atualização da fila: chave segura recupera o id definitivo', async () => {
  // Simula exatamente o cenário pedido: a linha local já foi corrigida (a
  // reconciliação gravou o mapeamento durável), mas o app fechou antes de
  // corrigir esta operação específica na fila — ela ainda carrega o id antigo.
  const tabelas = new Set(['pontuacoes']);
  const db = bancoFake([{ tabela: 'pontuacoes', id_antigo: 501, id_novo: 999999 }]);

  const idResolvido = await resolverIdViaMapeamento(db, 'pontuacoes', 501, tabelas);
  assert.equal(idResolvido, 999999);
});

test('reinicialização: sem mapeamento salvo, não inventa id (continua pendente com segurança)', async () => {
  const tabelas = new Set(['pontuacoes']);
  const db = bancoFake([]); // memória vazia: nunca houve reconciliação registrada

  const idResolvido = await resolverIdViaMapeamento(db, 'pontuacoes', 501, tabelas);
  assert.equal(idResolvido, null);
});

test('resolverIdViaMapeamento só se aplica a tabelas de id gerado no servidor', async () => {
  const tabelas = new Set(['pontuacoes']);
  const db = bancoFake([{ tabela: 'config_pontuacao', id_antigo: 1, id_novo: 2 }]);

  // "config_pontuacao" não está no conjunto de tabelas sensíveis: nem chega
  // a consultar (por construção, resolverIdViaMapeamento curto-circuita).
  const idResolvido = await resolverIdViaMapeamento(db, 'config_pontuacao', 1, tabelas);
  assert.equal(idResolvido, null);
});

test('recuperação de id por chave natural: só recupera com violação de unicidade e payload completo', () => {
  const chaves = { pontuacoes: ['dbv_id', 'data'] };

  assert.deepEqual(
    chaveNaturalParaRecuperar('pontuacoes', '23505', { dbv_id: 42, data: '2026-09-13' }, chaves),
    ['dbv_id', 'data'],
    'violação de unicidade + payload completo => recupera'
  );
});

test('recuperação por chave natural: não recupera sem violação de unicidade (evita duplicar em erro genérico)', () => {
  const chaves = { pontuacoes: ['dbv_id', 'data'] };
  assert.equal(
    chaveNaturalParaRecuperar('pontuacoes', '23503', { dbv_id: 42, data: '2026-09-13' }, chaves),
    null,
    'erro diferente de 23505 não deve acionar recuperação — evita mascarar erros reais'
  );
});

test('recuperação por chave natural: não recupera com payload incompleto (nunca adivinha)', () => {
  const chaves = { pontuacoes: ['dbv_id', 'data'] };
  assert.equal(
    chaveNaturalParaRecuperar('pontuacoes', '23505', { dbv_id: 42 }, chaves), // falta "data"
    null
  );
});

test('recuperação por chave natural: tabela sem chave natural conhecida não recupera (comportamento antigo)', () => {
  const chaves = { pontuacoes: ['dbv_id', 'data'] };
  assert.equal(
    chaveNaturalParaRecuperar('pontuacoes_extras_itens', '23505', { dbv_id: 42, data: '2026-09-13' }, chaves),
    null,
    'sem UNIQUE conhecida nessa tabela, não tenta recuperar — evita duplicar/errar silenciosamente'
  );
});
