/**
 * Planilha Excel padrão dos relatórios: faixa no topo com o logo do clube, o nome do clube, o título e o logo dos Desbravadores,
 * seguida de blocos de resumo (rótulo e valor) e tabelas com cabeçalho roxo, linhas zebradas, bordas suaves, filtro e
 * valores em reais formatados. Mesmo visual dos PDFs (ver marcaHtml.ts). Cada aba é uma lista de blocos.
 *
 * Parte pura (sem React Native nem rede): monta o .xlsx à mão (XML + fflate), como o Excel da investidura.
 * Testada com "node --test" (ver "npm run test:xlsx-relatorio").
 */
import { strToU8, zipSync } from 'fflate';

export interface ImagemPlanilha { bytes: Uint8Array; ext: 'png' | 'jpeg'; largura: number; altura: number }

/** Lê o tipo e o tamanho de um PNG ou JPEG; null para outros formatos (a planilha sai sem esse logo). */
export function lerImagemPlanilha(bytes: Uint8Array): ImagemPlanilha | null {
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const largura = v.getUint32(16), altura = v.getUint32(20);
    return largura > 0 && altura > 0 ? { bytes, ext: 'png', largura, altura } : null;
  }
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let p = 2;
    while (p + 9 < bytes.length) {
      if (bytes[p] !== 0xff) { p++; continue; }
      const m = bytes[p + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        const altura = (bytes[p + 5] << 8) | bytes[p + 6], largura = (bytes[p + 7] << 8) | bytes[p + 8];
        return largura > 0 && altura > 0 ? { bytes, ext: 'jpeg', largura, altura } : null;
      }
      p += 2 + ((bytes[p + 2] << 8) | bytes[p + 3]);
    }
  }
  return null;
}

export type FormatoColuna = 'texto' | 'inteiro' | 'dinheiro' | 'decimal' | 'centro';
export type Valor = string | number | null | undefined;

export interface ColunaRelatorio {
  titulo: string;
  /** Largura em caracteres; sem ela, ajusta ao conteúdo. */
  largura?: number;
  /** "dinheiro" = R$ 1.234,50; "inteiro" = 1.234; "decimal" = 1.234,50; "centro" = texto centralizado. */
  formato?: FormatoColuna;
}

export type BlocoRelatorio =
  | { tipo: 'resumo'; titulo?: string; pares: [string, Valor][]; formato?: FormatoColuna[] }
  | { tipo: 'tabela'; titulo?: string; colunas: ColunaRelatorio[]; linhas: Valor[][] };

export interface AbaRelatorio {
  /** Nome da aba (até 31 caracteres, sem : \ / ? * [ ]). */
  nome: string;
  subtitulo?: string;
  blocos: BlocoRelatorio[];
}

export interface DadosRelatorioXlsx {
  clube: string;
  titulo: string;
  logoClube?: ImagemPlanilha | null;
  logoDbv?: ImagemPlanilha | null;
  abas: AbaRelatorio[];
  geradoEm?: Date;
}

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const esc = (v: unknown): string => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Caracteres de controle quebram o XML do Excel.
const limpo = (v: unknown): string => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

export function letra(n: number): string {
  let s = '';
  for (let x = n + 1; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

/** Índices dos estilos (cellXfs). Os pares par/ímpar são as linhas zebradas. */
const S = {
  padrao: 0, clube: 1, titulo: 2, subtitulo: 3, faixa: 4, blocoTitulo: 5, cab: 6, cabCentro: 7, rotulo: 8,
  // linhas da tabela, claras (branco) e zebradas (lavanda): texto, centro, inteiro, dinheiro, decimal
  txtA: 9, txtB: 10, ctrA: 11, ctrB: 12, intA: 13, intB: 14, rsA: 15, rsB: 16, decA: 17, decB: 18,
  // valores do resumo
  resTxt: 19, resInt: 20, resRs: 21, resDec: 22, resCtr: 23,
} as const;

const STYLES = `${XML}<styleSheet xmlns="${NS}">
<numFmts count="3"><numFmt numFmtId="164" formatCode="&quot;R$&quot;\\ #,##0.00"/><numFmt numFmtId="165" formatCode="#,##0.00"/><numFmt numFmtId="166" formatCode="#,##0"/></numFmts>
<fonts count="7">
<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="22"/><color rgb="FF4B2BB0"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="10"/><color rgb="FF7C39E7"/><name val="Calibri"/><family val="2"/></font>
<font><sz val="10"/><color rgb="FF667085"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="12"/><color rgb="FF4B2BB0"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FF1F1B33"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="6">
<fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF4B2BB0"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF6F2FE"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFEDE7F8"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF4B400"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFE3DCF5"/></left><right style="thin"><color rgb="FFE3DCF5"/></right><top style="thin"><color rgb="FFE3DCF5"/></top><bottom style="thin"><color rgb="FFE3DCF5"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="24">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="left" vertical="bottom" indent="9"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="left" vertical="center" indent="9"/></xf>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="left" vertical="top" indent="9"/></xf>
<xf numFmtId="0" fontId="0" fillId="5" borderId="0" xfId="0" applyFill="1"/>
<xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1" indent="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="6" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" indent="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1" indent="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1" indent="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" indent="1"/></xf>
<xf numFmtId="166" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" indent="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" indent="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" indent="1"/></xf>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" indent="1"/></xf>
<xf numFmtId="165" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" indent="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1" indent="1"/></xf>
<xf numFmtId="166" fontId="6" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" indent="1"/></xf>
<xf numFmtId="164" fontId="6" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" indent="1"/></xf>
<xf numFmtId="165" fontId="6" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" indent="1"/></xf>
<xf numFmtId="0" fontId="6" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/** Estilo de uma célula da tabela: texto/centro/inteiro/dinheiro/decimal, em linha clara (par) ou zebrada. */
function estiloLinha(f: FormatoColuna | undefined, zebra: boolean, valor: Valor): number {
  const z = zebra ? 1 : 0;
  const fmt = f ?? (typeof valor === 'number' ? 'inteiro' : 'texto');
  // Número sem formato pedido: inteiro mostra milhar; número com casas vira decimal.
  const real = fmt === 'inteiro' && typeof valor === 'number' && !Number.isInteger(valor) ? 'decimal' : fmt;
  switch (real) {
    case 'centro': return S.ctrA + z;
    case 'inteiro': return S.intA + z;
    case 'dinheiro': return S.rsA + z;
    case 'decimal': return S.decA + z;
    default: return S.txtA + z;
  }
}

function celula(ref: string, estilo: number, valor: Valor): string {
  if (valor === null || valor === undefined || valor === '') return `<c r="${ref}" s="${estilo}"/>`;
  if (typeof valor === 'number' && Number.isFinite(valor)) return `<c r="${ref}" s="${estilo}"><v>${valor}</v></c>`;
  return `<c r="${ref}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${esc(limpo(valor))}</t></is></c>`;
}

const larguraPx = (chars: number) => Math.round(chars * 7 + 5);

function nomeAba(nome: string, usados: Set<string>): string {
  let base = nome.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Relatório';
  let n = base, k = 2;
  while (usados.has(n.toLowerCase())) { n = `${base.slice(0, 28)} ${k++}`; }
  usados.add(n.toLowerCase());
  return n;
}

interface AbaMontada { cabecalhoLinha: number | null; xml: string; rels: string | null; drawing: string | null; imagens: { nome: string; img: ImagemPlanilha }[] }

function montarAba(d: DadosRelatorioXlsx, aba: AbaRelatorio, dataTxt: string, comLogos: { clube: ImagemPlanilha | null; dbv: ImagemPlanilha | null }): AbaMontada {
  // Largura de cada coluna: a maior pedida/necessária entre os blocos da aba.
  const largs: number[] = [];
  const garantir = (c: number, w: number) => { largs[c] = Math.max(largs[c] ?? 0, w); };
  for (const b of aba.blocos) {
    if (b.tipo === 'resumo') {
      garantir(0, Math.min(46, Math.max(14, ...b.pares.map(([k]) => limpo(k).length + 4))));
      garantir(1, Math.min(30, Math.max(14, ...b.pares.map(([, v]) => (typeof v === 'number' ? 14 : limpo(v).length + 3)))));
    } else {
      b.colunas.forEach((c, k) => {
        const conteudo = Math.max(c.titulo.length + 3, ...b.linhas.slice(0, 400).map((l) => {
          const v = l[k];
          return typeof v === 'number' ? 12 : Math.min(60, limpo(v).length + 3);
        }), 6);
        garantir(k, c.largura ?? Math.min(60, conteudo));
      });
    }
  }
  const nCols = Math.max(largs.length, 2);
  for (let c = 0; c < nCols; c++) largs[c] = largs[c] ?? 12;
  // A primeira coluna precisa caber o texto do cabeçalho ao lado do logo.
  const col0 = 1; // as colunas da tabela começam em B (A é margem)
  const colunasXml = `<cols><col min="1" max="1" width="2.2" customWidth="1"/>${largs.map((w, k) => `<col min="${k + 2}" max="${k + 2}" width="${w.toFixed(1)}" customWidth="1"/>`).join('')}</cols>`;
  const ultimaCol = nCols - 1 + col0;

  const linhas: string[] = [];
  const topo = [
    `<row r="1" ht="20" customHeight="1">${celula('B1', S.clube, d.clube.toUpperCase())}</row>`,
    `<row r="2" ht="34" customHeight="1">${celula('B2', S.titulo, d.titulo)}</row>`,
    `<row r="3" ht="20" customHeight="1">${celula('B3', S.subtitulo, aba.subtitulo ? `${aba.subtitulo} · Gerado em ${dataTxt}` : `Gerado em ${dataTxt}`)}</row>`,
    `<row r="4" ht="5" customHeight="1">${Array.from({ length: nCols }, (_, k) => `<c r="${letra(k + col0)}4" s="${S.faixa}"/>`).join('')}</row>`,
  ];
  linhas.push(...topo);

  let r = 6;
  let filtro: string | null = null;
  let congelaEm: number | null = null;
  let tabelas = 0;
  for (const b of aba.blocos) {
    if (b.tipo === 'resumo') {
      if (b.titulo) { linhas.push(`<row r="${r}" ht="24" customHeight="1">${celula(`B${r}`, S.blocoTitulo, b.titulo)}</row>`); r++; }
      b.pares.forEach(([rotulo, valor], k) => {
        const f = b.formato?.[k] ?? (typeof valor === 'number' ? 'inteiro' : 'texto');
        const est = f === 'dinheiro' ? S.resRs : f === 'decimal' ? S.resDec : f === 'inteiro' ? S.resInt : f === 'centro' ? S.resCtr : S.resTxt;
        linhas.push(`<row r="${r}" ht="19" customHeight="1">${celula(`B${r}`, S.rotulo, rotulo)}${celula(`C${r}`, est, valor)}</row>`);
        r++;
      });
      r++;
    } else {
      tabelas++;
      if (b.titulo) { linhas.push(`<row r="${r}" ht="24" customHeight="1">${celula(`B${r}`, S.blocoTitulo, b.titulo)}</row>`); r++; }
      const cab = r;
      linhas.push(`<row r="${r}" ht="30" customHeight="1">${b.colunas.map((c, k) => celula(`${letra(k + col0)}${r}`, c.formato && c.formato !== 'texto' ? S.cabCentro : S.cab, c.titulo)).join('')}</row>`);
      r++;
      b.linhas.forEach((l, i) => {
        const z = i % 2 === 1;
        linhas.push(`<row r="${r}" ht="18" customHeight="1">${b.colunas.map((c, k) => celula(`${letra(k + col0)}${r}`, estiloLinha(c.formato, z, l[k]), l[k])).join('')}</row>`);
        r++;
      });
      // Filtro e painel congelado valem para a última tabela; com uma só tabela o cabeçalho fica fixo ao rolar.
      filtro = `${letra(col0)}${cab}:${letra(b.colunas.length - 1 + col0)}${Math.max(r - 1, cab)}`;
      if (tabelas === 1 && aba.blocos.filter((x) => x.tipo === 'tabela').length === 1 && aba.blocos.length === 1) congelaEm = cab;
      r++;
    }
  }
  const ultimaLinha = Math.max(r - 1, 6);

  // Logos: clube à esquerda (sobre as 3 primeiras linhas), Desbravadores à direita da faixa.
  const imagens: AbaMontada['imagens'] = [];
  let drawing: string | null = null;
  let rels: string | null = null;
  const figuras: string[] = [];
  const LADO = 62; // px
  const pic = (id: number, nome: string, rid: string, img: ImagemPlanilha, col: number, colOff: number, rowOff: number) => {
    const esc2 = LADO / Math.max(img.largura, img.altura);
    const cx = Math.round(img.largura * esc2 * 9525), cy = Math.round(img.altura * esc2 * 9525);
    return `<xdr:oneCellAnchor><xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>${colOff}</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>${rowOff}</xdr:rowOff></xdr:from><xdr:ext cx="${cx}" cy="${cy}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${id}" name="${nome}" descr="${nome}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip xmlns:r="${NS_R}" r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`;
  };
  if (comLogos.clube) {
    imagens.push({ nome: 'logo-clube', img: comLogos.clube });
    figuras.push(pic(2, 'Logo do clube', 'rId1', comLogos.clube, 1, 76200, 47625));
  }
  if (comLogos.dbv) {
    imagens.push({ nome: 'logo-dbv', img: comLogos.dbv });
    const larguraUltima = larguraPx(largs[nCols - 1]);
    const off = Math.max(0, larguraUltima - LADO - 6) * 9525;
    figuras.push(pic(3, 'Logo dos Desbravadores', `rId${imagens.length}`, comLogos.dbv, ultimaCol, off, 47625));
  }
  if (figuras.length) {
    drawing = `${XML}<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${figuras.join('')}</xdr:wsDr>`;
    rels = `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${NS_R}/drawing" Target="../drawings/drawingN.xml"/></Relationships>`;
  }

  const painel = congelaEm
    ? `<pane ySplit="${congelaEm}" topLeftCell="A${congelaEm + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="B${congelaEm + 1}" sqref="B${congelaEm + 1}"/>`
    : '';
  const xml = `${XML}<worksheet xmlns="${NS}" xmlns:r="${NS_R}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${letra(ultimaCol)}${ultimaLinha}"/>
<sheetViews><sheetView showGridLines="0" workbookViewId="0" zoomScale="95" zoomScaleNormal="95">${painel}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>${colunasXml}<sheetData>${linhas.join('')}</sheetData>${filtro ? `<autoFilter ref="${filtro}"/>` : ''}
<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="${nCols > 6 ? 'landscape' : 'portrait'}" fitToWidth="1" fitToHeight="0"/>${drawing ? '<drawing r:id="rId1"/>' : ''}</worksheet>`;
  return { cabecalhoLinha: congelaEm, xml, rels, drawing, imagens };
}

/** Gera o .xlsx do relatório (uma aba por item de `abas`). */
export function gerarXlsxRelatorio(d: DadosRelatorioXlsx): Uint8Array {
  const geradoEm = d.geradoEm ?? new Date();
  const dataTxt = `${String(geradoEm.getDate()).padStart(2, '0')}/${String(geradoEm.getMonth() + 1).padStart(2, '0')}/${geradoEm.getFullYear()}`;
  const abas = d.abas.length ? d.abas : [{ nome: 'Relatório', blocos: [] } as AbaRelatorio];
  const usados = new Set<string>();
  const nomes = abas.map((a) => nomeAba(a.nome, usados));
  const arquivos: Record<string, Uint8Array> = {};
  const overrides: string[] = [];
  const extensoes = new Set<string>(['png', 'jpeg']);
  const titulosImpressao: string[] = [];
  let nDraw = 0;

  abas.forEach((aba, i) => {
    const m = montarAba(d, aba, dataTxt, { clube: d.logoClube ?? null, dbv: d.logoDbv ?? null });
    arquivos[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(m.xml);
    // Tabela única: o cabeçalho se repete em cada folha impressa.
    if (m.cabecalhoLinha) {
      const linhaCab = String(m.cabecalhoLinha);
      titulosImpressao.push(`<definedName name="_xlnm.Print_Titles" localSheetId="${i}">'${nomes[i].replace(/'/g, "''")}'!$${linhaCab}:$${linhaCab}</definedName>`);
    }
    overrides.push(`<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
    if (m.drawing && m.rels) {
      nDraw++;
      arquivos[`xl/worksheets/_rels/sheet${i + 1}.xml.rels`] = strToU8(m.rels.replace('drawingN', `drawing${nDraw}`));
      arquivos[`xl/drawings/drawing${nDraw}.xml`] = strToU8(m.drawing);
      overrides.push(`<Override PartName="/xl/drawings/drawing${nDraw}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
      arquivos[`xl/drawings/_rels/drawing${nDraw}.xml.rels`] = strToU8(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${m.imagens.map((im, k) => `<Relationship Id="rId${k + 1}" Type="${NS_R}/image" Target="../media/${im.nome}-${nDraw}.${im.img.ext}"/>`).join('')}</Relationships>`);
      for (const im of m.imagens) arquivos[`xl/media/${im.nome}-${nDraw}.${im.img.ext}`] = im.img.bytes;
    }
  });

  arquivos['[Content_Types].xml'] = strToU8(`${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${[...extensoes].map((e) => `<Default Extension="${e}" ContentType="image/${e}"/>`).join('')}<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${overrides.join('')}</Types>`);
  arquivos['_rels/.rels'] = strToU8(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${NS_R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  arquivos['xl/workbook.xml'] = strToU8(`${XML}<workbook xmlns="${NS}" xmlns:r="${NS_R}"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="15000"/></bookViews><sheets>${nomes.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${titulosImpressao.length ? `<definedNames>${titulosImpressao.join('')}</definedNames>` : ''}<calcPr calcId="191029"/></workbook>`);
  arquivos['xl/_rels/workbook.xml.rels'] = strToU8(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${nomes.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NS_R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${nomes.length + 1}" Type="${NS_R}/styles" Target="styles.xml"/></Relationships>`);
  arquivos['xl/styles.xml'] = strToU8(STYLES);
  return zipSync(arquivos);
}

/** Nome do arquivo sem a extensão: título sem acento e sem caracteres inválidos, com a data. */
export function nomeArquivoRelatorioXlsx(titulo: string, quando: Date = new Date()): string {
  const base = titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\s.\-]+/g, ' ').trim().replace(/\s+/g, '-').slice(0, 90) || 'Relatorio';
  return `${base}_${quando.getFullYear()}-${String(quando.getMonth() + 1).padStart(2, '0')}-${String(quando.getDate()).padStart(2, '0')}`;
}
