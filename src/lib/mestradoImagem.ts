import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { decode, encode } from 'fast-png';
import { removerFundo } from './removerFundo';
import { base64ParaBytes, bytesParaBase64, carregarImagemWeb, paraRgba8 } from './logoClube';
import { uriParaUploadBody } from './storageUpload';
import { enviarArquivo } from './arquivos';

/**
 * Imagem do mestrado leve para celular: o selo é mostrado pequeno (cerca de 100 px), então
 * ela é reduzida a, no máximo, 240 px de largura (nunca ampliada), mantém a proporção e as
 * cores, e o fundo liso branco/preto que encosta na borda vira transparente. Costuma ficar
 * com 20–40 KB.
 */
export const LARGURA_MAXIMA_MESTRADO = 240;

export async function prepararImagemMestrado(uri: string): Promise<{ uri: string }> {
  if (Platform.OS === 'web') {
    const img = await carregarImagemWeb(uri);
    const largura = img.naturalWidth || img.width;
    const altura = img.naturalHeight || img.height;
    if (!largura || !altura) throw new Error('A imagem do mestrado está vazia.');
    const escala = Math.min(1, LARGURA_MAXIMA_MESTRADO / largura);
    const w = Math.max(1, Math.round(largura * escala));
    const h = Math.max(1, Math.round(altura * escala));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível tratar a imagem do mestrado.');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    const pixels = ctx.getImageData(0, 0, w, h);
    removerFundo(pixels.data, w, h);
    ctx.putImageData(pixels, 0, 0);
    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar a imagem.'))), 'image/png')
    );
    return { uri: URL.createObjectURL(blob) };
  }

  const original = await ImageManipulator.manipulateAsync(uri, [], { format: ImageManipulator.SaveFormat.PNG });
  const acoes = original.width > LARGURA_MAXIMA_MESTRADO ? [{ resize: { width: LARGURA_MAXIMA_MESTRADO } }] : [];
  const pronta = await ImageManipulator.manipulateAsync(uri, acoes, { format: ImageManipulator.SaveFormat.PNG, base64: true });
  try {
    if (!pronta.base64) throw new Error('sem base64');
    const png = decode(base64ParaBytes(pronta.base64));
    const rgba = paraRgba8(png);
    removerFundo(rgba, png.width, png.height);
    const bytes = encode({ width: png.width, height: png.height, data: rgba, channels: 4, depth: 8 });
    const destino = `${FileSystemLegacy.cacheDirectory}mestrado_${Date.now()}.png`;
    await FileSystemLegacy.writeAsStringAsync(destino, bytesParaBase64(bytes), { encoding: FileSystemLegacy.EncodingType.Base64 });
    return { uri: destino };
  } catch {
    return { uri: pronta.uri };
  }
}

/** Reduz, limpa o fundo e envia; devolve a URL pública. */
export async function enviarImagemMestrado(uri: string, codigo: string): Promise<string> {
  const pronta = await prepararImagemMestrado(uri);
  // Binário genérico: "imagem comprimível" seria recodificada em JPEG e perderia a transparência.
  const corpo = await uriParaUploadBody(pronta.uri, 'application/octet-stream');
  const limpo = codigo.replace(/[^A-Za-z0-9_-]/g, '');
  return enviarArquivo('atividades', `mestrados/${limpo}_${Date.now()}.png`, corpo, { contentType: 'image/png' });
}
