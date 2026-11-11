/**
 * PDF dos relatórios na web: gera o arquivo .pdf de verdade e baixa direto, sem abrir a janela de impressão.
 * O HTML do relatório é desenhado fora da tela, dividido em páginas A4 (a tabela quebra só entre linhas e repete o cabeçalho,
 * com os logos, no topo de cada página) e cada página vira uma imagem nítida dentro do PDF, com "Página x de y" no rodapé.
 * No celular o PDF já é gerado pelo expo-print (ver abrirPDF); isto vale só para a web.
 */
import { nomeArquivoPdf } from './pdfArquivo';

const MM_POR_PX = 25.4 / 96;
const A4_PX = { largura: 794, altura: 1123 };
/** Espaço extra no pé da página para o "Página x de y". */
const RODAPE_PX = 26;
const ESCALA = 2;

interface Bibliotecas {
  jsPDF: new (opcoes: { orientation: 'p' | 'l'; unit: 'mm'; format: 'a4'; compress: boolean }) => any;
  html2canvas: (el: HTMLElement, opcoes: Record<string, unknown>) => Promise<HTMLCanvasElement>;
}

/** Papel e margem pedidos pelo próprio relatório (@page { size: A4 landscape; margin: 18px }). */
export function lerConfiguracaoDaPagina(html: string): { paisagem: boolean; margemPx: number } {
  const regra = /@page\s*\{([^}]*)\}/i.exec(html)?.[1] ?? '';
  const paisagem = /size\s*:\s*A4\s+landscape/i.test(regra);
  const margem = /margin\s*:\s*(\d+(?:\.\d+)?)px/i.exec(regra);
  return { paisagem, margemPx: margem ? Math.min(60, Number(margem[1])) : 18 };
}

async function carregarBibliotecas(): Promise<Bibliotecas> {
  const [pdf, canvas] = await Promise.all([import('jspdf'), import('html2canvas')]);
  const jsPDF = (pdf as any).jsPDF ?? (pdf as any).default?.jsPDF ?? (pdf as any).default;
  const html2canvas = (canvas as any).default ?? canvas;
  return { jsPDF, html2canvas };
}

function esperar(ms: number) { return new Promise<void>((ok) => setTimeout(ok, ms)); }

/** Espera as imagens e a fonte do relatório carregarem (com limite de tempo, para não travar). */
async function aguardarRecursos(doc: Document): Promise<void> {
  const imagens = Array.from(doc.images);
  await Promise.all(imagens.map((img) => (img.complete ? Promise.resolve() : new Promise<void>((ok) => {
    img.onload = () => ok();
    img.onerror = () => ok();
    setTimeout(ok, 5000);
  }))));
  try { await Promise.race([(doc as any).fonts?.ready ?? Promise.resolve(), esperar(3000)]); } catch { /* segue */ }
}

/** Fotos vindas da internet viram dados embutidos, para o desenho da página não depender de permissão do servidor. */
async function embutirImagensRemotas(doc: Document): Promise<void> {
  const remotas = Array.from(doc.images).filter((i) => /^https?:/i.test(i.src));
  await Promise.all(remotas.map(async (img) => {
    try {
      const r = await fetch(img.src, { mode: 'cors' });
      if (!r.ok) return;
      const blob = await r.blob();
      const dataUri: string = await new Promise((ok, falha) => {
        const leitor = new FileReader();
        leitor.onload = () => ok(String(leitor.result));
        leitor.onerror = () => falha(new Error('leitura'));
        leitor.readAsDataURL(blob);
      });
      img.src = dataUri;
      await new Promise<void>((ok) => { if (img.complete) ok(); else { img.onload = () => ok(); img.onerror = () => ok(); setTimeout(ok, 3000); } });
    } catch { /* fica como está; o desenho tenta com CORS */ }
  }));
}

interface Unidade { tabela?: HTMLTableElement; linha?: HTMLTableRowElement; bloco?: HTMLElement }

/** Divide o conteúdo em páginas: blocos inteiros e linhas inteiras de tabela, com o cabeçalho da tabela repetido. */
function montarPaginas(doc: Document, larguraConteudo: number, alturaConteudo: number, margemPx: number): HTMLElement[] {
  const corpo = doc.body;
  const unidades: Unidade[] = [];
  for (const filho of Array.from(corpo.children) as HTMLElement[]) {
    if (/^(SCRIPT|STYLE|LINK|META)$/.test(filho.tagName)) continue;
    if (filho.tagName === 'TABLE') {
      const tabela = filho as HTMLTableElement;
      const linhas = Array.from(tabela.tBodies).flatMap((tb) => Array.from(tb.rows));
      if (linhas.length === 0) unidades.push({ bloco: tabela });
      for (const linha of linhas) unidades.push({ tabela, linha });
    } else {
      unidades.push({ bloco: filho });
    }
  }

  const area = doc.createElement('div');
  area.style.cssText = 'position:absolute;left:0;top:0;';
  const paginas: HTMLElement[] = [];
  let atual = null as HTMLElement | null;
  let tabelaAtual = null as { origem: HTMLTableElement; corpo: HTMLTableSectionElement } | null;

  const novaPagina = () => {
    const pg = doc.createElement('div');
    pg.className = 'pagina-pdf';
    pg.style.cssText = `width:${larguraConteudo}px;padding:${margemPx}px;background:#fff;box-sizing:content-box;margin:0 0 24px 0;`;
    area.appendChild(pg);
    paginas.push(pg);
    atual = pg;
    tabelaAtual = null;
    return pg;
  };
  const estoura = (pg: HTMLElement) => pg.getBoundingClientRect().height - margemPx * 2 > alturaConteudo;
  // Larguras das colunas da tabela original (medidas uma vez), para todas as páginas ficarem com as colunas iguais.
  const larguras = new Map<HTMLTableElement, number[]>();
  const medirColunas = (origem: HTMLTableElement) => {
    if (!larguras.has(origem)) {
      const primeira = origem.tBodies[0]?.rows[0];
      larguras.set(origem, primeira ? Array.from(primeira.cells).map((c) => c.getBoundingClientRect().width) : []);
    }
    return larguras.get(origem)!;
  };
  const novaTabelaNaPagina = (pg: HTMLElement, origem: HTMLTableElement) => {
    const t = origem.cloneNode(false) as HTMLTableElement;
    const cols = medirColunas(origem);
    if (cols.length > 0 && !origem.querySelector('colgroup')) {
      const grupo = doc.createElement('colgroup');
      for (const w of cols) { const c = doc.createElement('col'); c.style.width = `${w}px`; grupo.appendChild(c); }
      t.appendChild(grupo);
      t.style.tableLayout = 'fixed';
      t.style.width = `${cols.reduce((a, b) => a + b, 0)}px`;
    }
    for (const filho of Array.from(origem.children)) {
      if (filho.tagName === 'COLGROUP' || filho.tagName === 'THEAD') t.appendChild(filho.cloneNode(true));
    }
    const tb = doc.createElement('tbody');
    t.appendChild(tb);
    pg.appendChild(t);
    tabelaAtual = { origem, corpo: tb };
  };

  doc.body.appendChild(area);
  novaPagina();
  for (const u of unidades) {
    const pg0: HTMLElement = atual!;
    if (u.linha && u.tabela) {
      if (!tabelaAtual || tabelaAtual.origem !== u.tabela) novaTabelaNaPagina(pg0, u.tabela);
      const copia = u.linha.cloneNode(true) as HTMLTableRowElement;
      tabelaAtual!.corpo.appendChild(copia);
      if (estoura(pg0) && tabelaAtual!.corpo.rows.length > 1) {
        copia.remove();
        const pg = novaPagina();
        novaTabelaNaPagina(pg, u.tabela);
        tabelaAtual!.corpo.appendChild(copia);
      }
    } else if (u.bloco) {
      const copia = u.bloco.cloneNode(true) as HTMLElement;
      pg0.appendChild(copia);
      tabelaAtual = null;
      if (estoura(pg0) && pg0.children.length > 1) {
        copia.remove();
        novaPagina().appendChild(copia);
      }
    }
  }
  return paginas;
}

/** Gera o PDF (como arquivo) a partir do HTML do relatório. `libs` só existe para testes. */
export async function gerarPdfDeHtml(html: string, titulo: string, libs?: Bibliotecas): Promise<Blob> {
  const { jsPDF, html2canvas } = libs ?? (await carregarBibliotecas());
  const { paisagem, margemPx } = lerConfiguracaoDaPagina(html);
  const papel = paisagem ? { largura: A4_PX.altura, altura: A4_PX.largura } : A4_PX;
  const larguraConteudo = papel.largura - margemPx * 2;
  const alturaConteudo = papel.altura - margemPx * 2 - RODAPE_PX;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = `position:fixed;left:-20000px;top:0;width:${papel.largura}px;height:${papel.altura}px;border:0;`;
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(html);
    doc.close();
    // O relatório original é medido já com a largura útil da página (papel menos as margens).
    doc.body.style.cssText += `;margin:0;padding:${margemPx}px;box-sizing:border-box;width:${papel.largura}px;`;
    iframe.style.height = '4000px';
    await aguardarRecursos(doc);
    await embutirImagensRemotas(doc);

    const paginas = montarPaginas(doc, larguraConteudo, alturaConteudo, margemPx);
    const pdf = new jsPDF({ orientation: paisagem ? 'l' : 'p', unit: 'mm', format: 'a4', compress: true });
    pdf.setProperties({ title: titulo });
    const larguraMm = papel.largura * MM_POR_PX;
    const alturaMm = papel.altura * MM_POR_PX;

    for (let i = 0; i < paginas.length; i++) {
      const canvas = await html2canvas(paginas[i], { scale: ESCALA, backgroundColor: '#ffffff', useCORS: true, logging: false });
      if (i > 0) pdf.addPage('a4', paisagem ? 'l' : 'p');
      const imagem = canvas.toDataURL('image/jpeg', 0.92);
      pdf.addImage(imagem, 'JPEG', 0, 0, larguraMm, Math.min(alturaMm, (canvas.height / ESCALA) * MM_POR_PX), undefined, 'FAST');
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(102, 112, 133);
      pdf.text(`Página ${i + 1} de ${paginas.length}`, larguraMm - 8, alturaMm - 5, { align: 'right' });
    }
    return pdf.output('blob') as Blob;
  } finally {
    iframe.remove();
  }
}

/** Gera o PDF do relatório e o baixa com o nome do relatório (sem abrir a janela de impressão). */
export async function baixarPdfDeHtml(html: string, titulo: string): Promise<void> {
  const blob = await gerarPdfDeHtml(html, titulo);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nomeArquivoPdf(titulo)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
