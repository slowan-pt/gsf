/**
 * Testes do ranking do relatório de pontuação. Roda com "node --test" (ver "npm run test:relatorio-pontuacao").
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIAS_VAZIAS, OPCOES_CAMPO, classificar, tituloPontuacao, valorNoCampo, type LinhaRelatorioPontuacao } from '../relatorioPontuacaoNucleo.ts';

const linha = (id: number, nome: string, total: number, bom: number, presenca = 0): LinhaRelatorioPontuacao => ({
  dbv_id: id, nome, unidade_nome: 'Águias', total, categorias: { ...CATEGORIAS_VAZIAS(), bom_biblia: bom, presenca },
});

const LINHAS = [
  linha(1, 'Ana', 120, 10),
  linha(2, 'Bruno', 300, 40),
  linha(3, 'Carla', 80, 40),
  linha(4, 'Davi', 500, 0),
  linha(5, 'Eva', 90, 25),
];

test('maior pontuação em Bom da Bíblia vem primeiro; empate divide a posição e desempata pelo total', () => {
  const r = classificar(LINHAS, 'bom_biblia');
  assert.deepEqual(r.map((l) => l.nome), ['Bruno', 'Carla', 'Eva', 'Ana', 'Davi']);
  assert.deepEqual(r.map((l) => l.posicao), [1, 1, 3, 4, 5]);
  assert.equal(r[0].valor, 40);
});

test('total geral ordena por total', () => {
  const r = classificar(LINHAS, 'total');
  assert.deepEqual(r.map((l) => l.nome), ['Davi', 'Bruno', 'Ana', 'Eva', 'Carla']);
  assert.equal(r[0].posicao, 1);
});

test('só quem pontuou tira os zerados', () => {
  const r = classificar(LINHAS, 'bom_biblia', true);
  assert.deepEqual(r.map((l) => l.nome), ['Bruno', 'Carla', 'Eva', 'Ana']);
});

test('sem categorias detalhadas o valor da categoria é zero e o total segue', () => {
  const l: LinhaRelatorioPontuacao = { dbv_id: 9, nome: 'Zé', unidade_nome: 'X', total: 7 };
  assert.equal(valorNoCampo(l, 'bom_biblia'), 0);
  assert.equal(valorNoCampo(l, 'total'), 7);
});

test('título e opções de campo', () => {
  assert.equal(tituloPontuacao('Ano atual', 'bom_biblia'), 'Relatório de Pontuação — Bom da Bíblia — Ano atual');
  assert.equal(tituloPontuacao('Ano atual', 'total'), 'Relatório de Pontuação — Ano atual');
  assert.equal(OPCOES_CAMPO[0].id, 'total');
  assert.ok(OPCOES_CAMPO.some((o) => o.id === 'bom_biblia' && o.nome === 'Bom da Bíblia'));
});

test('ordenação não altera a lista original', () => {
  const copia = LINHAS.map((l) => l.nome);
  classificar(LINHAS, 'bom_biblia');
  assert.deepEqual(LINHAS.map((l) => l.nome), copia);
});
