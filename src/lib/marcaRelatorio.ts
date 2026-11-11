import { supabase } from './supabase';
import { getClubeAtivoId, getContextoAtivo } from './contextoAtual';
import { obterLogoDesbravadores } from './logoDesbravadores';
import type { MarcaClube } from './marcaHtml';

// O desenho do cabeçalho e o tema ficam em marcaHtml.ts (parte pura, testável); aqui fica a busca dos dados (rede, logos).
export { injetarMarca } from './marcaHtml';
export type { MarcaClube } from './marcaHtml';

let fonteCssCache: string | null = null;
/** @font-face da Nunito embutida (carregada só quando um relatório é gerado, para não pesar o início do app). */
async function carregarFonteCss(): Promise<string> {
  if (fonteCssCache !== null) return fonteCssCache;
  try {
    const { NUNITO_WOFF2_BASE64 } = await import('./fonteRelatorio');
    fonteCssCache = `@font-face{font-family:'Nunito';font-style:normal;font-weight:200 1000;font-display:block;src:url(data:font/woff2;base64,${NUNITO_WOFF2_BASE64}) format('woff2');}`;
  } catch {
    fonteCssCache = '';
  }
  return fonteCssCache;
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
  const [logoDbv, fonteCss] = await Promise.all([
    obterLogoDesbravadores().then((l) => l?.dataUri ?? null, () => null),
    carregarFonteCss(),
  ]);
  return { nome, logo, logoDbv, fonteCss };
}

/** Na web, espera a fonte do relatório carregar antes de imprimir (senão o PDF sairia com a fonte do sistema). */
export async function aguardarFontes(doc: { fonts?: { ready?: Promise<unknown> } } | null | undefined): Promise<void> {
  try {
    await Promise.race([doc?.fonts?.ready ?? Promise.resolve(), new Promise((ok) => setTimeout(ok, 2500))]);
  } catch { /* imprime mesmo assim */ }
}
