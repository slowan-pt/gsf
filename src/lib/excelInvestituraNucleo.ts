/**
 * Excel de investidura: a matriz "item × membro" com X, a quantidade de cada item, o valor de cada um (preços do Bazar
 * dos Desbravadores) e os totais por item, por seção e por membro. Segue a aba "Investidura" da planilha do clube
 * (Lista Especialidades_Jul26.xlsx) e acrescenta o logo do clube, a unidade de cada membro, subtotais e uma aba
 * "Valores" com os preços editáveis: ao mudar um preço, todos os totais se recalculam (são fórmulas do Excel).
 *
 * Parte pura (sem React Native nem rede): monta o .xlsx à mão (XML + fflate), como o Word da autorização.
 * Testada com "node --test" (ver "npm run test:excel-investidura").
 */
import { strToU8, zipSync } from 'fflate';
import type { ItemAguardando } from './investidura';

// Mesmas regras de autorizacaoInvestiduraNucleo.ts, repetidas aqui para este arquivo rodar sozinho no "node --test".
const escXml = (v: unknown): string => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Chave para achar o código de uma especialidade pelo nome (sem acento, minúscula, espaços únicos). */
export const chaveNome = (nome: string) => nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/* ─── Preços ───────────────────────────────────────────────────────────── */

export const BAZAR_URL = 'https://www.bazardosdesbravadores.com.br/';
/** Data em que os preços abaixo foram conferidos no site. */
export const PRECOS_CONSULTADOS_EM = '2026-11-11';

export interface PrecoItem {
  chave: 'especialidade' | 'mestrado' | 'classeRegular' | 'classeAvancada';
  rotulo: string;
  valor: number;
  observacao: string;
}

/**
 * Quem recebe uma classe regular (Amigo a Guia) leva três peças: o bordado do braço esquerdo, o pin (prendedor
 * bordado da classe) e a tira com o nome da classe. O valor da classe regular é a soma das três.
 */
export const COMPONENTES_CLASSE_REGULAR: { rotulo: string; valor: number; observacao: string }[] = [
  { rotulo: 'Classe regular: bordado do braço esquerdo', valor: 4.9, observacao: 'Distintivo Desbravadores - Regular (Amigo a Guia)' },
  { rotulo: 'Classe regular: pin da classe (prendedor bordado)', valor: 6.3, observacao: 'Prendedor - Classe (Amigo a Guia) - Bordado' },
  { rotulo: 'Classe regular: nome da classe (tira)', valor: 2.3, observacao: 'Tiras de Classes 1 a 6 (cáqui ou branco)' },
];
export const VALOR_CLASSE_REGULAR = Math.round(COMPONENTES_CLASSE_REGULAR.reduce((s, c) => s + c.valor, 0) * 100) / 100;

/** Preços usados nos totais (editáveis na aba "Valores"). */
export const PRECOS_USADOS: PrecoItem[] = [
  { chave: 'especialidade', rotulo: 'Especialidade', valor: 1.6, observacao: 'Especialidades (qualquer área)' },
  { chave: 'mestrado', rotulo: 'Mestrado', valor: 2.9, observacao: 'Mestrados' },
  { chave: 'classeRegular', rotulo: 'Classe regular (bordado + pin + nome)', valor: VALOR_CLASSE_REGULAR, observacao: 'Soma das três peças abaixo' },
  { chave: 'classeAvancada', rotulo: 'Classe avançada (distintivo bordado)', valor: 2.1, observacao: 'Distintivo Desbravadores - Avançado Bordado' },
];

/** Outros preços do site, só para consulta (não entram nos totais). */
export const PRECOS_REFERENCIA: { rotulo: string; valor: number; observacao: string }[] = [
  { rotulo: 'Classe avançada (distintivo em metal)', valor: 6.5, observacao: 'Troque o valor da classe avançada se o clube comprar em metal' },
  { rotulo: 'Tira de nome', valor: 5.5, observacao: 'Tiras de Nome (cáqui ou branco)' },
  { rotulo: 'Distintivo de batismo', valor: 5.5, observacao: 'Pin de batismo' },
  { rotulo: 'Insígnia de excelência / boa conduta (metal)', valor: 6.6, observacao: 'Distintivo Boa Conduta' },
];

/* ─── Dados da planilha ────────────────────────────────────────────────── */

export type SecaoExcel = 'especialidade' | 'mestrado' | 'classeRegular' | 'classeAvancada';

export const TITULO_SECAO: Record<SecaoExcel, string> = {
  especialidade: 'ESPECIALIDADES',
  mestrado: 'MESTRADOS',
  classeRegular: 'CLASSES REGULARES',
  classeAvancada: 'CLASSES AVANÇADAS',
};

const ORDEM_SECOES: SecaoExcel[] = ['especialidade', 'mestrado', 'classeRegular', 'classeAvancada'];
const REGULARES = ['Amigo', 'Companheiro', 'Pesquisador', 'Pioneiro', 'Excursionista', 'Guia'];
const AVANCADAS = ['Amigo da Natureza', 'Companheiro de Excursionismo', 'Pesquisador de Campos e Bosques', 'Pioneiro de Novas Fronteiras', 'Excursionista na Mata', 'Guia de Exploração'];

export interface MembroExcel { dbvId: number; nome: string; unidade: string }
export interface LinhaExcel { nome: string; marcas: boolean[] }
export interface GrupoExcel { secao: SecaoExcel; linhas: LinhaExcel[] }
export interface PlanilhaInvestidura { membros: MembroExcel[]; grupos: GrupoExcel[] }

const cmp = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function secaoDoItem(i: ItemAguardando): SecaoExcel {
  if (i.tipo === 'mestrado') return 'mestrado';
  if (i.tipo === 'especialidade') return 'especialidade';
  return AVANCADAS.some((n) => semAcento(n) === semAcento(i.nome)) ? 'classeAvancada' : 'classeRegular';
}

/** Ordem fixa das classes (Amigo, Companheiro...), com as desconhecidas no fim em ordem alfabética. */
function ordemClasse(nome: string, lista: string[]): number {
  const i = lista.findIndex((n) => semAcento(n) === semAcento(nome));
  return i < 0 ? lista.length : i;
}

/** Agrupa os itens aguardando investidura em seções (itens nas linhas) e membros (nas colunas). */
export function montarPlanilha(itens: ItemAguardando[], codigos: Record<string, string> = {}): PlanilhaInvestidura {
  const membrosMapa = new Map<number, MembroExcel>();
  for (const i of itens) if (!membrosMapa.has(i.dbvId)) membrosMapa.set(i.dbvId, { dbvId: i.dbvId, nome: i.membroNome.trim(), unidade: (i.unidadeNome ?? '').trim() });
  const membros = Array.from(membrosMapa.values()).sort((a, b) => cmp(a.nome, b.nome));
  const coluna = new Map(membros.map((m, k) => [m.dbvId, k]));

  const porSecao = new Map<SecaoExcel, Map<string, LinhaExcel>>();
  for (const i of itens) {
    const secao = secaoDoItem(i);
    const rotulo = i.tipo === 'especialidade' && codigos[chaveNome(i.nome)] ? `${i.nome.trim()} (${codigos[chaveNome(i.nome)]})` : i.nome.trim();
    const mapa = porSecao.get(secao) ?? new Map<string, LinhaExcel>();
    const linha = mapa.get(rotulo) ?? { nome: rotulo, marcas: membros.map(() => false) };
    linha.marcas[coluna.get(i.dbvId)!] = true;
    mapa.set(rotulo, linha);
    porSecao.set(secao, mapa);
  }

  const grupos: GrupoExcel[] = [];
  for (const secao of ORDEM_SECOES) {
    const mapa = porSecao.get(secao);
    if (!mapa || mapa.size === 0) continue;
    const linhas = Array.from(mapa.values());
    if (secao === 'classeRegular') linhas.sort((a, b) => ordemClasse(a.nome, REGULARES) - ordemClasse(b.nome, REGULARES) || cmp(a.nome, b.nome));
    else if (secao === 'classeAvancada') linhas.sort((a, b) => ordemClasse(a.nome, AVANCADAS) - ordemClasse(b.nome, AVANCADAS) || cmp(a.nome, b.nome));
    else linhas.sort((a, b) => cmp(a.nome, b.nome));
    grupos.push({ secao, linhas });
  }
  return { membros, grupos };
}

/* ─── Imagem (logo) ────────────────────────────────────────────────────── */

export interface LogoExcel { bytes: Uint8Array; ext: 'png' | 'jpeg'; largura: number; altura: number }

/** Lê o tipo e o tamanho de um PNG ou JPEG; devolve null para outros formatos (o Excel ficaria sem logo). */
export function lerImagem(bytes: Uint8Array): LogoExcel | null {
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

/* ─── Montagem do .xlsx ────────────────────────────────────────────────── */

export interface OpcoesExcel {
  clube: string;
  logo: LogoExcel | null;
  /** Logo dos Desbravadores (canto do bloco fixo, à direita do nome do clube). */
  logoDbv?: LogoExcel | null;
  /** Texto do subtítulo, ex.: "Investidura · 12 membros · 85 itens". */
  subtitulo: string;
  /** Substitui os preços padrão (mesma ordem de PRECOS_USADOS). */
  precos?: Partial<Record<PrecoItem['chave'], number>>;
  geradoEm?: Date;
}

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** Índices dos estilos (cellXfs) em styles.xml. */
const S = {
  padrao: 0, titulo: 1, subtitulo: 2, cab: 3, cabMembro: 4, secao: 5, item: 6, dinheiro: 7, qtd: 8, marca: 9, vazio: 10,
  totalRotulo: 11, totalDinheiro: 12, totalQtd: 13, dinheiroNegrito: 14, entrada: 15, nota: 16, unidade: 17, secaoQtd: 18,
  secaoDinheiro: 19, totalNumeroMembro: 20, totalQtdMembro: 21, resumoRotulo: 22,
} as const;

const STYLES = `${XML}<styleSheet xmlns="${NS}">
<numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;R$&quot;\\ #,##0.00"/><numFmt numFmtId="165" formatCode="#,##0.00"/></numFmts>
<fonts count="8">
<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="20"/><color rgb="FF4B2BB0"/><name val="Calibri"/><family val="2"/></font>
<font><sz val="11"/><color rgb="FF667085"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="9"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
<font><i/><sz val="9"/><color rgb="FF667085"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="12"/><color rgb="FF4B2BB0"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="8">
<fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF4B2BB0"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFEDE7F8"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFC8E6C9"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFF4CC"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFFDE7"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF2F4F7"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFD0D5DD"/></left><right style="thin"><color rgb="FFD0D5DD"/></right><top style="thin"><color rgb="FFD0D5DD"/></top><bottom style="thin"><color rgb="FFD0D5DD"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="23">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="left" vertical="center" indent="10"/></xf>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="left" vertical="center" indent="10"/></xf>
<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="5" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="bottom" textRotation="90"/></xf>
<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1" indent="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
<xf numFmtId="1" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
<xf numFmtId="0" fontId="1" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
<xf numFmtId="164" fontId="1" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
<xf numFmtId="1" fontId="1" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="164" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
<xf numFmtId="164" fontId="1" fillId="6" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
<xf numFmtId="0" fontId="6" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="6" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="bottom" textRotation="90"/></xf>
<xf numFmtId="1" fontId="1" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="164" fontId="1" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
<xf numFmtId="165" fontId="1" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" textRotation="90"/></xf>
<xf numFmtId="1" fontId="1" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="7" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/** Letra(s) da coluna (0 = A). */
export function letraColuna(n: number): string {
  let s = '';
  for (let x = n + 1; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

type Celula = string;
const txt = (ref: string, estilo: number, valor: string): Celula =>
  valor === '' ? `<c r="${ref}" s="${estilo}"/>` : `<c r="${ref}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${escXml(valor)}</t></is></c>`;
const num = (ref: string, estilo: number, valor: number): Celula => `<c r="${ref}" s="${estilo}"><v>${Number.isInteger(valor) ? valor : Number(valor.toFixed(4))}</v></c>`;
const formula = (ref: string, estilo: number, f: string, valor: number): Celula => `<c r="${ref}" s="${estilo}"><f>${escXml(f)}</f><v>${Number.isInteger(valor) ? valor : Number(valor.toFixed(4))}</v></c>`;
const vazia = (ref: string, estilo: number): Celula => `<c r="${ref}" s="${estilo}"/>`;

const linha = (n: number, celulas: Celula[], altura?: number): string =>
  `<row r="${n}"${altura ? ` ht="${altura}" customHeight="1"` : ''}>${celulas.join('')}</row>`;

const arredonda = (v: number) => Math.round(v * 100) / 100;

/** Gera o .xlsx completo (abas "Investidura" e "Valores"). */
export function gerarExcelInvestidura(plano: PlanilhaInvestidura, o: OpcoesExcel): Uint8Array {
  const precos = new Map<PrecoItem['chave'], number>(PRECOS_USADOS.map((p) => [p.chave, o.precos?.[p.chave] ?? p.valor]));
  const LINHA_VALOR: Record<PrecoItem['chave'], number> = { especialidade: 5, mestrado: 6, classeRegular: 7, classeAvancada: 8 };
  const nMembros = plano.membros.length;
  const PRIMEIRA_MEMBRO = 5; // coluna F
  const ultima = PRIMEIRA_MEMBRO + Math.max(nMembros, 1) - 1;
  const L = (c: number) => letraColuna(c);

  /* ---- Aba Investidura ---- */
  const linhas: string[] = [];
  const geradoEm = o.geradoEm ?? new Date();
  const data = `${String(geradoEm.getDate()).padStart(2, '0')}/${String(geradoEm.getMonth() + 1).padStart(2, '0')}/${geradoEm.getFullYear()}`;
  linhas.push(linha(1, [txt('B1', S.titulo, o.clube)], 30));
  linhas.push(linha(2, [txt('B2', S.subtitulo, o.subtitulo)], 19));
  linhas.push(linha(3, [txt('B3', S.subtitulo, `Gerado em ${data} · preços do Bazar (aba "Valores")`)], 19));

  const maiorNome = plano.membros.reduce((m, x) => Math.max(m, x.nome.length), 8);
  const alturaCab = Math.min(300, Math.max(90, Math.round(maiorNome * 4.4 + 14)));
  const maiorUnidade = plano.membros.reduce((m, x) => Math.max(m, x.unidade.length), 0);
  const alturaUnidade = maiorUnidade ? Math.min(150, Math.max(40, Math.round(maiorUnidade * 4.4 + 10))) : 20;

  linhas.push(linha(4, [
    txt('B4', S.resumoRotulo, 'Unidade'),
    ...plano.membros.map((m, k) => txt(`${L(PRIMEIRA_MEMBRO + k)}4`, S.unidade, m.unidade)),
  ], alturaUnidade));
  linhas.push(linha(5, [
    txt('B5', S.cab, 'Item'), txt('C5', S.cab, 'Valor unit.'), txt('D5', S.cab, 'Qtd.'), txt('E5', S.cab, 'Subtotal'),
    ...plano.membros.map((m, k) => txt(`${L(PRIMEIRA_MEMBRO + k)}5`, S.cabMembro, m.nome)),
  ], alturaCab));

  let r = 6;
  const primeiraLinhaDados = r;
  const secoesInfo: { titulo: string; linhaSecao: number; qtd: number; total: number }[] = [];
  const itemLinhas: { linha: number; valor: number; marcas: boolean[] }[] = [];

  for (const g of plano.grupos) {
    const valorUnit = precos.get(g.secao)!;
    const linhaSecao = r;
    const primeiro = r + 1;
    const ultimo = r + g.linhas.length;
    let qtdSecao = 0;
    for (const li of g.linhas) qtdSecao += li.marcas.filter(Boolean).length;
    const totalSecao = arredonda(qtdSecao * valorUnit);
    secoesInfo.push({ titulo: TITULO_SECAO[g.secao], linhaSecao, qtd: qtdSecao, total: totalSecao });

    const cel: Celula[] = [
      txt(`B${r}`, S.secao, `${TITULO_SECAO[g.secao]} (${g.linhas.length})`),
      vazia(`C${r}`, S.secao),
      formula(`D${r}`, S.secaoQtd, `SUM(D${primeiro}:D${ultimo})`, qtdSecao),
      formula(`E${r}`, S.secaoDinheiro, `SUM(E${primeiro}:E${ultimo})`, totalSecao),
    ];
    for (let k = 0; k < nMembros; k++) cel.push(vazia(`${L(PRIMEIRA_MEMBRO + k)}${r}`, S.secao));
    linhas.push(linha(r, cel, 20));
    r++;

    for (const li of g.linhas) {
      const q = li.marcas.filter(Boolean).length;
      const cm: Celula[] = [
        txt(`B${r}`, S.item, li.nome),
        formula(`C${r}`, S.dinheiro, `Valores!$C$${LINHA_VALOR[g.secao]}`, valorUnit),
        formula(`D${r}`, S.qtd, `COUNTIF(${L(PRIMEIRA_MEMBRO)}${r}:${L(ultima)}${r},"X")`, q),
        formula(`E${r}`, S.dinheiroNegrito, `C${r}*D${r}`, arredonda(q * valorUnit)),
      ];
      li.marcas.forEach((m, k) => cm.push(m ? txt(`${L(PRIMEIRA_MEMBRO + k)}${r}`, S.marca, 'X') : vazia(`${L(PRIMEIRA_MEMBRO + k)}${r}`, S.vazio)));
      linhas.push(linha(r, cm, 18));
      itemLinhas.push({ linha: r, valor: valorUnit, marcas: li.marcas });
      r++;
    }
  }
  const ultimaLinhaDados = r - 1;
  const qtdTotal = secoesInfo.reduce((s, x) => s + x.qtd, 0);
  const valorTotal = arredonda(secoesInfo.reduce((s, x) => s + x.total, 0));

  // Total geral (soma das seções, sem contar duas vezes) e, abaixo, os totais de cada membro: itens e valor.
  const rTotal = r, rQtd = r + 1, rValor = r + 2;
  const somaSecoes = (col: string) => secoesInfo.map((x) => `${col}${x.linhaSecao}`).join('+') || '0';
  const celTotal: Celula[] = [
    txt(`B${rTotal}`, S.totalRotulo, 'TOTAL GERAL'), vazia(`C${rTotal}`, S.totalRotulo),
    formula(`D${rTotal}`, S.totalQtd, somaSecoes('D'), qtdTotal), formula(`E${rTotal}`, S.totalDinheiro, somaSecoes('E'), valorTotal),
  ];
  const celQtd: Celula[] = [txt(`B${rQtd}`, S.totalRotulo, 'Itens por membro'), vazia(`C${rQtd}`, S.totalRotulo), vazia(`D${rQtd}`, S.totalRotulo), vazia(`E${rQtd}`, S.totalRotulo)];
  const celValor: Celula[] = [txt(`B${rValor}`, S.totalRotulo, 'Valor por membro (R$)'), vazia(`C${rValor}`, S.totalRotulo), vazia(`D${rValor}`, S.totalRotulo), vazia(`E${rValor}`, S.totalRotulo)];
  plano.membros.forEach((_, k) => {
    const col = L(PRIMEIRA_MEMBRO + k);
    celTotal.push(vazia(`${col}${rTotal}`, S.totalRotulo));
    const q = itemLinhas.filter((x) => x.marcas[k]).length;
    const v = arredonda(itemLinhas.reduce((s, x) => s + (x.marcas[k] ? x.valor : 0), 0));
    celQtd.push(formula(`${col}${rQtd}`, S.totalQtdMembro, `COUNTIF(${col}${primeiraLinhaDados}:${col}${ultimaLinhaDados},"X")`, q));
    celValor.push(formula(`${col}${rValor}`, S.totalNumeroMembro, `SUMPRODUCT((${col}${primeiraLinhaDados}:${col}${ultimaLinhaDados}="X")*$C${primeiraLinhaDados}:$C${ultimaLinhaDados})`, v));
  });
  linhas.push(linha(rTotal, celTotal, 22));
  linhas.push(linha(rQtd, celQtd, 20));
  linhas.push(linha(rValor, celValor, 64));
  const rNota = rValor + 2;
  linhas.push(linha(rNota, [txt(`B${rNota}`, S.nota, `Valores conferidos no Bazar dos Desbravadores (${BAZAR_URL}) em ${PRECOS_CONSULTADOS_EM.split('-').reverse().join('/')}. Para atualizar, edite a aba "Valores": todos os totais se recalculam.`)], 30));

  const colunas = `<cols><col min="1" max="1" width="2.7" customWidth="1"/><col min="2" max="2" width="46" customWidth="1"/><col min="3" max="3" width="12.5" customWidth="1"/><col min="4" max="4" width="7.5" customWidth="1"/><col min="5" max="5" width="13" customWidth="1"/>${nMembros ? `<col min="${PRIMEIRA_MEMBRO + 1}" max="${ultima + 1}" width="7" customWidth="1"/>` : ''}</cols>`;
  const hasLogo = !!(o.logo || o.logoDbv);
  const sheet1 = `${XML}<worksheet xmlns="${NS}" xmlns:r="${NS_R}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${L(ultima)}${rNota}"/>
<sheetViews><sheetView showGridLines="0" workbookViewId="0" tabSelected="1" zoomScale="90" zoomScaleNormal="90"><pane xSplit="5" ySplit="5" topLeftCell="F6" activePane="bottomRight" state="frozen"/><selection pane="topRight" activeCell="F1" sqref="F1"/><selection pane="bottomLeft" activeCell="A6" sqref="A6"/><selection pane="bottomRight" activeCell="F6" sqref="F6"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>${colunas}<sheetData>${linhas.join('')}</sheetData>
<mergeCells count="1"><mergeCell ref="B${rNota}:${L(Math.min(ultima, 14))}${rNota}"/></mergeCells>
<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>${hasLogo ? '<drawing r:id="rId1"/>' : ''}</worksheet>`;

  /* ---- Aba Valores ---- */
  const lv: string[] = [];
  lv.push(linha(1, [txt('B1', S.resumoRotulo, 'Valores unitários (Bazar dos Desbravadores)')], 26));
  lv.push(linha(2, [txt('B2', S.nota, `Fonte: ${BAZAR_URL} · conferido em ${PRECOS_CONSULTADOS_EM.split('-').reverse().join('/')}. Os valores em amarelo alimentam os totais da aba "Investidura": altere e tudo se recalcula.`)], 32));
  lv.push(linha(4, [txt('B4', S.cab, 'Objeto'), txt('C4', S.cab, 'Valor (R$)'), txt('D4', S.cab, 'Entra nos totais?'), txt('E4', S.cab, 'Observação')], 22));
  let rv = 5;
  // A classe regular é a SOMA das três peças (linhas logo abaixo dos preços principais); as peças é que se editam.
  const primeiraPeca = rv + PRECOS_USADOS.length;
  const ultimaPeca = primeiraPeca + COMPONENTES_CLASSE_REGULAR.length - 1;
  for (const p of PRECOS_USADOS) {
    const celulaValor = p.chave === 'classeRegular' && o.precos?.classeRegular === undefined
      ? formula(`C${rv}`, S.dinheiroNegrito, `SUM(C${primeiraPeca}:C${ultimaPeca})`, precos.get(p.chave)!)
      : num(`C${rv}`, S.entrada, precos.get(p.chave)!);
    lv.push(linha(rv, [txt(`B${rv}`, S.item, p.rotulo), celulaValor, txt(`D${rv}`, S.qtd, 'Sim'), txt(`E${rv}`, S.item, p.observacao)], 20));
    rv++;
  }
  for (const c of COMPONENTES_CLASSE_REGULAR) {
    lv.push(linha(rv, [txt(`B${rv}`, S.item, c.rotulo), num(`C${rv}`, S.entrada, c.valor), txt(`D${rv}`, S.qtd, 'Sim (na classe regular)'), txt(`E${rv}`, S.item, c.observacao)], 20));
    rv++;
  }
  for (const p of PRECOS_REFERENCIA) {
    lv.push(linha(rv, [txt(`B${rv}`, S.item, p.rotulo), num(`C${rv}`, S.dinheiro, p.valor), txt(`D${rv}`, S.qtd, 'Não'), txt(`E${rv}`, S.item, p.observacao)], 20));
    rv++;
  }
  const sheet2 = `${XML}<worksheet xmlns="${NS}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="B1:E${rv - 1}"/><sheetViews><sheetView showGridLines="0" workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/>
<cols><col min="1" max="1" width="2.7" customWidth="1"/><col min="2" max="2" width="46" customWidth="1"/><col min="3" max="3" width="14" customWidth="1"/><col min="4" max="4" width="18" customWidth="1"/><col min="5" max="5" width="62" customWidth="1"/></cols>
<sheetData>${lv.join('')}</sheetData><mergeCells count="1"><mergeCell ref="B2:E2"/></mergeCells><pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;

  /* ---- Pacote ---- */
  const arquivos: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${hasLogo ? '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : ''}</Types>`),
    '_rels/.rels': strToU8(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${NS_R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    'xl/workbook.xml': strToU8(`${XML}<workbook xmlns="${NS}" xmlns:r="${NS_R}"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="15000"/></bookViews><sheets><sheet name="Investidura" sheetId="1" r:id="rId1"/><sheet name="Valores" sheetId="2" r:id="rId2"/></sheets><definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">Investidura!$4:$5</definedName></definedNames><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${NS_R}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${NS_R}/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="${NS_R}/styles" Target="styles.xml"/></Relationships>`),
    'xl/styles.xml': strToU8(STYLES),
    'xl/worksheets/sheet1.xml': strToU8(sheet1),
    'xl/worksheets/sheet2.xml': strToU8(sheet2),
  };
  if (hasLogo) {
    // Logo do clube à esquerda (coluna B) e logo dos Desbravadores à direita do bloco fixo (coluna E); lado maior: 74 px.
    const figuras: { nome: string; arquivo: string; img: LogoExcel; col: number; off: number }[] = [];
    if (o.logo) figuras.push({ nome: 'Logo do clube', arquivo: `logo.${o.logo.ext}`, img: o.logo, col: 1, off: 57150 });
    if (o.logoDbv) figuras.push({ nome: 'Logo dos Desbravadores', arquivo: `logo-dbv.${o.logoDbv.ext}`, img: o.logoDbv, col: 4, off: 17 * 9525 });
    const pics = figuras.map((f, k) => {
      const escala = 74 / Math.max(f.img.largura, f.img.altura);
      const cx = Math.round(f.img.largura * escala * 9525), cy = Math.round(f.img.altura * escala * 9525);
      return `<xdr:oneCellAnchor><xdr:from><xdr:col>${f.col}</xdr:col><xdr:colOff>${f.off}</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>47625</xdr:rowOff></xdr:from><xdr:ext cx="${cx}" cy="${cy}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${k + 2}" name="${f.nome}" descr="${f.nome}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip xmlns:r="${NS_R}" r:embed="rId${k + 1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`;
    });
    arquivos['xl/worksheets/_rels/sheet1.xml.rels'] = strToU8(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${NS_R}/drawing" Target="../drawings/drawing1.xml"/></Relationships>`);
    arquivos['xl/drawings/drawing1.xml'] = strToU8(`${XML}<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${pics.join('')}</xdr:wsDr>`);
    arquivos['xl/drawings/_rels/drawing1.xml.rels'] = strToU8(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${figuras.map((f, k) => `<Relationship Id="rId${k + 1}" Type="${NS_R}/image" Target="../media/${f.arquivo}"/>`).join('')}</Relationships>`);
    for (const f of figuras) arquivos[`xl/media/${f.arquivo}`] = f.img.bytes;
  }
  return zipSync(arquivos);
}

/** Nome do arquivo (sem a extensão). */
export function nomeArquivoExcel(clube: string, quando: Date = new Date()): string {
  const base = `Investidura-${clube}`.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `${base}-${quando.getFullYear()}-${String(quando.getMonth() + 1).padStart(2, '0')}-${String(quando.getDate()).padStart(2, '0')}`;
}
