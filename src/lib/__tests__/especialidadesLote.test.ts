/**
 * Testes da regra do lote de especialidades. Roda com "node --test" (ver "npm run test:especialidades-lote").
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { chaveEspecialidade, planejarLote, quemJaTem } from '../especialidadesLoteNucleo.ts';

const tem = (...pares: Array<[number, string[]]>) =>
  new Map(pares.map(([id, nomes]) => [id, new Set(nomes.map(chaveEspecialidade))]));

test('membros X e Y, especialidades J e H, Y já tem H: grava 3 e ignora 1', () => {
  const plano = planejarLote([1, 2], ['J', 'H'], tem([2, ['H']]));
  assert.equal(plano.gravar.length, 3);
  assert.deepEqual(plano.ignorar, [{ membroId: 2, especialidade: 'H' }]);
  assert.ok(!plano.gravar.some((p) => p.membroId === 2 && p.especialidade === 'H'));
});

test('ninguém tem nada: grava todas as combinações', () => {
  const plano = planejarLote([1, 2, 3], ['A', 'B'], tem());
  assert.equal(plano.gravar.length, 6);
  assert.equal(plano.ignorar.length, 0);
});

test('todos já têm: não grava nada', () => {
  const plano = planejarLote([1, 2], ['A'], tem([1, ['A']], [2, ['A']]));
  assert.equal(plano.gravar.length, 0);
  assert.equal(plano.ignorar.length, 2);
});

test('compara sem acento, maiúscula e espaços duplos', () => {
  const plano = planejarLote([1], ['Excursionismo  Pedestre'], tem([1, ['excursionismo pedestre']]));
  assert.equal(plano.gravar.length, 0);
  const acento = planejarLote([1], ['Fotografia'], tem([1, ['FOTOGRAFÍA']]));
  assert.equal(acento.ignorar.length, 1);
});

test('a mesma especialidade escolhida duas vezes não conta em dobro', () => {
  const plano = planejarLote([1], ['Nós', 'nos'], tem());
  assert.equal(plano.gravar.length, 1);
});

test('quemJaTem lista só os membros escolhidos que a possuem', () => {
  const mapa = tem([1, ['H']], [2, ['J']], [3, ['H']]);
  assert.deepEqual(quemJaTem([1, 2], 'H', mapa), [1]);
  assert.deepEqual(quemJaTem([4], 'H', mapa), []);
});
