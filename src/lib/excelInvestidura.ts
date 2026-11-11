import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { avisar } from '../stores/avisoStore';
import { obterMarcaClube } from './marcaRelatorio';
import { codigosDasEspecialidades } from './autorizacaoInvestidura';
import { base64ParaBytes, bytesParaBase64 } from './logoClube';
import type { ItemAguardando } from './investidura';
import { gerarExcelInvestidura, lerImagem, montarPlanilha, nomeArquivoExcel, type LogoExcel } from './excelInvestituraNucleo';

/**
 * Excel de investidura com valores (modelo da aba "Investidura" da planilha do clube): itens nas linhas, membros nas
 * colunas, preços do Bazar dos Desbravadores e logo do clube. A montagem do arquivo fica em excelInvestituraNucleo.ts.
 */

const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Logo do clube em bytes (PNG ou JPEG). Sem logo, ou em outro formato, o Excel sai só com o nome do clube. */
async function logoDoClube(logo: string | null): Promise<LogoExcel | null> {
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
    return lerImagem(bytes);
  } catch {
    return null;
  }
}

async function entregar(bytes: Uint8Array, nome: string): Promise<void> {
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

/** Gera e entrega o Excel com os itens aguardando investidura (todos os que forem passados). */
export async function exportarExcelInvestidura(itens: ItemAguardando[]): Promise<void> {
  if (itens.length === 0) { avisar('Nenhum item aguardando investidura.', 'info', 'Excel'); return; }
  try {
    const [marca, codigos] = await Promise.all([obterMarcaClube(), codigosDasEspecialidades()]);
    const plano = montarPlanilha(itens, codigos);
    const total = plano.grupos.reduce((s, g) => s + g.linhas.reduce((n, l) => n + l.marcas.filter(Boolean).length, 0), 0);
    const bytes = gerarExcelInvestidura(plano, {
      clube: marca.nome,
      logo: await logoDoClube(marca.logo),
      subtitulo: `Investidura · ${plano.membros.length} ${plano.membros.length === 1 ? 'membro' : 'membros'} · ${total} ${total === 1 ? 'item' : 'itens'}`,
    });
    await entregar(bytes, nomeArquivoExcel(marca.nome));
  } catch (e: any) {
    avisar(e?.message ?? 'Não foi possível gerar o Excel.', 'erro', 'Excel');
  }
}
