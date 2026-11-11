/**
 * Testes das regras puras do módulo Patrimônio. Roda com "node --test" (ver "npm run test:patrimonio").
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FORM_PATRIMONIO_VAZIO, FILTROS_VAZIOS, lerMoeda, mascararMoeda, completarMoeda, numeroParaMoeda, valorUnitario, dataBrParaIso, dataIsoParaBr, mascararData,
  validarForm, formParaPayload, itemParaForm, filtrarItens, totaisPatrimonio, opcoesDistintas,
  itensDoRelatorio, linhasPlanilhaPatrimonio, resumoPorDepartamento, CABECALHO_PLANILHA_PATRIMONIO,
  type ItemPatrimonio,
} from '../patrimonioNucleo.ts';

const item = (o: Partial<ItemPatrimonio>): ItemPatrimonio => ({
  id: 1, clube_id: 1, codigo: 1, status: 'ativo', descricao: 'Barraca', departamento: 'Camping', serie: 'AB-1',
  quantidade: 1, tipo: null, marca: null, modelo: null, condicao: null, fixada_parede: false, local_fixacao: null, segurar: false,
  data_aquisicao: null, valor_aquisicao: 0, valor_mercado: 0, data_baixa: null, motivo_baixa: null, foto_url: null, ...o,
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
  // O que a máscara do formulário escreve: milhar com ponto.
  assert.equal(lerMoeda('1.234'), 1234);
  assert.equal(lerMoeda('12.345.678'), 12345678);
  assert.equal(lerMoeda('12.5'), 12.5);
  assert.equal(lerMoeda('12.50'), 12.5);
});

test('máscara de valor: milhar com ponto, centavos com vírgula; aceita ponto ou vírgula para os centavos', () => {
  // Digitando um caractere de cada vez.
  const digita = (texto: string) => [...texto].reduce((atual, c) => mascararMoeda(atual + c, atual), '');
  assert.equal(digita('1234'), '1.234');
  assert.equal(digita('1234567'), '1.234.567');
  assert.equal(digita('12,5'), '12,5');
  assert.equal(digita('12.5'), '12,5');
  assert.equal(digita('12,50'), '12,50');
  assert.equal(digita('12.50'), '12,50');
  assert.equal(digita('1234,56'), '1.234,56');
  assert.equal(digita('1234.56'), '1.234,56');
  assert.equal(digita('0,5'), '0,5');
  assert.equal(digita(',5'), '0,5');
  assert.equal(digita('12,345'), '12,34');
  assert.equal(digita('007'), '7');
  assert.equal(digita('abc'), '');
  // Já com milhar na tela, o ponto digitado depois começa os centavos.
  assert.equal(mascararMoeda('1.234.', '1.234'), '1.234,');
  // Colar texto pronto.
  assert.equal(mascararMoeda('1.234,56'), '1.234,56');
  assert.equal(mascararMoeda('R$ 1234.5'), '1.234,5');
  assert.equal(mascararMoeda('1.234'), '1.234');
  // Apagar: o ponto de milhar não vira centavos.
  assert.equal(mascararMoeda('1.23', '1.234'), '123');
  assert.equal(mascararMoeda('12,5', '12,50'), '12,5');
  assert.equal(mascararMoeda('', '1'), '');
});

test('valor completo em reais: sempre com ,centavos', () => {
  assert.equal(completarMoeda('12'), '12,00');
  assert.equal(completarMoeda('12,5'), '12,50');
  assert.equal(completarMoeda('12.5'), '12,50');
  assert.equal(completarMoeda('1.234'), '1.234,00');
  assert.equal(completarMoeda('1234,56'), '1.234,56');
  assert.equal(completarMoeda('12,'), '12,00');
  assert.equal(completarMoeda(',5'), '0,50');
  assert.equal(completarMoeda(''), '');
  assert.equal(lerMoeda(completarMoeda('1.234')), 1234);
  assert.equal(numeroParaMoeda(1500.5), '1.500,50');
  assert.equal(numeroParaMoeda(7), '7,00');
  assert.equal(numeroParaMoeda(1234567.891), '1.234.567,89');
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
  assert.ok(validarForm({ ...ok, fixada_parede: true, local_fixacao: 'x'.repeat(121) }).local_fixacao);
  assert.equal(validarForm({ ...ok, fixada_parede: true, local_fixacao: 'Sala 2, 1º andar' }).local_fixacao, undefined);
});

test('formulário vira payload e volta sem perder dados', () => {
  const f = { ...FORM_PATRIMONIO_VAZIO, descricao: ' Caixa de som ', quantidade: '2', departamento: 'Música', valor_mercado: '1.500,50', data_aquisicao: '10/02/2023', condicao: 'bom' as const, segurar: true, fixada_parede: true, local_fixacao: ' Sala da diretoria, 2º andar ' };
  const p = formParaPayload(f);
  assert.equal(p.descricao, 'Caixa de som');
  assert.equal(p.valor_mercado, 1500.5);
  assert.equal(p.data_aquisicao, '2023-02-10');
  assert.equal(p.serie, null);
  assert.equal(p.segurar, true);
  assert.equal(p.local_fixacao, 'Sala da diretoria, 2º andar');
  // O local só vale com o item fixado na parede.
  assert.equal(formParaPayload({ ...f, fixada_parede: false }).local_fixacao, null);
  const volta = itemParaForm(item({ ...p, id: 9, codigo: 9, status: 'ativo', condicao: 'bom' }));
  assert.equal(volta.valor_mercado, '1.500,50');
  assert.equal(volta.local_fixacao, 'Sala da diretoria, 2º andar');
  assert.equal(volta.data_aquisicao, '10/02/2023');
  assert.equal(volta.quantidade, '2');
});

test('filtros da lista combinam e ignoram acento e caixa', () => {
  const itens = [
    item({ id: 1, codigo: 1, descricao: 'Barraca Iglu', departamento: 'Camping', serie: 'AB-1' }),
    item({ id: 2, codigo: 2, descricao: 'Violão', departamento: 'Música', serie: 'V-22' }),
    item({ id: 3, codigo: 12, descricao: 'Caixa de som', departamento: 'Música', serie: null, status: 'baixado' }),
  ];
  assert.equal(filtrarItens(itens, FILTROS_VAZIOS).length, 3);
  assert.deepEqual(filtrarItens(itens, { ...FILTROS_VAZIOS, codigo: '2' }).map((i) => i.id), [2]);
  assert.deepEqual(filtrarItens(itens, { ...FILTROS_VAZIOS, descricao: 'VIOLAO' }).map((i) => i.id), [2]);
  assert.deepEqual(filtrarItens(itens, { ...FILTROS_VAZIOS, departamento: 'musica' }).map((i) => i.id), [2, 3]);
  assert.deepEqual(filtrarItens(itens, { ...FILTROS_VAZIOS, departamento: 'Música', status: 'ativo' }).map((i) => i.id), [2]);
  assert.deepEqual(filtrarItens(itens, { ...FILTROS_VAZIOS, status: 'baixado' }).map((i) => i.id), [3]);
  assert.deepEqual(filtrarItens(itens, { ...FILTROS_VAZIOS, serie: 'ab' }).map((i) => i.id), [1]);
});

test('totais ignoram itens baixados', () => {
  const t = totaisPatrimonio([
    item({ quantidade: 2, valor_mercado: 100 }),
    item({ quantidade: 5, valor_mercado: 50.5 }),
    item({ quantidade: 9, valor_mercado: 999, status: 'baixado' }),
  ]);
  assert.deepEqual(t, { quantidadeItens: 2, quantidadePecas: 7, valorMercado: 150.5 });
});

test('itens do relatório: ativos, baixados ou todos, com departamento opcional', () => {
  const itens = [
    item({ id: 1, codigo: 1, departamento: 'Camping' }),
    item({ id: 2, codigo: 2, departamento: 'Música' }),
    item({ id: 3, codigo: 3, departamento: 'Música', status: 'baixado' }),
  ];
  assert.deepEqual(itensDoRelatorio(itens, 'ativos').map((i) => i.id), [1, 2]);
  assert.deepEqual(itensDoRelatorio(itens, 'baixados').map((i) => i.id), [3]);
  assert.deepEqual(itensDoRelatorio(itens, 'todos').map((i) => i.id), [1, 2, 3]);
  assert.deepEqual(itensDoRelatorio(itens, 'ativos', 'musica').map((i) => i.id), [2]);
});

test('planilha: uma coluna para cada campo, em ordem de código, com números como número', () => {
  const linhas = linhasPlanilhaPatrimonio([
    item({ id: 2, codigo: 2, descricao: 'B' }),
    item({ id: 1, codigo: 1, descricao: 'Caixa de som', departamento: 'Música', quantidade: 2, valor_aquisicao: 500, valor_mercado: 300, condicao: 'bom', segurar: true, fixada_parede: true, local_fixacao: 'Sala 3, 1º andar', data_aquisicao: '2023-02-10', foto_url: 'https://x/f.jpg' }),
  ]);
  assert.equal(linhas.length, 2);
  assert.equal(linhas[0].length, CABECALHO_PLANILHA_PATRIMONIO.length);
  const [cod, st, desc, dep, , , , , qtd, cond, parede, local, seg, data, vAq, vMe, vUn, , , foto] = linhas[0];
  assert.deepEqual([cod, st, desc, dep, qtd, cond, parede, local, seg, data, vAq, vMe, vUn, foto], [1, 'Ativo', 'Caixa de som', 'Música', 2, 'Bom', 'Sim', 'Sala 3, 1º andar', 'Sim', '10/02/2023', 500, 300, 150, 'https://x/f.jpg']);
  assert.equal(linhas[1][0], 2);
});

test('resumo por departamento ignora baixados e agrupa sem acento', () => {
  const r = resumoPorDepartamento([
    item({ departamento: 'Música', quantidade: 2, valor_mercado: 100 }),
    item({ departamento: 'musica', quantidade: 1, valor_mercado: 50.5 }),
    item({ departamento: null, quantidade: 3, valor_mercado: 10 }),
    item({ departamento: 'Música', quantidade: 9, valor_mercado: 999, status: 'baixado' }),
  ]);
  assert.deepEqual(r, [
    { departamento: 'Música', itens: 2, pecas: 3, valorMercado: 150.5 },
    { departamento: 'Sem departamento', itens: 1, pecas: 3, valorMercado: 10 },
  ]);
});

test('opções distintas juntam o que já existe com as sugestões, sem repetir', () => {
  assert.deepEqual(opcoesDistintas(['Música', 'musica', null, 'Cozinha'], ['Música', 'Camping']), ['Camping', 'Cozinha', 'Música']);
});
