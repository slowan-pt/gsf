import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import * as ImageManipulator from 'expo-image-manipulator';
import { base64ParaBytes } from './logoClube';

/**
 * Logo oficial dos Desbravadores para o cabeçalho dos relatórios (PDF e Excel), ao lado do logo do clube.
 * A imagem do app é grande (500 px); aqui ela é reduzida para 192 px, o bastante para o papel e leve dentro do arquivo.
 */

const LADO = 192;

export interface LogoPronta {
  /** data:image/png;base64,... (para o HTML dos PDFs). */
  dataUri: string;
  /** PNG em bytes (para a planilha). */
  bytes: Uint8Array;
}

let cache: Promise<LogoPronta | null> | null = null;

async function prepararWeb(uri: string): Promise<LogoPronta | null> {
  const img: HTMLImageElement = await new Promise((resolve, reject) => {
    const i = new window.Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('logo'));
    i.src = uri;
  });
  const maior = Math.max(img.naturalWidth, img.naturalHeight) || LADO;
  const escala = Math.min(1, LADO / maior);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * escala));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * escala));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const dataUri = canvas.toDataURL('image/png');
  return { dataUri, bytes: base64ParaBytes(dataUri.slice(dataUri.indexOf(',') + 1)) };
}

async function prepararNativo(asset: Asset): Promise<LogoPronta | null> {
  await asset.downloadAsync();
  const r = await ImageManipulator.manipulateAsync(asset.localUri ?? asset.uri, [{ resize: { width: LADO } }], {
    format: ImageManipulator.SaveFormat.PNG,
    base64: true,
  });
  if (!r.base64) return null;
  return { dataUri: `data:image/png;base64,${r.base64}`, bytes: base64ParaBytes(r.base64) };
}

/** Devolve a logo dos Desbravadores pronta, ou null se não der para carregá-la (o relatório sai só com o logo do clube). */
export function obterLogoDesbravadores(): Promise<LogoPronta | null> {
  if (!cache) {
    cache = (async () => {
      try {
        const asset = Asset.fromModule(require('../../assets/logo-desbravadores.png'));
        return Platform.OS === 'web' ? await prepararWeb(asset.uri) : await prepararNativo(asset);
      } catch {
        return null;
      }
    })();
    // Falha passageira não deve ficar guardada para sempre.
    cache.then((v) => { if (!v) cache = null; }, () => { cache = null; });
  }
  return cache;
}
