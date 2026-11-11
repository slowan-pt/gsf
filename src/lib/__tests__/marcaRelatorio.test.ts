/**
 * Testes do visual padrão dos relatórios em PDF (cabeçalho com os dois logos, fonte e tema da tabela).
 * Roda com "node --test" (ver "npm run test:marca-relatorio"). Com HTML_SAIDA=caminho.html grava um relatório de exemplo,
 * para imprimir em PDF e conferir o visual.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { injetarMarca, cssTemaRelatorio, TEMA_RELATORIO, FAMILIA_FONTE_RELATORIO, type MarcaClube } from '../marcaHtml.ts';
import { NUNITO_WOFF2_BASE64 } from '../fonteRelatorio.ts';

const FONTE = `@font-face{font-family:'Nunito';font-weight:200 1000;src:url(data:font/woff2;base64,${NUNITO_WOFF2_BASE64}) format('woff2');}`;
const MARCA: MarcaClube = { nome: 'Clube Fonseca & Cia', logo: 'data:image/png;base64,AAAA', logoDbv: 'data:image/png;base64,BBBB', fonteCss: FONTE };

const COM_TABELA = `<!doctype html><html><head><meta charset="utf-8"><style>th{background:#000}</style></head><body>
<h1>Título antigo</h1><div class="sub">Gerado em hoje · 2 membros</div>
<table><thead><tr><th>Nome</th><th>Unidade</th></tr></thead><tbody><tr><td>Ana</td><td>Leões</td></tr></tbody></table></body></html>`;

test('cabeçalho: logo do clube, nome, título e logo dos Desbravadores, repetidos no thead', () => {
  const h = injetarMarca(COM_TABELA, MARCA, 'Relatório de Faltas');
  assert.match(h, /<thead[^>]*><tr class="marca-linha"><th colspan="99">/);
  assert.ok(h.includes('data:image/png;base64,AAAA'), 'logo do clube');
  assert.ok(h.includes('data:image/png;base64,BBBB'), 'logo dos Desbravadores');
  assert.ok(h.indexOf('AAAA') < h.indexOf('Clube Fonseca') && h.indexOf('Clube Fonseca') < h.indexOf('BBBB'), 'clube à esquerda, Desbravadores à direita');
  assert.ok(h.includes('Clube Fonseca &amp; Cia'), 'nome escapado');
  assert.ok(h.includes('Relatório de Faltas'));
  assert.ok(!h.includes('Título antigo'), 'o <h1> antigo sai');
  assert.match(h, /<div class="marca-sub">Gerado em hoje · 2 membros<\/div>/);
  assert.ok(!/<div class="sub">/.test(h), 'a linha "sub" vai para dentro do cabeçalho');
});

test('tema: fonte Nunito embutida, cores padrão e impressão com cores', () => {
  const h = injetarMarca(COM_TABELA, MARCA, 'X');
  assert.ok(h.includes('@font-face{font-family:\'Nunito\''));
  assert.ok(h.includes(FAMILIA_FONTE_RELATORIO));
  assert.ok(h.includes(TEMA_RELATORIO.roxo) && h.includes(TEMA_RELATORIO.suave));
  assert.match(h, /print-color-adjust:exact !important/);
  // O tema vem depois do estilo do relatório (vence os empates) e dentro do <head>.
  assert.ok(h.indexOf('th{background:#000}') < h.indexOf('thead th{background:linear-gradient'));
  assert.ok(h.indexOf('</style></head>') > 0);
});

test('só com o logo do clube (sem o dos Desbravadores) continua funcionando', () => {
  const h = injetarMarca(COM_TABELA, { nome: 'Clube', logo: 'data:image/png;base64,AAAA' }, 'X');
  assert.ok(h.includes('AAAA'));
  assert.ok(!h.includes('BBBB'));
  assert.match(h, /<div class="rel-logo"><\/div>/);
});

test('sem logo nenhum, só o nome do clube e o título', () => {
  const h = injetarMarca(COM_TABELA, { nome: 'Clube', logo: null }, 'Título novo');
  assert.ok(!h.includes('<img'));
  assert.ok(h.includes('Clube') && h.includes('Título novo'));
});

test('sem tabela, o cabeçalho entra no começo do corpo', () => {
  const h = injetarMarca('<html><head></head><body><p>Olá</p></body></html>', MARCA, 'Resumo');
  assert.ok(h.indexOf('rel-topo') < h.indexOf('<p>Olá</p>'));
  assert.match(h, /<body[^>]*><div class="rel-topo">/);
});

test('HTML sem <head>: o tema vem antes do conteúdo', () => {
  const h = injetarMarca('<table><thead><tr><th>A</th></tr></thead></table>', MARCA, 'T');
  assert.ok(h.startsWith('<style>'));
  assert.ok(h.includes('marca-linha'));
});

test('a fonte embutida é um woff2 de verdade', () => {
  const b = Buffer.from(NUNITO_WOFF2_BASE64, 'base64');
  assert.equal(b.subarray(0, 4).toString('latin1'), 'wOF2');
  assert.ok(b.length > 20000 && b.length < 80000);
  assert.ok(cssTemaRelatorio('').length > 500);
});

test('exemplo para conferir no navegador (só com HTML_SAIDA)', { skip: !process.env.HTML_SAIDA }, () => {
  const logoDbv = `data:image/png;base64,${readFileSync(fileURLToPath(new URL('../../../assets/logo-desbravadores.png', import.meta.url))).toString('base64')}`;
  const linhas = Array.from({ length: 34 }, (_, k) => `<tr><td>${k + 1}</td><td>Membro de exemplo número ${k + 1} da Silva</td><td>${['Leões', 'Águia Dourada', 'Tigres'][k % 3]}</td><td>${['Desbravador', 'Conselheiro', 'Instrutor'][k % 3]}</td><td>${(k * 7) % 100}%</td></tr>`).join('');
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
    @page { margin: 18px; size: A4 portrait; }
    body { font-family: Arial, sans-serif; color: #1f1b33; }
    h1 { margin: 0; color: #4b2bb0; font-size: 22px; }
    .sub { margin: 6px 0 16px; color: #667; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #4b2bb0; color: white; text-align: left; padding: 6px 5px; }
    td { border: 1px solid #d8dee6; padding: 5px; vertical-align: top; }
    tr:nth-child(even) td { background: #f5f8fb; }
  </style></head><body>
    <h1>Relatório de Presentes</h1><div class="sub">Últimos 2 meses · Gerado em 11/11/2026 · 34 membro(s)</div>
    <table><thead><tr><th>#</th><th>Nome</th><th>Unidade</th><th>Cargo</th><th>Presença</th></tr></thead><tbody>${linhas}</tbody></table>
  </body></html>`;
  const logoClube = `data:image/png;base64,${readFileSync(process.env.LOGO_CLUBE ?? fileURLToPath(new URL('../../../assets/icon-ios.png', import.meta.url))).toString('base64')}`;
  writeFileSync(process.env.HTML_SAIDA!, injetarMarca(html, { nome: 'Clube Fonseca', logo: logoClube, logoDbv, fonteCss: FONTE }, 'Relatório de Presentes — Últimos 2 meses'));
});
