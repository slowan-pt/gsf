/**
 * Testes das regras puras do módulo Patrimônio. Roda com "node --test" (ver "npm run test:patrimonio").
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FORM_PATRIMONIO_VAZIO, FILTROS_VAZIOS, lerMoeda, valorUnitario, dataBrParaIso, dataIsoParaBr, mascararData,
  validarForm, formParaPayload, itemParaForm, filtrarItens, totaisPatrimonio, opcoesDistintas,
  type ItemPatrimonio,
} from '../patrimonioNucleo.ts';

const item = (o: Partial<ItemPatrimonio>): ItemPatrimonio => ({
  id: 1, clube_id: 1, codigo: 1, status: 'pendente', descricao: 'Barraca', departamento: 'Camping', serie: 'AB-1',
  quantidade: 1, tipo: null, marca: null, modelo: null, condicao: null, fixada_parede: false, segurar: false,
  data_aquisicao: null, valor_aquisicao: 0, valor_mercado: 0, data_baixa: null, motivo_baixa: null, foto_url: null,
  aprovado_em: null, ...o,
});

test('lerMoeda entende o formato brasileiro e rejeita lixo', () => {
  assert.equal(lerMoeda('1.234,56'), 1234.56);
  assert.equal(lerMoeda('1234,5'), 1234.5);
  assert.equal(lerMoeda('R$ 10'), 10);
  assert.equal(lerMoeda('1234.56'), 1234.56);
  assert.equal(lerMoeda(''), 0);
  assert.equal(lerMoeda('abc'), null);
  assert.equal(lerMoeda('-5'), null);
  assert.equal(lerMoeda('1,234,56'), null);
});

test('valor unitário é o valor de mercado dividido pela quantidade', () => {
  assert.equal(valorUnitario(300, 3), 100);
  assert.equal(valorUnitario(100, 3), 33.33);
  assert.equal(valorUnitario(100, 0), 0);
  assert.equal(valorUnitario(NaN, 2), 0);
});

test('datas: conversão, máscara e validação de dia/mês', () => {
  assert.equal(dataBrParaIso('05/03/2024'), '2024-03-05');
  assert.equal(dataBrParaIso('31/02/2024'), null);
  assert.equal(dataBrParaIso('5/3/2024'), null);
  assert.equal(dataIsoParaBr('2024-03-05'), '05/03/2024');
  assert.equal(dataIsoParaBr(null), '');
  assert.equal(mascararData('05032024'), '05/03/2024');
  assert.equal(mascararData('0503'), '05/03');
});

test('validação do formulário', () => {
  assert.ok(validarForm(FORM_PATRIMONIO_VAZIO).descricao);
  const ok = { ...FORM_PATRIMONIO_VAZIO, descricao: 'Tenda 6 pessoas' };
  assert.deepEqual(validarForm(ok), {});
  assert.ok(validarForm({ ...ok, quantidade: '0' }).quantidade);
  assert.ok(validarForm({ ...ok, quantidade: '1,5' }).quantidade);
  assert.ok(validarForm({ ...ok, valor_mercado: 'xx' }).valor_mercado);
  assert.ok(validarForm({ ...ok, data_aquisicao: '99/99/2020' }).data_aquisicao);
  assert.ok(validarForm({ ...ok, data_aquisicao: '01/01/2999' }, new Date('2026-11-01')).data_aquisicao);
  assert.equal(validarForm({ ...ok, data_aquisicao: '01/01/2020' }).data_aquisicao, undefined);
});

test('formulário vira payload e volta sem perder dados', () => {
  const f = { ...FORM_PATRIMONIO_VAZIO, descricao: ' Caixa de som ', quantidade: '2', departamento: 'Música', valor_mercado: '1.500,50', data_aquisicao: '10/02/2023', condicao: 'bom' as const, segurar: true };
  const p = formParaPayload(f);
  assert.equal(p.descricao, 'Caixa de som');
  assert.equal(p.valor_mercado, 1500.5);
  assert.equal(p.data_aquisicao, '2023-02-10');
  assert.equal(p.serie, null);
  assert.equal(p.segurar, true);
  const volta = itemParaForm(item({ ...p, id: 9, codigo: 9, status: 'aprovado', condicao: 'bom' }));
  assert.equal(volta.valor_mercado, '1500,5');
  assert.equal(volta.data_aquisicao, '10/02/2023');
  assert.equal(volta.quantidade, '2');
});

test('filtros da lista combinam e ignoram acento e caixa', () => {
  const itens = [
    item({ id: 1, codigo: 1, descricao: 'Barraca Iglu', departamento: 'Camping', serie: 'AB-1' }),
    item({ id: 2, codigo: 2, descricao: 'Violão', departamento: 'Música', serie: 'V-22', status: 'aprovado' }),
    item({ id: 3, codigo: 12, descricao: 'Caixa de som', departamento: 'Música', serie: null, status: 'baixado' }),
  ];
  assert.equal(filtrarItens(itens, FILTROS_VAZIOS).length, 3);
  assert.deepEqual(filtrarItens(itens, { ...FILTROS_VAZIOS, codigo: '2' }).map((i) => i.id), [2]);
  assert.deepEqual(filtrarItens(itens, { ...FILTROS_VAZIOS, descricao: 'VIOLAO' }).map((i) => i.id), [2]);
  assert.deepEqual(filtrarItens(itens, { ...FILTROS_VAZIOS, departamento: 'musica' }).map((i) => i.id), [2, 3]);
  assert.deepEqual(filtrarItens(itens, { ...FILTROS_VAZIOS, departamento: 'Música', status: 'aprovado' }).map((i) => i.id), [2]);
  assert.deepEqual(filtrarItens(itens, { ...FILTROS_VAZIOS, serie: 'ab' }).map((i) => i.id), [1]);
});

test('totais ignoram itens baixados', () => {
  const t = totaisPatrimonio([
    item({ quantidade: 2, valor_mercado: 100 }),
    item({ quantidade: 5, valor_mercado: 50.5, status: 'aprovado' }),
    item({ quantidade: 9, valor_mercado: 999, status: 'baixado' }),
  ]);
  assert.deepEqual(t, { quantidadeItens: 2, quantidadePecas: 7, valorMercado: 150.5 });
});

test('opções distintas juntam o que já existe com as sugestões, sem repetir', () => {
  assert.deepEqual(opcoesDistintas(['Música', 'musica', null, 'Cozinha'], ['Música', 'Camping']), ['Camping', 'Cozinha', 'Música']);
});
