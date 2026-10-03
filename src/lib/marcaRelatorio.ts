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

/** Insere o logo e o nome do clube no topo do HTML de um relatório (logo depois de <body>). */
export function injetarMarca(html: string, marca: MarcaClube): string {
  const estilo = `<style>
    .marca-clube{display:flex;align-items:center;gap:12px;margin:0 0 14px;padding-bottom:10px;border-bottom:2px solid #1a3a5c;}
    .marca-clube img{width:56px;height:56px;object-fit:contain;}
    .marca-clube span{font-size:16px;font-weight:700;color:#1a3a5c;}
  </style>`;
  const bloco = `<div class="marca-clube">${marca.logo ? `<img src="${escapar(marca.logo)}" alt="" />` : ''}<span>${escapar(marca.nome)}</span></div>`;
  let saida = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${estilo}</head>`) : `${estilo}${html}`;
  saida = /<body[^>]*>/i.test(saida) ? saida.replace(/<body[^>]*>/i, (m) => `${m}${bloco}`) : `${bloco}${saida}`;
  return saida;
}
