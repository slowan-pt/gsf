import { supabase } from './supabase';
import { getClubeAtivoId, getContextoAtivo } from './contextoAtual';

/** Nome e logo do clube ativo, para o cabeçalho de todo relatório exportado. */
export interface MarcaClube {
  nome: string;
  /** data: URI (embutida no PDF) ou, se não deu para baixar, a URL pública. */
  logo: string | null;
}

function escapar(v: string) {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Web: redesenha a imagem num canvas e devolve PNG — não depende do Content-Type que o servidor mandou. */
function paraPngWeb(url: string): Promise<string | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new (window as any).Image() as HTMLImageElement;
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 256;
        canvas.height = img.naturalHeight || 256;
        canvas.getContext('2d')?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function paraDataUri(url: string): Promise<string | null> {
  const png = await paraPngWeb(url);
  if (png) return png;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise<string | null>((resolve) => {
      const leitor = new FileReader();
      leitor.onloadend = () => resolve(typeof leitor.result === 'string' ? leitor.result : null);
      leitor.onerror = () => resolve(null);
      leitor.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function obterMarcaClube(): Promise<MarcaClube> {
  const contexto = getContextoAtivo();
  let nome = contexto?.clube_nome ?? contexto?.clube_nome_curto ?? 'Clube';
  let logoUrl: string | null = null;
  try {
    const { data } = await supabase
      .from('clubes')
      .select('nome,logo_url')
      .eq('id', getClubeAtivoId())
      .maybeSingle();
    if (data?.nome) nome = data.nome;
    logoUrl = (data as any)?.logo_url ?? null;
  } catch { /* offline: segue só com o nome */ }
  const logo = logoUrl ? (await paraDataUri(logoUrl)) ?? logoUrl : null;
  return { nome, logo };
}

/**
 * Insere o logo, o nome do clube e o título no topo do relatório. Na impressão o bloco é
 * fixo: repete em TODAS as páginas (com a margem superior reservada), junto com o cabeçalho
 * da tabela (thead), que o navegador já repete sozinho quando é table-header-group.
 */
export function injetarMarca(html: string, marca: MarcaClube, titulo?: string): string {
  const estilo = `<style>
    .marca-clube{display:flex;align-items:center;gap:12px;margin:0 0 14px;padding-bottom:10px;border-bottom:2px solid #1a3a5c;background:#fff;}
    .marca-clube img{width:52px;height:52px;object-fit:contain;}
    .marca-clube .marca-nome{font-size:15px;font-weight:700;color:#1a3a5c;}
    .marca-clube .marca-titulo{margin-left:auto;font-size:13px;font-weight:600;color:#445;text-align:right;}
    thead{display:table-header-group;}
    tr{page-break-inside:avoid;break-inside:avoid;}
    @media print{
      @page{margin:98px 18px 18px 18px;}
      .marca-clube{position:fixed;top:-86px;left:0;right:0;margin:0;}
      body > h1{display:none;}
    }
  </style>`;
  const bloco = `<div class="marca-clube">${marca.logo ? `<img src="${escapar(marca.logo)}" alt="" />` : ''}<span class="marca-nome">${escapar(marca.nome)}</span>${titulo ? `<span class="marca-titulo">${escapar(titulo)}</span>` : ''}</div>`;
  let saida = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${estilo}</head>`) : `${estilo}${html}`;
  saida = /<body[^>]*>/i.test(saida) ? saida.replace(/<body[^>]*>/i, (m) => `${m}${bloco}`) : `${bloco}${saida}`;
  return saida;
}
