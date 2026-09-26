import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { decode, encode } from 'fast-png';
import { removerFundoBranco } from './removerFundoBranco';

/** Lado do quadrado final da logo: bem acima dos 56 px exibidos, mesmo em telas 3x. */
export const LADO_LOGO_CLUBE = 512;
/** Abaixo disso a ampliação fica visivelmente borrada. */
export const LADO_MINIMO_LOGO_CLUBE = 200;

export interface LogoPreparada {
  uri: string;
  mimeType: 'image/png';
  /** true quando a imagem original é pequena demais e a ampliação perde nitidez. */
  pequena: boolean;
}

function carregarImagemWeb(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível ler a imagem da logo.'));
    img.src = uri;
  });
}

/**
 * Deixa a logo pronta para o círculo do cabeçalho, sem cortes: a imagem inteira
 * é encaixada (sem recortar) num quadrado transparente de 512 px com margem de
 * segurança, ampliando as pequenas e reduzindo as grandes. O fundo branco que
 * encosta na borda é removido (fica transparente). No app nativo o
 * manipulador não desenha margem, então só normaliza o tamanho e a exibição
 * (LogoClube) mantém a folga.
 */
export async function prepararLogoClube(uri: string): Promise<LogoPreparada> {
  if (Platform.OS === 'web') {
    const img = await carregarImagemWeb(uri);
    const largura = img.naturalWidth || img.width;
    const altura = img.naturalHeight || img.height;
    if (!largura || !altura) throw new Error('A imagem da logo está vazia.');

    const canvas = document.createElement('canvas');
    canvas.width = LADO_LOGO_CLUBE;
    canvas.height = LADO_LOGO_CLUBE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível tratar a imagem da logo.');

    const area = LADO_LOGO_CLUBE * 0.9;
    const escala = Math.min(area / largura, area / altura);
    const w = largura * escala;
    const h = altura * escala;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (LADO_LOGO_CLUBE - w) / 2, (LADO_LOGO_CLUBE - h) / 2, w, h);
    const pixels = ctx.getImageData(0, 0, LADO_LOGO_CLUBE, LADO_LOGO_CLUBE);
    removerFundoBranco(pixels.data, LADO_LOGO_CLUBE, LADO_LOGO_CLUBE);
    ctx.putImageData(pixels, 0, 0);

    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar a logo.'))), 'image/png')
    );
    return {
      uri: URL.createObjectURL(blob),
      mimeType: 'image/png',
      pequena: Math.max(largura, altura) < LADO_MINIMO_LOGO_CLUBE,
    };
  }

  const original = await ImageManipulator.manipulateAsync(uri, [], { format: ImageManipulator.SaveFormat.PNG });
  const maior = Math.max(original.width, original.height);
  const resize = original.width >= original.height
    ? { width: LADO_LOGO_CLUBE }
    : { height: LADO_LOGO_CLUBE };
  const redimensionada = await ImageManipulator.manipulateAsync(uri, [{ resize }], {
    format: ImageManipulator.SaveFormat.PNG,
    base64: true,
  });
  const pequena = maior < LADO_MINIMO_LOGO_CLUBE;

  // Tira o fundo branco decodificando o PNG; se algo falhar, envia sem essa etapa.
  try {
    if (!redimensionada.base64) throw new Error('sem base64');
    const png = decode(base64ParaBytes(redimensionada.base64));
    const rgba = paraRgba8(png);
    removerFundoBranco(rgba, png.width, png.height);
    const bytes = encode({ width: png.width, height: png.height, data: rgba, channels: 4, depth: 8 });
    const destino = `${FileSystemLegacy.cacheDirectory}logo_clube_${Date.now()}.png`;
    await FileSystemLegacy.writeAsStringAsync(destino, bytesParaBase64(bytes), {
      encoding: FileSystemLegacy.EncodingType.Base64,
    });
    return { uri: destino, mimeType: 'image/png', pequena };
  } catch {
    return { uri: redimensionada.uri, mimeType: 'image/png', pequena };
  }
}

function paraRgba8(png: ReturnType<typeof decode>): Uint8Array {
  const { width, height, channels, depth } = png;
  const origem = png.data as Uint8Array | Uint16Array;
  const rgba = new Uint8Array(width * height * 4);
  const passo = depth === 16 ? 257 : 1;
  for (let p = 0; p < width * height; p++) {
    const o = p * channels;
    const cinza = channels < 3;
    rgba[p * 4] = origem[o] / passo;
    rgba[p * 4 + 1] = origem[cinza ? o : o + 1] / passo;
    rgba[p * 4 + 2] = origem[cinza ? o : o + 2] / passo;
    rgba[p * 4 + 3] = channels === 4 ? origem[o + 3] / passo : channels === 2 ? origem[o + 1] / passo : 255;
  }
  return rgba;
}

function base64ParaBytes(base64: string): Uint8Array {
  const bin = atob(base64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesParaBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}
