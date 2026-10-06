/**
 * Nome dos PDFs gerados: o navegador usa o <title> da página como nome padrão ao salvar a impressão,
 * e no celular o arquivo recebe o nome que dermos a ele. Sem isso saía algo genérico ("index", "Print…").
 */
export function nomeArquivoPdf(titulo: string): string {
  const base = titulo
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s.\-—]+/g, ' ')
    .replace(/[\s—]+/g, ' ')
    .trim()
    .replace(/\s/g, '-')
    .slice(0, 90);
  const hoje = new Date();
  const dia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  return `${base || 'Relatorio'}_${dia}`;
}

/** Coloca o nome do arquivo no <title> do HTML (o navegador o usa ao "Salvar como PDF"). */
export function htmlComTitulo(html: string, nome: string): string {
  const tag = `<title>${nome}</title>`;
  if (/<title[^>]*>[\s\S]*?<\/title>/i.test(html)) return html.replace(/<title[^>]*>[\s\S]*?<\/title>/i, tag);
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => `${m}${tag}`);
  return `${tag}${html}`;
}

/** Renomeia o PDF gerado no celular para o nome com relação ao conteúdo. Se não der, usa o original. */
export async function renomearPdf(uri: string, titulo: string): Promise<string> {
  try {
    const FileSystem = await import('expo-file-system/legacy');
    const destino = `${FileSystem.cacheDirectory}${nomeArquivoPdf(titulo)}.pdf`;
    await FileSystem.deleteAsync(destino, { idempotent: true });
    await FileSystem.copyAsync({ from: uri, to: destino });
    return destino;
  } catch {
    return uri;
  }
}
