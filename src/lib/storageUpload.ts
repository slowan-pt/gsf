import { File } from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { Platform } from 'react-native';

function base64ParaArrayBuffer(base64: string): ArrayBuffer {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const limpo = base64.replace(/[\r\n\s]/g, '');
  const padding = limpo.endsWith('==') ? 2 : limpo.endsWith('=') ? 1 : 0;
  const bytesLen = Math.floor((limpo.length * 3) / 4) - padding;
  const bytes = new Uint8Array(bytesLen);

  let byteIndex = 0;
  for (let i = 0; i < limpo.length; i += 4) {
    const c1 = chars.indexOf(limpo[i]);
    const c2 = chars.indexOf(limpo[i + 1]);
    const c3 = limpo[i + 2] === '=' ? 0 : chars.indexOf(limpo[i + 2]);
    const c4 = limpo[i + 3] === '=' ? 0 : chars.indexOf(limpo[i + 3]);
    const n = (c1 << 18) | (c2 << 12) | (c3 << 6) | c4;

    if (byteIndex < bytesLen) bytes[byteIndex++] = (n >> 16) & 255;
    if (byteIndex < bytesLen) bytes[byteIndex++] = (n >> 8) & 255;
    if (byteIndex < bytesLen) bytes[byteIndex++] = n & 255;
  }

  return bytes.buffer;
}

export type UploadBody = Blob | ArrayBuffer | Uint8Array;

export async function uriParaUploadBodies(uri: string, mimeType?: string): Promise<UploadBody[]> {
  if (Platform.OS === 'web' || !/^file:\/\//i.test(uri)) {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`Nao foi possivel ler o arquivo selecionado (${response.status}).`);
    }
    return [await response.blob()];
  }

  // SDK 54: readAsStringAsync importado de "expo-file-system" sempre lanca
  // erro em runtime. A API File e o caminho suportado para arquivos file://.
  try {
    const arquivo = new File(uri);
    const arrayBuffer = await arquivo.arrayBuffer();
    if (arrayBuffer.byteLength === 0) throw new Error('O arquivo selecionado esta vazio.');
    return [arrayBuffer];
  } catch (erroFile) {
    // Compatibilidade com alguns provedores Android que entregam uma URI que
    // a API nova nao consegue abrir, mas o modulo legado ainda consegue ler.
    try {
      const base64 = await FileSystemLegacy.readAsStringAsync(uri, {
        encoding: FileSystemLegacy.EncodingType.Base64,
      });
      const arrayBuffer = base64ParaArrayBuffer(base64);
      if (arrayBuffer.byteLength === 0) throw new Error('O arquivo selecionado esta vazio.');
      return [arrayBuffer];
    } catch (erroLegacy) {
      const detalhe = erroLegacy instanceof Error
        ? erroLegacy.message
        : erroFile instanceof Error
          ? erroFile.message
          : String(erroLegacy ?? erroFile);
      throw new Error(`Nao foi possivel ler o arquivo no aparelho: ${detalhe}`);
    }
  }
}

export async function uriParaUploadBody(uri: string, mimeType?: string): Promise<UploadBody> {
  const [primeiro] = await uriParaUploadBodies(uri, mimeType);
  return primeiro;
}
