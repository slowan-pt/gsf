/**
 * Faixa verde do uniforme (imagens em assets/faixa): onde ficam os ícones das especialidades.
 * Medidas tiradas das próprias imagens (1024×1536): eixo e largura da faixa, e onde termina a
 * plaquinha do nome — os ícones começam logo abaixo dela e seguem faixa abaixo.
 */
export type ChaveUniforme = 'homem-marrom' | 'homem-branca' | 'mulher-marrom' | 'mulher-branca';

export const LARGURA_IMG = 1024;
export const ALTURA_IMG = 1536;

export const IMAGEM_UNIFORME: Record<ChaveUniforme, any> = {
  'homem-marrom': require('../../assets/faixa/homem-marrom.webp'),
  'homem-branca': require('../../assets/faixa/homem-branca.webp'),
  'mulher-marrom': require('../../assets/faixa/mulher-marrom.webp'),
  'mulher-branca': require('../../assets/faixa/mulher-branca.webp'),
};

interface GeometriaFaixa {
  /** Ponto no meio da faixa (px da imagem). */
  cx: number; cy: number;
  /** Direção da faixa (de cima para baixo) e sua perpendicular. */
  dx: number; dy: number; nx: number; ny: number;
  /** Posição, ao longo do eixo, do fim da plaquinha e do fim da faixa. */
  tTagFim: number; tMax: number;
  /** Largura útil da faixa e deslocamento do centro. */
  largura: number; qMed: number;
}

const GEO: Record<ChaveUniforme, GeometriaFaixa> = {
  'homem-marrom':  { cx: 590.64, cy: 668.79, dx: 0.538, dy: 0.843, nx: 0.843, ny: -0.538, tTagFim: -406.73, tMax: 618.07, largura: 177.62, qMed: 1.64 },
  'mulher-branca': { cx: 614.61, cy: 634.01, dx: 0.538, dy: 0.843, nx: 0.843, ny: -0.538, tTagFim: -380.99, tMax: 596.24, largura: 156.46, qMed: 1.16 },
  'mulher-marrom': { cx: 569.48, cy: 584.69, dx: 0.543, dy: 0.840, nx: 0.840, ny: -0.543, tTagFim: -351.49, tMax: 552.93, largura: 146.58, qMed: 1.15 },
  'homem-branca':  { cx: 605.04, cy: 688.28, dx: 0.531, dy: 0.847, nx: 0.847, ny: -0.531, tTagFim: -415.70, tMax: 637.27, largura: 182.30, qMed: 2.91 },
};

/** Até 15 anos: camisa marrom; a partir dos 16: branca. Feminino 'F'; qualquer outro valor, masculino. */
export function uniformeDoMembro(genero?: string | null, idade?: number | null): ChaveUniforme {
  const sexo = String(genero ?? '').trim().toUpperCase().startsWith('F') ? 'mulher' : 'homem';
  const cor = idade != null && idade >= 16 ? 'branca' : 'marrom';
  return `${sexo}-${cor}` as ChaveUniforme;
}

export interface DisposicaoFaixa {
  chave: ChaveUniforme;
  colunas: number;
  /** Lado da célula de cada ícone e tamanho do ícone dentro dela (px da imagem). */
  passo: number;
  tamanho: number;
  /** Largura útil da faixa onde ficam as colunas (px da imagem). */
  larguraUtil: number;
  /** Centro da faixa no alto da bandeira (ponto de referência da cena), em px da imagem. */
  topo: { x: number; y: number };
  /** Direção da faixa, descendo (vetor unitário, imagem). */
  dir: { x: number; y: number };
  /** Giro (graus, horário) que alinha os ícones à faixa. */
  giroGraus: number;
  /** Do alto da bandeira até o início dos ícones (logo abaixo da plaquinha), ao longo da faixa (px da imagem). */
  alturaBandeira: number;
  /** Comprimento útil da faixa para os ícones, ao longo dela (px da imagem). */
  comprimento: number;
}

/** Poucas especialidades: 3 por linha; muitas: 4 por linha. */
export function colunasPara(total: number): number {
  return total <= 12 ? 3 : 4;
}

export function disposicaoNaFaixa(chave: ChaveUniforme, total: number): DisposicaoFaixa {
  const g = GEO[chave];
  const colunas = colunasPara(total);
  const larguraUtil = g.largura * 0.92;
  const passo = larguraUtil / colunas;
  const t0 = g.tTagFim + 0.12 * g.largura;
  // bandeira e plaquinha ocupam ~175 px da imagem acima do fim da plaquinha
  const tTopo = g.tTagFim - 175;
  return {
    chave,
    colunas,
    passo,
    tamanho: passo * 0.86,
    larguraUtil,
    topo: { x: g.cx + g.dx * tTopo + g.nx * g.qMed, y: g.cy + g.dy * tTopo + g.ny * g.qMed },
    dir: { x: g.dx, y: g.dy },
    giroGraus: -(Math.atan2(g.dx, g.dy) * 180) / Math.PI,
    alturaBandeira: t0 - tTopo,
    comprimento: g.tMax - 60 - t0,
  };
}
