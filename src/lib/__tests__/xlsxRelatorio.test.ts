/**
 * Testes da planilha Excel padrão dos relatórios (faixa com os dois logos, resumo, tabela zebrada, formatos).
 * Roda com "node --test" (ver "npm run test:xlsx-relatorio"). Com XLSX_SAIDA=caminho.xlsx grava um exemplo para abrir no Excel.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { unzipSync, strFromU8 } from 'fflate';
import * as XLSX from 'xlsx';
import { gerarXlsxRelatorio, lerImagemPlanilha, letra, nomeArquivoRelatorioXlsx, type AbaRelatorio } from '../xlsxRelatorioNucleo.ts';

const ler = (b: Uint8Array) => XLSX.read(b, { type: 'array' });
const bytesArquivo = (rel: string) => new Uint8Array(readFileSync(fileURLToPath(new URL(rel, import.meta.url))));

const ABA: AbaRelatorio = {
  nome: 'Faltas',
  subtitulo: 'Últimos 2 meses',
  blocos: [
    { tipo: 'resumo', titulo: 'Resumo', pares: [['Membros', 3], ['Reuniões', 12], ['Valor', 1234.5]], formato: ['inteiro', 'inteiro', 'dinheiro'] },
    {
      tipo: 'tabela', titulo: 'Detalhe',
      colunas: [{ titulo: 'Membro' }, { titulo: 'Unidade' }, { titulo: 'Presenças', formato: 'inteiro' }, { titulo: 'Valor (R$)', formato: 'dinheiro' }, { titulo: 'Código', formato: 'centro' }],
      linhas: [['Ana Souza', 'Leões', 10, 12.5, 7], ['Bruno Lima', 'Águias', 8, 1500, 8], ['Cláudia & Cia <x>', 'Tigres', 1234, 0, 9]],
    },
  ],
};

test('letras de coluna', () => {
  assert.equal(letra(0), 'A');
  assert.equal(letra(27), 'AB');
});

test('abas, título, resumo e tabela com os valores certos', () => {
  const wb = ler(gerarXlsxRelatorio({ clube: 'Clube Fonseca', titulo: 'Relatório de Faltas', abas: [ABA], geradoEm: new Date(2026, 10, 11) }));
  assert.deepEqual(wb.SheetNames, ['Faltas']);
  const ws = wb.Sheets['Faltas'];
  assert.equal(ws.B1.v, 'CLUBE FONSECA');
  assert.equal(ws.B2.v, 'Relatório de Faltas');
  assert.equal(ws.B3.v, 'Últimos 2 meses · Gerado em 11/11/2026');
  assert.equal(ws.B6.v, 'Resumo');
  assert.equal(ws.B7.v, 'Membros');
  assert.equal(ws.C7.v, 3);
  assert.equal(ws.C9.v, 1234.5);
  // Tabela: título do bloco, cabeçalho e linhas.
  assert.equal(ws.B11.v, 'Detalhe');
  assert.equal(ws.B12.v, 'Membro');
  assert.equal(ws.F12.v, 'Código');
  assert.equal(ws.B13.v, 'Ana Souza');
  assert.equal(ws.D13.v, 10);
  assert.equal(ws.E14.v, 1500);
  assert.equal(ws.B15.v, 'Cláudia & Cia <x>');
  assert.equal(ws.D15.v, 1234);
});

test('formatos: reais com R$, milhar e centro; zebra nas linhas pares', () => {
  const arq = unzipSync(gerarXlsxRelatorio({ clube: 'C', titulo: 'T', abas: [ABA] }));
  const estilos = strFromU8(arq['xl/styles.xml']);
  assert.match(estilos, /formatCode="&quot;R\$&quot;\\ #,##0\.00"/);
  assert.match(estilos, /cellXfs count="24"/);
  const planilha = strFromU8(arq['xl/worksheets/sheet1.xml']);
  assert.match(planilha, /<c r="E13" s="15">/, 'dinheiro, linha clara');
  assert.match(planilha, /<c r="E14" s="16">/, 'dinheiro, linha zebrada');
  assert.match(planilha, /<c r="F13" s="11">/, 'centro, linha clara');
  assert.match(planilha, /<c r="D14" s="14">/, 'inteiro, linha zebrada');
  assert.match(planilha, /<autoFilter ref="B12:F15"\/>/);
  assert.match(planilha, /showGridLines="0"/);
});

test('com uma tabela só (e sem resumo), o cabeçalho fica congelado', () => {
  const so: AbaRelatorio = { nome: 'T', blocos: [{ tipo: 'tabela', colunas: [{ titulo: 'A' }, { titulo: 'B' }], linhas: [['x', 1], ['y', 2]] }] };
  const arq = unzipSync(gerarXlsxRelatorio({ clube: 'C', titulo: 'T', abas: [so] }));
  assert.match(strFromU8(arq['xl/worksheets/sheet1.xml']), /state="frozen"/);
  assert.match(strFromU8(arq['xl/workbook.xml']), /<definedName name="_xlnm\.Print_Titles" localSheetId="0">'T'!\$6:\$6<\/definedName>/);
  const comResumo = unzipSync(gerarXlsxRelatorio({ clube: 'C', titulo: 'T', abas: [ABA] }));
  assert.ok(!strFromU8(comResumo['xl/worksheets/sheet1.xml']).includes('state="frozen"'));
});

test('logos: os dois entram como imagens, com o aspecto original', () => {
  const clube = lerImagemPlanilha(bytesArquivo('../../../assets/favicon.png'));
  const dbv = lerImagemPlanilha(bytesArquivo('../../../assets/logo-desbravadores.png'));
  assert.ok(clube && dbv);
  const arq = unzipSync(gerarXlsxRelatorio({ clube: 'C', titulo: 'T', abas: [ABA], logoClube: clube, logoDbv: dbv }));
  assert.ok(arq['xl/media/logo-clube-1.png']);
  assert.ok(arq['xl/media/logo-dbv-1.png']);
  const d = strFromU8(arq['xl/drawings/drawing1.xml']);
  assert.equal((d.match(/<xdr:pic>/g) ?? []).length, 2);
  assert.match(strFromU8(arq['xl/drawings/_rels/drawing1.xml.rels']), /Id="rId1".*logo-clube-1\.png.*Id="rId2".*logo-dbv-1\.png/);
  assert.match(strFromU8(arq['xl/worksheets/_rels/sheet1.xml.rels']), /drawing1\.xml/);
  assert.match(strFromU8(arq['xl/worksheets/sheet1.xml']), /<drawing r:id="rId1"\/>/);
  const dims = [...d.matchAll(/<xdr:ext cx="(\d+)" cy="(\d+)"\/>/g)].map((m) => Number(m[1]) / Number(m[2]));
  assert.ok(Math.abs(dims[0] - clube!.largura / clube!.altura) < 0.02 && Math.abs(dims[1] - dbv!.largura / dbv!.altura) < 0.02);
});

test('só um logo (ou nenhum) também funciona', () => {
  const dbv = lerImagemPlanilha(bytesArquivo('../../../assets/logo-desbravadores.png'));
  const so = unzipSync(gerarXlsxRelatorio({ clube: 'C', titulo: 'T', abas: [ABA], logoDbv: dbv }));
  assert.match(strFromU8(so['xl/drawings/_rels/drawing1.xml.rels']), /Id="rId1".*logo-dbv-1\.png/);
  const nenhum = unzipSync(gerarXlsxRelatorio({ clube: 'C', titulo: 'T', abas: [ABA] }));
  assert.ok(!nenhum['xl/drawings/drawing1.xml']);
  assert.ok(!strFromU8(nenhum['xl/worksheets/sheet1.xml']).includes('<drawing'));
});

test('várias abas, nomes inválidos ou repetidos e texto com caracteres especiais', () => {
  const wb = ler(gerarXlsxRelatorio({
    clube: 'C', titulo: 'T',
    abas: [{ nome: 'Resumo/Geral?', blocos: [] }, { nome: 'Resumo Geral', blocos: [] }, { nome: 'x'.repeat(50), blocos: [{ tipo: 'tabela', colunas: [{ titulo: 'Texto' }], linhas: [['linha\u0001com controle'], ['"aspas" & <tags>']] }] }],
  }));
  assert.equal(wb.SheetNames.length, 3);
  assert.equal(new Set(wb.SheetNames.map((n) => n.toLowerCase())).size, 3);
  assert.ok(wb.SheetNames.every((n) => n.length <= 31 && !/[\\/?*[\]:]/.test(n)));
  assert.equal(wb.Sheets[wb.SheetNames[2]].B7.v, 'linhacom controle');
  assert.equal(wb.Sheets[wb.SheetNames[2]].B8.v, '"aspas" & <tags>');
});

test('sem abas ainda gera um arquivo válido', () => {
  assert.deepEqual(ler(gerarXlsxRelatorio({ clube: 'C', titulo: 'T', abas: [] })).SheetNames, ['Relatório']);
});

test('imagem que não é PNG nem JPEG é ignorada', () => {
  assert.equal(lerImagemPlanilha(new Uint8Array(40)), null);
});

test('nome do arquivo', () => {
  assert.equal(nomeArquivoRelatorioXlsx('Relatório de Faltas — Últimos 2 meses', new Date(2026, 10, 11)), 'Relatorio-de-Faltas-Ultimos-2-meses_2026-11-11');
});

test('exemplo para conferir no Excel (só com XLSX_SAIDA)', { skip: !process.env.XLSX_SAIDA }, () => {
  const membros = Array.from({ length: 28 }, (_, k) => [`Membro de exemplo ${k + 1} da Silva Pereira`, ['Leões', 'Águia Dourada', 'Tigres'][k % 3], 12 - (k % 9), k % 9, 12, `${Math.round(((12 - (k % 9)) / 12) * 100)}%`, k % 4 === 0 ? 'Jan/26 (2) · Mar/26 (1)' : '']);
  const wb = gerarXlsxRelatorio({
    clube: 'Clube Fonseca', titulo: 'Relatório de Faltas — Últimos 2 meses',
    logoClube: lerImagemPlanilha(bytesArquivo(process.env.LOGO_CLUBE ?? '../../../assets/favicon.png')),
    logoDbv: lerImagemPlanilha(bytesArquivo('../../../assets/logo-desbravadores.png')),
    abas: [
      { nome: 'Faltas', subtitulo: '28 membros', blocos: [{ tipo: 'tabela', colunas: [{ titulo: 'Membro', largura: 40 }, { titulo: 'Unidade', largura: 18 }, { titulo: 'Presenças', formato: 'inteiro' }, { titulo: 'Faltas', formato: 'inteiro' }, { titulo: 'Total de reuniões', formato: 'inteiro' }, { titulo: '% presença', formato: 'centro' }, { titulo: 'Meses com mais faltas', largura: 34 }], linhas: membros }] },
      ABA,
    ],
  });
  writeFileSync(process.env.XLSX_SAIDA!, wb);
});
