import * as FileSystem from 'expo-file-system';
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
    return [await response.blob()];
  }

  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
  const arrayBuffer = base64ParaArrayBuffer(base64);
  const corpos: UploadBody[] = [arrayBuffer, new Uint8Array(arrayBuffer)];

  if (typeof Blob !== 'undefined') {
    corpos.push(new Blob([arrayBuffer], { type: mimeType || 'application/octet-stream' }));
  }

  return corpos;
}

export async function uriParaUploadBody(uri: string, mimeType?: string): Promise<UploadBody> {
  const [primeiro] = await uriParaUploadBodies(uri, mimeType);
  return primeiro;
}
