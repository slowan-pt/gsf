import { Image as RNImage, Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

export interface OpcoesCompressao {
  maxDimensao?: number;
  qualidade?: number;
}

const PADRAO: Required<OpcoesCompressao> = { maxDimensao: 1280, qualidade: 0.78 };

// GIF perderia a animação e SVG é vetor — nenhum dos dois deve passar pelo
// reencode JPEG. Documentos (PDF/Word/etc.) nunca chegam aqui.
export function ehImagemComprimivel(mimeType?: string | null): boolean {
  if (!mimeType) return false;
  if (!mimeType.startsWith('image/')) return false;
  if (mimeType === 'image/gif' || mimeType === 'image/svg+xml') return false;
  return true;
}

function obterDimensoesNativa(uri: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    RNImage.getSize(uri, (width, height) => resolve({ width, height }), () => resolve(null));
  });
}

/** Native (Android/iOS): redimensiona (se maior que o limite) e reencoda em JPEG. */
export async function comprimirUriNativa(uri: string, opcoes?: OpcoesCompressao): Promise<string> {
  const opts = { ...PADRAO, ...opcoes };
  try {
    const dimensoes = await obterDimensoesNativa(uri);
    const acoes: ImageManipulator.Action[] = [];
    if (dimensoes) {
      const maior = Math.max(dimensoes.width, dimensoes.height);
      if (maior > opts.maxDimensao) {
        const escala = opts.maxDimensao / maior;
        acoes.push({
          resize: {
            width: Math.round(dimensoes.width * escala),
            height: Math.round(dimensoes.height * escala),
          },
        });
      }
    }
    const resultado = await ImageManipulator.manipulateAsync(uri, acoes, {
      compress: opts.qualidade,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return resultado.uri;
  } catch {
    // Qualquer falha (formato exotico, permissao, etc.) -> mantem o original.
    return uri;
  }
}

/** Web: redimensiona (se maior que o limite) e reencoda em JPEG via canvas. */
export async function comprimirBlobWeb(blob: Blob, opcoes?: OpcoesCompressao): Promise<Blob> {
  const opts = { ...PADRAO, ...opcoes };
  try {
    if (typeof createImageBitmap !== 'function') return blob;
    const bitmap = await createImageBitmap(blob);
    const maior = Math.max(bitmap.width, bitmap.height);
    const escala = Math.min(1, opts.maxDimensao / maior);
    const largura = Math.max(1, Math.round(bitmap.width * escala));
    const altura = Math.max(1, Math.round(bitmap.height * escala));

    let comprimido: Blob | null = null;
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(largura, altura);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, largura, altura);
        comprimido = await canvas.convertToBlob({ type: 'image/jpeg', quality: opts.qualidade });
      }
    } else if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = largura;
      canvas.height = altura;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, largura, altura);
        comprimido = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', opts.qualidade));
      }
    }
    bitmap.close?.();
    if (!comprimido || comprimido.size === 0) return blob;
    // Só troca pelo comprimido se ele realmente ficou menor (evita "comprimir" algo já pequeno pra pior).
    return comprimido.size < blob.size ? comprimido : blob;
  } catch {
    return blob;
  }
}

/**
 * Ponto único de compressão de imagem antes do upload — usa canvas na web e
 * expo-image-manipulator no nativo. Arquivos que não são imagem comprimível
 * (PDF, Word, GIF, SVG etc.) passam direto, sem nenhum processamento.
 */
export async function comprimirUriSeAplicavel(uri: string, mimeType: string | undefined, opcoes?: OpcoesCompressao): Promise<string> {
  if (!ehImagemComprimivel(mimeType)) return uri;
  if (Platform.OS === 'web') return uri; // web processa o Blob depois de baixado, ver comprimirBlobWeb
  return comprimirUriNativa(uri, opcoes);
}
