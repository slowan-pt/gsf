/**
 * Autorização para Condecoração (investidura de especialidades e classes) no modelo Word da Associação.
 * Parte pura (sem React Native nem rede): preenche o XML do modelo `assets/modelos/autorizacao-investidura-modelo.docx`,
 * preservando cabeçalho, logos e formatação, e acrescenta uma página com a relação dos investidos e as quantidades.
 * Testada com "node --test" (ver "npm run test:autorizacao-investidura").
 */
import type { ItemAguardando } from './investidura';

export interface DadosAutorizacao {
  clube: string;
  associacao: string;
  /** "Oceânica" ou "Região Oceânica". */
  regiao: string;
  instrutores: string[];
  /** Ex.: "Investidura". */
  cerimonia: string;
  /** aaaa-mm-dd */
  dataCerimonia: string;
  /** hh:mm */
  horaCerimonia: string;
  localCerimonia: string;
  autoridades: string[];
  cidade: string;
  /** aaaa-mm-dd */
  dataDocumento: string;
  diretorNome: string;
  regionalNome: string;
  coordenadorGeralNome: string;
  departamentalNome: string;
  /** Vazio deixa o número em branco para a Associação preencher. */
  registro: string;
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** aaaa-mm-dd -> "11 de julho de 2026" (vazio se inválida). */
export function dataPorExtenso(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return '';
  const mes = MESES[Number(m[2]) - 1];
  return mes ? `${Number(m[3])} de ${mes} de ${m[1]}` : '';
}

/** "10:00" -> "10h"; "10:30" -> "10h30". */
export function horaPorExtenso(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? '');
  if (!m) return '';
  return Number(m[2]) === 0 ? `${Number(m[1])}h` : `${Number(m[1])}h${m[2]}`;
}

/** "A", "A E B", "A, B E C" — como no modelo (nomes em maiúsculas, "E" antes do último). */
export function juntarComE(nomes: string[]): string {
  const l = nomes.map((n) => n.trim().toUpperCase()).filter(Boolean);
  if (l.length <= 1) return l[0] ?? '';
  return `${l.slice(0, -1).join(', ')} E ${l[l.length - 1]}`;
}

/** "A, B, C" — como na lista de autoridades do modelo. */
export function juntarComVirgula(nomes: string[]): string {
  return nomes.map((n) => n.trim().toUpperCase()).filter(Boolean).join(', ');
}

export function escXml(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ─── Relação dos investidos ───────────────────────────────────────────── */

export interface ItemRelacao {
  tipo: 'classe' | 'especialidade' | 'mestrado';
  nome: string;
  /** Código da especialidade no manual (ex.: ENB13), quando conhecido. */
  codigo: string | null;
}

export interface LinhaRelacao {
  dbvId: number;
  nome: string;
  unidade: string;
  /** aaaa-mm-dd */
  dataNascimento: string | null;
  /** aaaa-mm-dd: a conclusão mais recente entre os itens do membro. */
  concluidoEm: string | null;
  itens: ItemRelacao[];
}

/** Chave para casar nomes de especialidade ignorando caixa, acento e espaços repetidos. */
export const chaveNome = (nome: string) => nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export interface QuantidadeItem {
  tipo: 'classe' | 'especialidade' | 'mestrado';
  nome: string;
  quantidade: number;
}

export interface RelacaoInvestidura {
  linhas: LinhaRelacao[];
  quantidades: QuantidadeItem[];
  totalMembros: number;
  totalClasses: number;
  totalEspecialidades: number;
  totalMestrados: number;
}

const cmp = (a: string, b: string) => a.localeCompare(b, 'pt-BR');

const dataAte10 = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : null);

/**
 * Itens aguardando investidura -> uma linha por membro (em ordem alfabética, como no modelo) e a quantidade de cada
 * item (para providenciar as insígnias). `codigos` liga o nome da especialidade ao código do manual (chave = chaveNome).
 */
export function montarRelacao(itens: ItemAguardando[], codigos: Record<string, string> = {}): RelacaoInvestidura {
  const porMembro = new Map<number, LinhaRelacao>();
  const contagem = new Map<string, QuantidadeItem>();
  for (const i of itens) {
    const linha = porMembro.get(i.dbvId) ?? {
      dbvId: i.dbvId, nome: i.membroNome, unidade: i.unidadeNome, dataNascimento: dataAte10(i.dataNascimento), concluidoEm: null, itens: [],
    };
    linha.itens.push({ tipo: i.tipo, nome: i.nome, codigo: i.tipo === 'especialidade' ? codigos[chaveNome(i.nome)] ?? null : null });
    const conclusao = dataAte10(i.aprovadoEm);
    if (conclusao && (!linha.concluidoEm || conclusao > linha.concluidoEm)) linha.concluidoEm = conclusao;
    porMembro.set(i.dbvId, linha);
    const chave = `${i.tipo}|${i.nome}`;
    const q = contagem.get(chave) ?? { tipo: i.tipo, nome: i.nome, quantidade: 0 };
    q.quantidade += 1;
    contagem.set(chave, q);
  }
  const ordemItem = { classe: 0, especialidade: 1, mestrado: 2 } as const;
  const linhas = Array.from(porMembro.values())
    .map((l) => ({ ...l, itens: [...l.itens].sort((a, b) => ordemItem[a.tipo] - ordemItem[b.tipo] || cmp(a.nome, b.nome)) }))
    .sort((a, b) => cmp(a.nome, b.nome));
  const ordemTipo = { classe: 0, especialidade: 1, mestrado: 2 } as const;
  const quantidades = Array.from(contagem.values()).sort((a, b) => ordemTipo[a.tipo] - ordemTipo[b.tipo] || cmp(a.nome, b.nome));
  const total = (t: QuantidadeItem['tipo']) => quantidades.filter((q) => q.tipo === t).reduce((s, q) => s + q.quantidade, 0);
  return {
    linhas, quantidades,
    totalMembros: linhas.length,
    totalClasses: total('classe'),
    totalEspecialidades: total('especialidade'),
    totalMestrados: total('mestrado'),
  };
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** "Serão investidos 12 membros, com 30 especialidades e 5 classes." */
export function frasePrevisao(r: RelacaoInvestidura): string {
  const partes: string[] = [];
  if (r.totalEspecialidades) partes.push(plural(r.totalEspecialidades, 'especialidade', 'especialidades'));
  if (r.totalMestrados) partes.push(plural(r.totalMestrados, 'mestrado', 'mestrados'));
  if (r.totalClasses) partes.push(plural(r.totalClasses, 'classe', 'classes'));
  const lista = partes.length <= 1 ? (partes[0] ?? 'nenhum item') : `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
  return `${r.totalMembros === 1 ? 'Será investido' : 'Serão investidos'} ${plural(r.totalMembros, 'membro', 'membros')}, com ${lista}, conforme a relação em anexo.`;
}

/** Título do documento conforme o que será entregue. */
export function tituloDocumento(r: RelacaoInvestidura): string {
  const temEsp = r.totalEspecialidades + r.totalMestrados > 0;
  const temCla = r.totalClasses > 0;
  return `Autorização para Condecoração de ${temEsp && temCla ? 'Especialidades e Classes' : temCla ? 'Classes' : 'Especialidades'}`;
}

/* ─── Edição do XML do modelo ──────────────────────────────────────────── */

const PARAGRAFO = /<w:p[ >][\s\S]*?<\/w:p>/g;
const RUN = /<w:r[ >][\s\S]*?<\/w:r>/g;

function textoDe(xml: string): string {
  return Array.from(xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)).map((m) => m[1]).join('');
}

const rPrDe = (run: string) => /<w:rPr>[\s\S]*?<\/w:rPr>/.exec(run)?.[0] ?? '';

interface Segmento {
  /** Índice (entre todos os runs do parágrafo original) de onde copiar a formatação. */
  run: number;
  texto?: string;
  tab?: boolean;
}

/**
 * Reescreve o parágrafo de número `indice` mantendo as propriedades dele e a formatação dos runs indicados.
 * `esperado` precisa aparecer no texto original: se o modelo mudar, falha em vez de preencher o lugar errado.
 */
function reescreverParagrafo(xml: string, indice: number, esperado: string, segmentos: Segmento[]): string {
  let n = -1;
  return xml.replace(PARAGRAFO, (par) => {
    n++;
    if (n !== indice) return par;
    if (!textoDe(par).includes(esperado)) {
      throw new Error(`O modelo do Word mudou: esperava "${esperado}" no parágrafo ${indice}.`);
    }
    const abertura = /^<w:p[^>]*>/.exec(par)![0];
    const pPr = /<w:pPr>[\s\S]*?<\/w:pPr>/.exec(par)?.[0] ?? '';
    const runs = Array.from(par.matchAll(RUN)).map((m) => m[0]);
    const novos = segmentos.map((s) => {
      const rPr = rPrDe(runs[s.run] ?? runs[0] ?? '');
      return s.tab ? `<w:r>${rPr}<w:tab/></w:r>` : `<w:r>${rPr}<w:t xml:space="preserve">${escXml(s.texto ?? '')}</w:t></w:r>`;
    });
    return `${abertura}${pPr}${novos.join('')}</w:p>`;
  });
}

const regiaoSemPrefixo = (r: string) => r.replace(/^\s*regi[ãa]o\s+/i, '').trim();

export function preencherDocumento(documentXml: string, d: DadosAutorizacao, rel: RelacaoInvestidura): string {
  let x = documentXml;
  const assoc = d.associacao.trim();
  const ano = /^(\d{4})/.exec(d.dataDocumento)?.[1] ?? String(new Date().getFullYear());
  const diretoria = d.instrutores.filter((i) => i.trim()).length;

  x = reescreverParagrafo(x, 0, 'Especialidades', [{ run: 0, texto: tituloDocumento(rel) }]);
  x = reescreverParagrafo(x, 3, 'Nome do Clube', [
    { run: 0, texto: 'Nome do Clube: ' }, { run: 2, texto: d.clube.trim().toUpperCase() }, { run: 3, texto: '   ' },
  ]);
  x = reescreverParagrafo(x, 5, 'Responsáve', [
    { run: 0, texto: diretoria === 1 ? 'Instrutor Responsável: ' : 'Instrutores Responsáveis: ' },
    { run: 6, texto: juntarComE(d.instrutores) },
  ]);

  const quando = [dataPorExtenso(d.dataCerimonia) && `no dia ${dataPorExtenso(d.dataCerimonia)}`, horaPorExtenso(d.horaCerimonia) && `às ${horaPorExtenso(d.horaCerimonia)}`].filter(Boolean).join(' ');
  const local = d.localCerimonia.trim() ? ` na ${d.localCerimonia.trim().toUpperCase()}` : '';
  const frase = `Solicito autorização para Cerimônia de ${d.cerimonia.trim() || 'Investidura'}, a ser realizada${quando ? ` ${quando}` : ''}${local}. `
    + `Estarão presentes as seguintes Autoridades Eclesiásticas e Líderes de Desbravadores: ${juntarComVirgula(d.autoridades)}. ${frasePrevisao(rel)}`;
  x = reescreverParagrafo(x, 21, 'Solicito autorização', [{ run: 0, tab: true }, { run: 1, texto: frase }]);

  const cidadeData = [d.cidade.trim(), dataPorExtenso(d.dataDocumento)].filter(Boolean).join(', ');
  x = reescreverParagrafo(x, 23, 'junho', [{ run: 0, texto: cidadeData }]);
  x = reescreverParagrafo(x, 28, 'LUCIANO', [{ run: 0, texto: d.diretorNome.trim().toUpperCase() }]);
  x = reescreverParagrafo(x, 38, 'LILLIAN', [{ run: 0, texto: d.regionalNome.trim().toUpperCase() }]);
  x = reescreverParagrafo(x, 40, 'Região', [{ run: 0, texto: `Região ${regiaoSemPrefixo(d.regiao)}` }]);
  x = reescreverParagrafo(x, 43, 'LUCAS', [{ run: 0, texto: `     ${d.coordenadorGeralNome.trim().toUpperCase()} ` }]);
  x = reescreverParagrafo(x, 45, 'Associação', [{ run: 0, texto: assoc }]);
  x = reescreverParagrafo(x, 51, 'autorizo', [{ run: 0, texto: `Em nome da ${assoc}, autorizo a realização da Investidura supracitada.` }]);
  x = reescreverParagrafo(x, 55, 'HENRIQUE', [{ run: 0, texto: d.departamentalNome.trim().toUpperCase() }]);
  x = reescreverParagrafo(x, 57, 'Associação', [{ run: 0, texto: ` ${assoc}` }]);
  x = reescreverParagrafo(x, 59, 'REGISTRO', [{ run: 0, texto: `REGISTRO: n° ${d.registro.trim() || '__________'}/ ${ano}` }]);
  return x;
}

/** Cabeçalho: "ASSOCIAÇÃO ..." e "REGIÃO ...". */
export function preencherCabecalho(headerXml: string, d: DadosAutorizacao): string {
  const regiao = regiaoSemPrefixo(d.regiao).toUpperCase();
  if (!headerXml.includes('ASSOCIAÇÃO RIO FLUMINENSE') || !headerXml.includes('OCEÂNICA')) {
    throw new Error('O modelo do Word mudou: cabeçalho inesperado.');
  }
  return headerXml
    .replace('ASSOCIAÇÃO RIO FLUMINENSE', escXml(d.associacao.trim().toUpperCase()))
    .replace('OCEÂNICA', escXml(regiao));
}

/* ─── Página anexa (relação dos investidos) ────────────────────────────── */

const FONTE = '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>';

function par(texto: string, o: { b?: boolean; sz?: number; jc?: 'center' | 'left' | 'right'; depois?: number } = {}): string {
  const rPr = `<w:rPr>${FONTE}${o.b ? '<w:b/>' : ''}<w:sz w:val="${o.sz ?? 20}"/><w:szCs w:val="${o.sz ?? 20}"/><w:lang w:val="pt-BR"/></w:rPr>`;
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="${o.depois ?? 80}"/><w:jc w:val="${o.jc ?? 'left'}"/></w:pPr><w:r>${rPr}<w:t xml:space="preserve">${escXml(texto)}</w:t></w:r></w:p>`;
}

function celula(texto: string, largura: number, o: { b?: boolean; sombra?: boolean; jc?: 'center' | 'left' | 'right' } = {}): string {
  const rPr = `<w:rPr>${FONTE}${o.b ? '<w:b/>' : ''}<w:sz w:val="16"/><w:szCs w:val="16"/><w:lang w:val="pt-BR"/></w:rPr>`;
  return `<w:tc><w:tcPr><w:tcW w:w="${largura}" w:type="dxa"/>${o.sombra ? '<w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/>' : ''}</w:tcPr>`
    + `<w:p><w:pPr><w:spacing w:before="20" w:after="20"/><w:jc w:val="${o.jc ?? 'left'}"/></w:pPr><w:r>${rPr}<w:t xml:space="preserve">${escXml(texto)}</w:t></w:r></w:p></w:tc>`;
}

function tabela(larguras: number[], cabecalho: string[], linhas: { texto: string; jc?: 'center' | 'left' | 'right' }[][]): string {
  const borda = (l: string) => `<w:${l} w:val="single" w:sz="4" w:space="0" w:color="808080"/>`;
  const grade = `<w:tblGrid>${larguras.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;
  const cab = `<w:tr><w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>${cabecalho.map((t, i) => celula(t, larguras[i], { b: true, sombra: true })).join('')}</w:tr>`;
  const corpo = linhas.map((l) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${l.map((c, i) => celula(c.texto, larguras[i], { jc: c.jc })).join('')}</w:tr>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="${larguras.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(borda).join('')}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr>${grade}${cab}${corpo}</w:tbl>`;
}

const ROTULO_TIPO = { classe: 'Classe', especialidade: 'Especialidade', mestrado: 'Mestrado' } as const;

/** Página extra: quantidade de cada item (para providenciar as insígnias). Fora do modelo da Associação; é opcional. */
export function montarAnexo(d: DadosAutorizacao, rel: RelacaoInvestidura): string {
  const quantidades = tabela(
    [1700, 7338, 1000],
    ['Tipo', 'Item', 'Qtd.'],
    [
      ...rel.quantidades.map((q) => [{ texto: ROTULO_TIPO[q.tipo] }, { texto: q.nome }, { texto: String(q.quantidade), jc: 'center' as const }]),
      [{ texto: '' }, { texto: 'Total de itens' }, { texto: String(rel.totalClasses + rel.totalEspecialidades + rel.totalMestrados), jc: 'center' as const }],
    ],
  );
  return [
    par('QUANTIDADE DE CADA ITEM', { b: true, sz: 24, jc: 'center', depois: 40 }),
    par(`${d.clube.trim().toUpperCase()}${d.dataCerimonia ? ` · Cerimônia em ${dataPorExtenso(d.dataCerimonia)}` : ''}`, { jc: 'center', depois: 120 }),
    par(frasePrevisao(rel).replace(', conforme a relação em anexo', ''), { depois: 160 }),
    quantidades,
    par('', { depois: 0 }),
  ].join('');
}

/* ─── Tabela dos investidos (no lugar das imagens do modelo) ───────────── */

const dataCurta = (iso: string | null) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};

function celulaMulti(linhas: { texto: string; b?: boolean }[], largura: number, o: { sombra?: boolean } = {}): string {
  const rPr = (b?: boolean) => `<w:rPr>${FONTE}${b ? '<w:b/>' : ''}<w:sz w:val="16"/><w:szCs w:val="16"/><w:lang w:val="pt-BR"/></w:rPr>`;
  const paragrafos = (linhas.length ? linhas : [{ texto: '' }]).map((l) =>
    `<w:p><w:pPr><w:spacing w:before="20" w:after="20"/><w:jc w:val="center"/></w:pPr><w:r>${rPr(l.b)}<w:t xml:space="preserve">${escXml(l.texto)}</w:t></w:r></w:p>`).join('');
  return `<w:tc><w:tcPr><w:tcW w:w="${largura}" w:type="dxa"/>${o.sombra ? '<w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/>' : ''}<w:vAlign w:val="center"/></w:tcPr>${paragrafos}</w:tc>`;
}

function rotuloItem(i: ItemRelacao, comTipo: boolean): string {
  if (i.tipo === 'especialidade') return i.codigo ? `${i.nome} (${i.codigo})` : i.nome;
  if (i.tipo === 'classe') return comTipo ? `Classe ${i.nome}` : i.nome;
  return `${i.nome} (Mestrado)`;
}

/**
 * Tabela da relação dos investidos, no formato do modelo: Nome | Data de Nascimento | Data da Conclusão dos Requisitos |
 * Especialidades (código), cabeçalho repetido em cada página e linhas que não se partem entre páginas.
 */
export function montarTabelaInvestidos(rel: RelacaoInvestidura): string {
  const temClasse = rel.totalClasses > 0 || rel.totalMestrados > 0;
  const titulo4 = temClasse ? 'Especialidades e classes (código)' : 'Especialidades (código)';
  const larguras = [2900, 1500, 1700, 3938];
  const borda = (l: string) => `<w:${l} w:val="single" w:sz="4" w:space="0" w:color="808080"/>`;
  const cab = `<w:tr><w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>${
    ['Nome', 'Data de Nascimento', 'Data da Conclusão dos Requisitos', titulo4].map((t, i) => celulaMulti([{ texto: t, b: true }], larguras[i], { sombra: true })).join('')}</w:tr>`;
  const corpo = rel.linhas.map((l) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${[
    celulaMulti([{ texto: l.nome, b: true }], larguras[0]),
    celulaMulti([{ texto: dataCurta(l.dataNascimento) }], larguras[1]),
    celulaMulti([{ texto: dataCurta(l.concluidoEm) }], larguras[2]),
    celulaMulti(l.itens.map((i) => ({ texto: rotuloItem(i, temClasse), b: i.tipo !== 'especialidade' })), larguras[3]),
  ].join('')}</w:tr>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="${larguras.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:jc w:val="center"/><w:tblBorders>${
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(borda).join('')}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${
    larguras.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${cab}${corpo}</w:tbl>${par('', { depois: 60 })}`;
}

/**
 * O modelo traz a tabela dos investidos como seis imagens coladas (páginas de uma planilha). Troca todas elas
 * pela tabela gerada. Deve rodar DEPOIS de preencherDocumento, que usa a numeração original dos parágrafos.
 */
export function substituirImagensPelaTabela(documentXml: string, tabelaXml: string): string {
  const todos = Array.from(documentXml.matchAll(PARAGRAFO));
  const comImagem = todos.map((m, i) => ({ m, i })).filter(({ m }) => m[0].includes('<w:drawing'));
  if (comImagem.length === 0) throw new Error('O modelo do Word mudou: imagens da tabela não encontradas.');
  const primeiro = comImagem[0].i;
  const ultimo = comImagem[comImagem.length - 1].i;
  // O trecho entre a primeira e a última imagem (e o parágrafo vazio logo antes do texto da solicitação) não pode ter texto.
  const ate = todos.findIndex((m) => textoDe(m[0]).includes('Solicito autorização'));
  if (ate < 0 || ate <= ultimo) throw new Error('O modelo do Word mudou: texto da solicitação não encontrado depois das imagens.');
  for (let k = primeiro; k < ate; k++) {
    if (textoDe(todos[k][0]).trim()) throw new Error('O modelo do Word mudou: há texto entre as imagens da tabela.');
  }
  const inicio = todos[primeiro].index!;
  const fim = todos[ate - 1].index! + todos[ate - 1][0].length;
  return removerMarcadoresOrfaos(`${documentXml.slice(0, inicio)}${tabelaXml}${documentXml.slice(fim)}`);
}

/** Marcadores de fim (bookmarkEnd) cujo início foi removido junto com as imagens. */
function removerMarcadoresOrfaos(xml: string): string {
  const inicios = new Set(Array.from(xml.matchAll(/<w:bookmarkStart[^>]*w:id="(\d+)"/g)).map((m) => m[1]));
  return xml.replace(/<w:bookmarkEnd[^>]*w:id="(\d+)"[^>]*\/>/g, (m, id) => (inicios.has(id) ? m : ''));
}

/**
 * Acrescenta o anexo numa nova página, com o mesmo cabeçalho da primeira. A seção final do modelo passa a terminar
 * num parágrafo, e uma seção nova (próxima página) abriga o anexo.
 */
export function anexarRelacao(documentXml: string, anexoXml: string): string {
  const fim = documentXml.lastIndexOf('<w:sectPr');
  const fimBody = documentXml.lastIndexOf('</w:body>');
  if (fim < 0 || fimBody < 0 || fim > fimBody) throw new Error('O modelo do Word mudou: seção final não encontrada.');
  const sectFinal = documentXml.slice(fim, fimBody);
  const antes = documentXml.slice(0, fim);
  const encerra = `<w:p><w:pPr><w:spacing w:before="0" w:after="0"/>${sectFinal}</w:pPr></w:p>`;
  const novaSecao = '<w:sectPr><w:headerReference w:type="default" r:id="rId17"/><w:type w:val="nextPage"/><w:pgSz w:w="11910" w:h="16840"/>'
    + '<w:pgMar w:top="284" w:right="851" w:bottom="426" w:left="1021" w:header="720" w:footer="720" w:gutter="0"/><w:cols w:space="720"/></w:sectPr>';
  return `${antes}${encerra}${anexoXml}${novaSecao}${documentXml.slice(fimBody)}`;
}

/** Texto digitado (um nome por linha, ou separados por ";") -> lista sem vazios nem repetidos. */
export function listaDeTexto(texto: string): string[] {
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const parte of String(texto ?? '').split(/[\n;]+/)) {
    const nome = parte.trim();
    if (nome && !vistos.has(nome.toLowerCase())) { vistos.add(nome.toLowerCase()); saida.push(nome); }
  }
  return saida;
}

/** Nome do arquivo gerado. */
export function nomeArquivoAutorizacao(d: DadosAutorizacao): string {
  const base = `Autorizacao-Investidura-${d.clube}`.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `${base}-${d.dataCerimonia || new Date().toISOString().slice(0, 10)}`;
}
