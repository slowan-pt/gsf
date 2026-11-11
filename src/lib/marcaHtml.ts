/**
 * Visual padrão dos relatórios em PDF/impressão (parte pura, testada com "node --test": npm run test:marca-relatorio).
 * Todo relatório HTML passa por injetarMarca(): ela põe no topo o cabeçalho com o logo do clube, o logo dos Desbravadores,
 * o nome do clube e o título, e aplica o tema único (fonte Nunito, cabeçalho roxo da tabela, linhas zebradas, cartões de resumo),
 * por cima do estilo simples de cada relatório. Relatórios com modelo externo (como o Word da Associação) não passam por aqui.
 */

/** Nome e logos do clube ativo, para o cabeçalho de todo relatório exportado. */
export interface MarcaClube {
  nome: string;
  /** data: URI (embutida no PDF) ou, se não deu para baixar, a URL pública. */
  logo: string | null;
  /** Logo dos Desbravadores (data: URI pequena). Sem ela o cabeçalho sai só com o logo do clube. */
  logoDbv?: string | null;
  /** @font-face da fonte do relatório (Nunito embutida); vazio usa as fontes do sistema. */
  fonteCss?: string;
}

/** Cores padrão dos relatórios. */
export const TEMA_RELATORIO = {
  roxo: '#4b2bb0',
  roxoClaro: '#7c39e7',
  dourado: '#f4b400',
  suave: '#f6f2fe',
  borda: '#e3dcf5',
  texto: '#1f1b33',
  mudo: '#667085',
} as const;

export const FAMILIA_FONTE_RELATORIO = "'Nunito','Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

function escapar(v: string) {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** CSS do tema. Vem depois do estilo de cada relatório, então vence os empates; fonte e cores de impressão usam !important. */
export function cssTemaRelatorio(fonteCss = ''): string {
  const t = TEMA_RELATORIO;
  return `<style>
    ${fonteCss}
    *{font-family:${FAMILIA_FONTE_RELATORIO} !important;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}
    body{color:${t.texto};}
    .rel-topo{display:flex;align-items:center;gap:14px;padding:2px 0 9px;}
    .rel-logo{width:62px;height:62px;flex:none;display:flex;align-items:center;justify-content:center;}
    .rel-logo img{max-width:100%;max-height:100%;object-fit:contain;display:block;}
    .rel-textos{flex:1;min-width:0;text-align:center;}
    .rel-clube{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:${t.roxoClaro};}
    .rel-titulo{font-size:19px;font-weight:800;line-height:1.15;color:${t.roxo};margin-top:2px;}
    .rel-faixa{height:5px;border-radius:3px;background:linear-gradient(90deg,${t.roxo},${t.roxoClaro} 60%,${t.dourado});}
    .marca-sub{margin-top:8px;color:${t.mudo};font-size:11px;font-weight:600;text-align:center;}
    table{border-collapse:collapse;}
    thead{display:table-header-group;}
    tr{page-break-inside:avoid;break-inside:avoid;}
    thead th{background:linear-gradient(180deg,#5b38cc,${t.roxo});color:#fff;font-weight:800;letter-spacing:.02em;padding:8px 7px;border:0;border-right:1px solid rgba(255,255,255,.2);}
    thead th:last-child{border-right:0;}
    thead tr.marca-linha th{background:#fff;color:${t.roxo};border:0;padding:0 0 10px;text-align:left;}
    thead + tbody td{border:0;border-bottom:1px solid ${t.borda};padding:6px 7px;}
    thead + tbody tr:nth-child(even) td{background:${t.suave};}
    strong,b{font-weight:800;}
    .resumo>div,.cards>div{border:1px solid ${t.borda};border-top:3px solid ${t.roxoClaro};border-radius:10px;background:#faf8ff;}
    .resumo b,.cards b{color:${t.roxo};}
  </style>`;
}

/**
 * Insere o cabeçalho (logo do clube, logo dos Desbravadores, nome do clube e título) e o tema no relatório. Quando há tabela,
 * o cabeçalho entra como primeira linha do <thead>: o navegador repete o thead no topo de TODAS as páginas, então logos, nome,
 * título e cabeçalho das colunas aparecem em cada página. O título grande (<h1>) e a linha "Gerado em..." passam para dentro
 * dele. Sem tabela, vira um bloco normal no início.
 */
export function injetarMarca(html: string, marca: MarcaClube, titulo?: string): string {
  const estilo = cssTemaRelatorio(marca.fonteCss);
  const img = (src: string | null | undefined, alt: string) => (src ? `<div class="rel-logo"><img src="${escapar(src)}" alt="${escapar(alt)}" /></div>` : '<div class="rel-logo"></div>');
  const faixa = `<div class="rel-topo">${img(marca.logo, 'Logo do clube')}<div class="rel-textos"><div class="rel-clube">${escapar(marca.nome)}</div>${titulo ? `<div class="rel-titulo">${escapar(titulo)}</div>` : ''}</div>${img(marca.logoDbv, 'Logo dos Desbravadores')}</div><div class="rel-faixa"></div>`;

  let saida = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${estilo}</head>`) : `${estilo}${html}`;

  if (/<thead[^>]*>/i.test(saida)) {
    const sub = saida.match(/<div class="sub">([\s\S]*?)<\/div>/);
    if (sub) saida = saida.replace(sub[0], '');
    saida = saida.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, '');
    const linha = `<tr class="marca-linha"><th colspan="99">${faixa}${sub ? `<div class="marca-sub">${sub[1]}</div>` : ''}</th></tr>`;
    return saida.replace(/<thead[^>]*>/i, (m) => `${m}${linha}`);
  }
  return /<body[^>]*>/i.test(saida) ? saida.replace(/<body[^>]*>/i, (m) => `${m}${faixa}`) : `${faixa}${saida}`;
}
