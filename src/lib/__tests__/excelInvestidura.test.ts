/**
 * Testes do Excel de investidura (matriz item × membro, preços do Bazar, logo, fórmulas).
 * Roda com "node --test" (ver "npm run test:excel-investidura"). Com XLSX_SAIDA=caminho.xlsx grava o arquivo de exemplo,
 * para abrir no Excel e conferir o visual.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { unzipSync, strFromU8 } from 'fflate';
import * as XLSX from 'xlsx';
import {
  montarPlanilha, gerarExcelInvestidura, lerImagem, letraColuna, nomeArquivoExcel, chaveNome, PRECOS_USADOS,
} from '../excelInvestituraNucleo.ts';
import type { ItemAguardando } from '../investidura.ts';

let seq = 1;
const item = (o: Partial<ItemAguardando> & Pick<ItemAguardando, 'dbvId' | 'membroNome' | 'nome' | 'tipo'>): ItemAguardando => ({
  id: seq++, unidadeNome: 'Leões', origem: null, aprovadoEm: null, ...o,
});

const ITENS: ItemAguardando[] = [
  item({ dbvId: 2, membroNome: 'Bruno Lima', nome: 'Nós e Cordas', tipo: 'especialidade', unidadeNome: 'Águia Dourada' }),
  item({ dbvId: 1, membroNome: 'Ana Souza', nome: 'Nós e Cordas', tipo: 'especialidade' }),
  item({ dbvId: 1, membroNome: 'Ana Souza', nome: 'Acampamento I', tipo: 'especialidade' }),
  item({ dbvId: 2, membroNome: 'Bruno Lima', nome: 'MESTRADO Ensinos Bíblicos', tipo: 'mestrado', unidadeNome: 'Águia Dourada' }),
  item({ dbvId: 1, membroNome: 'Ana Souza', nome: 'Guia', tipo: 'classe' }),
  item({ dbvId: 2, membroNome: 'Bruno Lima', nome: 'Amigo', tipo: 'classe', unidadeNome: 'Águia Dourada' }),
  item({ dbvId: 1, membroNome: 'Ana Souza', nome: 'Amigo da Natureza', tipo: 'classe' }),
];
const CODIGOS = { [chaveNome('Nós e Cordas')]: 'ENB13', [chaveNome('Acampamento I')]: 'AR050' };

// PNG 1x1 válido.
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
const PNG_LOGO = fileURLToPath(new URL('../../../assets/fonseca-logo-cropped.png', import.meta.url));

const ler = (bytes: Uint8Array) => XLSX.read(bytes, { type: 'array', cellFormula: true });
const celula = (ws: XLSX.WorkSheet, ref: string) => ws[ref];

test('letras de coluna', () => {
  assert.equal(letraColuna(0), 'A');
  assert.equal(letraColuna(25), 'Z');
  assert.equal(letraColuna(26), 'AA');
  assert.equal(letraColuna(59), 'BH');
});

test('planilha: membros em ordem alfabética, seções na ordem do modelo e códigos nas especialidades', () => {
  const p = montarPlanilha(ITENS, CODIGOS);
  assert.deepEqual(p.membros.map((m) => m.nome), ['Ana Souza', 'Bruno Lima']);
  assert.deepEqual(p.grupos.map((g) => g.secao), ['especialidade', 'mestrado', 'classeRegular', 'classeAvancada']);
  assert.deepEqual(p.grupos[0].linhas.map((l) => l.nome), ['Acampamento I (AR050)', 'Nós e Cordas (ENB13)']);
  assert.deepEqual(p.grupos[0].linhas[1].marcas, [true, true]);
  assert.deepEqual(p.grupos[0].linhas[0].marcas, [true, false]);
  assert.deepEqual(p.grupos[2].linhas.map((l) => l.nome), ['Amigo', 'Guia']);
  assert.deepEqual(p.grupos[3].linhas.map((l) => l.nome), ['Amigo da Natureza']);
});

test('classes saem na ordem Amigo, Companheiro... e não em ordem alfabética', () => {
  const itens = ['Guia', 'Amigo', 'Pioneiro', 'Companheiro'].map((n, k) => item({ dbvId: k + 1, membroNome: `M${k}`, nome: n, tipo: 'classe' }));
  const nomes = montarPlanilha(itens).grupos[0].linhas.map((l) => l.nome);
  assert.deepEqual(nomes, ['Amigo', 'Companheiro', 'Pioneiro', 'Guia']);
});

test('excel: abas, valores, fórmulas e totais corretos', () => {
  const bytes = gerarExcelInvestidura(montarPlanilha(ITENS, CODIGOS), { clube: 'Fonseca', logo: null, subtitulo: 'Investidura · 2 membros · 7 itens', geradoEm: new Date(2026, 10, 11) });
  const wb = ler(bytes);
  assert.deepEqual(wb.SheetNames, ['Investidura', 'Valores']);
  const ws = wb.Sheets['Investidura'];
  assert.equal(celula(ws, 'B1').v, 'Fonseca');
  assert.equal(celula(ws, 'B5').v, 'Item');
  assert.equal(celula(ws, 'F5').v, 'Ana Souza');
  assert.equal(celula(ws, 'G5').v, 'Bruno Lima');
  assert.equal(celula(ws, 'G4').v, 'Águia Dourada');
  // Seção de especialidades: linha 6; itens nas linhas 7 e 8.
  assert.match(String(celula(ws, 'B6').v), /^ESPECIALIDADES \(2\)/);
  assert.equal(celula(ws, 'B7').v, 'Acampamento I (AR050)');
  assert.equal(celula(ws, 'F7').v, 'X');
  assert.equal(celula(ws, 'G7'), undefined);
  assert.equal(celula(ws, 'C7').f, 'Valores!$C$5');
  assert.equal(celula(ws, 'C7').v, 1.6);
  assert.equal(celula(ws, 'D7').f, 'COUNTIF(F7:G7,"X")');
  assert.equal(celula(ws, 'D7').v, 1);
  assert.equal(celula(ws, 'D8').v, 2);
  assert.equal(celula(ws, 'E8').f, 'C8*D8');
  assert.equal(celula(ws, 'E8').v, 3.2);
  // Total geral: 3 especialidades (4,80) + 1 mestrado (2,90) + 2 classes regulares (9,80) + 1 avançada (2,10) = 19,60.
  const rotulos = Object.keys(ws).filter((k) => /^B\d+$/.test(k) && ws[k].v === 'TOTAL GERAL');
  assert.equal(rotulos.length, 1);
  const linhaTotal = rotulos[0].slice(1);
  assert.equal(celula(ws, `D${linhaTotal}`).v, 7);
  assert.equal(celula(ws, `E${linhaTotal}`).v, 19.6);
  // Por membro: Ana tem Acampamento I, Nós e Cordas, Guia, Amigo da Natureza = 1,60+1,60+4,90+2,10 = 10,20; Bruno = 1,60+2,90+4,90 = 9,40.
  const linhaValor = Number(linhaTotal) + 2;
  assert.equal(celula(ws, `B${linhaValor}`).v, 'Valor por membro (R$)');
  assert.equal(celula(ws, `F${linhaValor}`).v, 10.2);
  assert.equal(celula(ws, `G${linhaValor}`).v, 9.4);
  assert.equal(celula(ws, `F${Number(linhaTotal) + 1}`).v, 4);
  assert.equal(celula(ws, `G${Number(linhaTotal) + 1}`).v, 3);
  assert.match(celula(ws, `F${linhaValor}`).f ?? '', /SUMPRODUCT/);

  const v = wb.Sheets['Valores'];
  assert.equal(celula(v, 'B5').v, 'Especialidade');
  assert.equal(celula(v, 'C5').v, 1.6);
  assert.equal(celula(v, 'C6').v, 2.9);
  assert.equal(celula(v, 'C7').v, 4.9);
  assert.equal(celula(v, 'C8').v, 2.1);
});

test('preços personalizados mudam os valores calculados', () => {
  const bytes = gerarExcelInvestidura(montarPlanilha(ITENS, CODIGOS), { clube: 'Fonseca', logo: null, subtitulo: '', precos: { especialidade: 2, classeAvancada: 6.5 } });
  const ws = ler(bytes).Sheets['Investidura'];
  assert.equal(celula(ws, 'C7').v, 2);
  const v = ler(bytes).Sheets['Valores'];
  assert.equal(celula(v, 'C5').v, 2);
  assert.equal(celula(v, 'C8').v, 6.5);
});

test('pacote: arquivos obrigatórios, painel congelado, impressão e recálculo ao abrir', () => {
  const arq = unzipSync(gerarExcelInvestidura(montarPlanilha(ITENS, CODIGOS), { clube: 'Fonseca', logo: null, subtitulo: '' }));
  for (const n of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']) assert.ok(arq[n], `falta ${n}`);
  const s1 = strFromU8(arq['xl/worksheets/sheet1.xml']);
  assert.match(s1, /state="frozen"/);
  assert.match(s1, /orientation="landscape"/);
  assert.ok(!s1.includes('<drawing'), 'sem logo não deve ter desenho');
  assert.match(strFromU8(arq['xl/workbook.xml']), /fullCalcOnLoad="1"/);
  // XML sem tags soltas: cada arquivo .xml tem o mesmo número de aberturas e fechamentos de <c>, <row> e <is>.
  for (const n of ['xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml', 'xl/styles.xml']) {
    const x = strFromU8(arq[n]);
    for (const t of ['row', 'is', 'xf', 'font']) {
      const abre = (x.match(new RegExp(`<${t}[ >]`, 'g')) ?? []).length;
      const fecha = (x.match(new RegExp(`</${t}>`, 'g')) ?? []).length + (x.match(new RegExp(`<${t}[^>]*/>`, 'g')) ?? []).length;
      assert.equal(abre, fecha, `${n}: <${t}> desbalanceado`);
    }
  }
});

test('logo do clube: entra como imagem ancorada no topo, com o aspecto original', () => {
  const logo = lerImagem(PNG);
  assert.ok(logo);
  assert.equal(logo!.ext, 'png');
  const real = lerImagem(new Uint8Array(readFileSync(PNG_LOGO)));
  assert.ok(real && real.largura > 10 && real.altura > 10);
  const arq = unzipSync(gerarExcelInvestidura(montarPlanilha(ITENS, CODIGOS), { clube: 'Fonseca', logo: real, subtitulo: '' }));
  assert.ok(arq['xl/media/logo.png']);
  assert.ok(arq['xl/drawings/drawing1.xml']);
  assert.ok(arq['xl/worksheets/_rels/sheet1.xml.rels']);
  assert.match(strFromU8(arq['xl/worksheets/sheet1.xml']), /<drawing r:id="rId1"\/>/);
  const d = strFromU8(arq['xl/drawings/drawing1.xml']);
  const cx = Number(/<xdr:ext cx="(\d+)" cy="(\d+)"/.exec(d)![1]), cy = Number(/<xdr:ext cx="(\d+)" cy="(\d+)"/.exec(d)![2]);
  assert.ok(Math.abs(cx / cy - real!.largura / real!.altura) < 0.02, 'a logo não pode ficar esticada');
  assert.ok(Math.max(cx, cy) <= 80 * 9525, 'a logo cabe nas três linhas do topo');
});

test('imagens que não são PNG nem JPEG não viram logo', () => {
  assert.equal(lerImagem(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25])), null);
});

test('nome do arquivo', () => {
  assert.equal(nomeArquivoExcel('Clube Fonseca', new Date(2026, 10, 11)), 'Investidura-Clube-Fonseca-2026-11-11');
});

test('preços de referência do Bazar', () => {
  assert.deepEqual(PRECOS_USADOS.map((p) => [p.chave, p.valor]), [['especialidade', 1.6], ['mestrado', 2.9], ['classeRegular', 4.9], ['classeAvancada', 2.1]]);
});

test('exemplo para conferir no Excel (só com XLSX_SAIDA)', { skip: !process.env.XLSX_SAIDA }, () => {
  const muitos: ItemAguardando[] = [];
  const nomes = ['Daniela Brito Pimentel', 'Isabelle da Silva Nascimento', 'Kallyne Bitiato Guimarães', 'Kauane Lima Pacheco', 'Laura Alves Pecly', 'Luisy Pedrosa Rodrigues Zago', 'Sloan Nascimento', 'Fernando do Espírito Santo de Medeiros'];
  const esp = ['Alerta Vermelho', 'Arbustos', 'Cultura física', 'Mordomia', 'Panificação', 'Produção de Pizza', 'Remédios da Natureza', 'Vida Familiar', 'Lives - Transmissão de Cultos Online'];
  nomes.forEach((m, k) => {
    esp.forEach((e, j) => { if ((k + j) % 3 !== 0) muitos.push(item({ dbvId: k + 1, membroNome: m, nome: e, tipo: 'especialidade', unidadeNome: k % 2 ? 'Águia Dourada' : 'Leões' })); });
    if (k % 3 === 0) muitos.push(item({ dbvId: k + 1, membroNome: m, nome: 'Companheiro', tipo: 'classe', unidadeNome: k % 2 ? 'Águia Dourada' : 'Leões' }));
    if (k % 4 === 0) muitos.push(item({ dbvId: k + 1, membroNome: m, nome: 'Pioneiro de Novas Fronteiras', tipo: 'classe', unidadeNome: k % 2 ? 'Águia Dourada' : 'Leões' }));
    if (k === 6) muitos.push(item({ dbvId: k + 1, membroNome: m, nome: 'MESTRADO Ensinos Bíblicos', tipo: 'mestrado', unidadeNome: 'Leões' }));
  });
  const logo = lerImagem(new Uint8Array(readFileSync(PNG_LOGO)));
  writeFileSync(process.env.XLSX_SAIDA!, gerarExcelInvestidura(montarPlanilha(muitos, { [chaveNome('Mordomia')]: 'AM015', [chaveNome('Panificação')]: 'HD007' }), {
    clube: 'Clube Fonseca', logo, subtitulo: `Investidura · ${nomes.length} membros · ${muitos.length} itens`,
  }));
});
