import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

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
 * segurança, ampliando as pequenas e reduzindo as grandes. No app nativo o
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
  const resultado = await ImageManipulator.manipulateAsync(uri, [{ resize }], {
    format: ImageManipulator.SaveFormat.PNG,
  });
  return { uri: resultado.uri, mimeType: 'image/png', pequena: maior < LADO_MINIMO_LOGO_CLUBE };
}
