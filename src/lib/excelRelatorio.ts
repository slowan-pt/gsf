import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { avisar } from '../stores/avisoStore';
import { obterMarcaClube } from './marcaRelatorio';
import { obterLogoDesbravadores } from './logoDesbravadores';
import { base64ParaBytes, bytesParaBase64 } from './logoClube';
import {
  gerarXlsxRelatorio, lerImagemPlanilha, nomeArquivoRelatorioXlsx,
  type AbaRelatorio, type BlocoRelatorio, type FormatoColuna, type ImagemPlanilha, type Valor,
} from './xlsxRelatorioNucleo';

/**
 * Entrega dos relatórios em Excel no visual padrão (faixa com os logos do clube e dos Desbravadores, tabela roxa zebrada).
 * A montagem do arquivo fica em xlsxRelatorioNucleo.ts; aqui ficam os logos, o nome do arquivo e o download/compartilhamento.
 */

export const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Logo do clube em bytes (PNG ou JPEG). Sem logo, ou em outro formato, a planilha sai só com o nome do clube. */
export async function logoDoClubeParaPlanilha(logo: string | null): Promise<ImagemPlanilha | null> {
  if (!logo) return null;
  try {
    let bytes: Uint8Array;
    if (logo.startsWith('data:')) {
      bytes = base64ParaBytes(logo.slice(logo.indexOf(',') + 1));
    } else {
      const r = await fetch(logo);
      if (!r.ok) return null;
      bytes = new Uint8Array(await r.arrayBuffer());
    }
    return lerImagemPlanilha(bytes);
  } catch {
    return null;
  }
}

/** Os dois logos do cabeçalho: do clube e dos Desbravadores (o que não carregar fica de fora). */
export async function logosDoRelatorio(): Promise<{ nomeClube: string; logoClube: ImagemPlanilha | null; logoDbv: ImagemPlanilha | null }> {
  const marca = await obterMarcaClube();
  const [logoClube, dbv] = await Promise.all([logoDoClubeParaPlanilha(marca.logo), obterLogoDesbravadores().catch(() => null)]);
  return { nomeClube: marca.nome, logoClube, logoDbv: dbv ? lerImagemPlanilha(dbv.bytes) : null };
}

/** Baixa o arquivo na web; no celular abre o compartilhamento (Excel, Drive, e-mail...). */
export async function entregarXlsx(bytes: Uint8Array, nome: string): Promise<void> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: MIME_XLSX }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${nome}.xlsx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    return;
  }
  const FileSystem = await import('expo-file-system/legacy');
  const caminho = `${FileSystem.cacheDirectory}${nome}.xlsx`;
  await FileSystem.writeAsStringAsync(caminho, bytesParaBase64(bytes), { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(caminho, { mimeType: MIME_XLSX, dialogTitle: nome, UTI: 'org.openxmlformats.spreadsheetml.sheet' });
  } else {
    avisar(caminho, 'sucesso', 'Excel gerado');
  }
}

/** Gera o Excel do relatório no visual padrão e o entrega. `nomeArquivo` é opcional (padrão: o título com a data). */
export async function baixarRelatorioXlsx(titulo: string, abas: AbaRelatorio[], nomeArquivo?: string): Promise<void> {
  const { nomeClube, logoClube, logoDbv } = await logosDoRelatorio();
  const bytes = gerarXlsxRelatorio({ clube: nomeClube, titulo, logoClube, logoDbv, abas });
  await entregarXlsx(bytes, nomeArquivo ?? nomeArquivoRelatorioXlsx(titulo));
}

/** Matriz com o cabeçalho na primeira linha (formato antigo dos relatórios) -> bloco de tabela do visual padrão. */
export function tabelaDeMatriz(
  matriz: Valor[][],
  opcoes: { titulo?: string; formatos?: (FormatoColuna | undefined)[]; larguras?: (number | undefined)[] } = {},
): BlocoRelatorio {
  const [cab = [], ...linhas] = matriz;
  return {
    tipo: 'tabela',
    titulo: opcoes.titulo,
    colunas: cab.map((c, k) => ({ titulo: String(c ?? ''), formato: opcoes.formatos?.[k], largura: opcoes.larguras?.[k] })),
    linhas,
  };
}
