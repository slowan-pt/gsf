/**
 * Faixa verde do uniforme (imagens em assets/faixa): onde ficam os ícones das especialidades.
 * Medidas tiradas das próprias imagens (1024×1536): eixo e largura da faixa, e onde termina a
 * plaquinha do nome — os ícones começam logo abaixo dela e seguem faixa abaixo.
 */
export type ChaveUniforme = 'homem-marrom' | 'homem-branca' | 'mulher-marrom' | 'mulher-branca';

/** Oito tons de pele (do muito claro ao muito escuro). A foto original é o padrão de quem nunca personalizou. */
export const TONS_PELE = ['#FFE2CF', '#FAD0B0', '#F2B98C', '#E8A06D', '#CC8452', '#A9633A', '#824626', '#5C2F1B'];

/** Uma variação de cada foto por tom (só a pele muda; tudo o mais é igual à original). */
const IMAGEM_UNIFORME_TOM: Record<ChaveUniforme, any[]> = {
  'homem-marrom': [require('../../assets/faixa/pele/homem-marrom-t1.webp'), require('../../assets/faixa/pele/homem-marrom-t2.webp'), require('../../assets/faixa/pele/homem-marrom-t3.webp'), require('../../assets/faixa/pele/homem-marrom-t4.webp'), require('../../assets/faixa/pele/homem-marrom-t5.webp'), require('../../assets/faixa/pele/homem-marrom-t6.webp'), require('../../assets/faixa/pele/homem-marrom-t7.webp'), require('../../assets/faixa/pele/homem-marrom-t8.webp')],
  'homem-branca': [require('../../assets/faixa/pele/homem-branca-t1.webp'), require('../../assets/faixa/pele/homem-branca-t2.webp'), require('../../assets/faixa/pele/homem-branca-t3.webp'), require('../../assets/faixa/pele/homem-branca-t4.webp'), require('../../assets/faixa/pele/homem-branca-t5.webp'), require('../../assets/faixa/pele/homem-branca-t6.webp'), require('../../assets/faixa/pele/homem-branca-t7.webp'), require('../../assets/faixa/pele/homem-branca-t8.webp')],
  'mulher-marrom': [require('../../assets/faixa/pele/mulher-marrom-t1.webp'), require('../../assets/faixa/pele/mulher-marrom-t2.webp'), require('../../assets/faixa/pele/mulher-marrom-t3.webp'), require('../../assets/faixa/pele/mulher-marrom-t4.webp'), require('../../assets/faixa/pele/mulher-marrom-t5.webp'), require('../../assets/faixa/pele/mulher-marrom-t6.webp'), require('../../assets/faixa/pele/mulher-marrom-t7.webp'), require('../../assets/faixa/pele/mulher-marrom-t8.webp')],
  'mulher-branca': [require('../../assets/faixa/pele/mulher-branca-t1.webp'), require('../../assets/faixa/pele/mulher-branca-t2.webp'), require('../../assets/faixa/pele/mulher-branca-t3.webp'), require('../../assets/faixa/pele/mulher-branca-t4.webp'), require('../../assets/faixa/pele/mulher-branca-t5.webp'), require('../../assets/faixa/pele/mulher-branca-t6.webp'), require('../../assets/faixa/pele/mulher-branca-t7.webp'), require('../../assets/faixa/pele/mulher-branca-t8.webp')],
};

/** Imagem do uniforme no tom escolhido (1 a 8); sem tom, a foto original. */
export function imagemDoUniforme(chave: ChaveUniforme, tom?: number | null) {
  if (tom != null && tom >= 1 && tom <= TONS_PELE.length) return IMAGEM_UNIFORME_TOM[chave][tom - 1];
  return IMAGEM_UNIFORME[chave];
}

/** Filetinha vermelha do lenço de quem já é líder: camada transparente sobre a foto (vale para qualquer tom de pele). */
export const FILETE_LENCO_LIDER: Record<ChaveUniforme, any> = {
  'homem-marrom': require('../../assets/faixa/lenco/homem-marrom.png'),
  'homem-branca': require('../../assets/faixa/lenco/homem-branca.png'),
  'mulher-marrom': require('../../assets/faixa/lenco/mulher-marrom.png'),
  'mulher-branca': require('../../assets/faixa/lenco/mulher-branca.png'),
};

/** Bolso esquerdo da camisa (px da imagem): largura do bolso, topo e posição do passador do lenço. */
interface PeitoGeo { x0: number; x1: number; yTopo: number; passador: { x: number; y: number } }

const PEITO: Record<ChaveUniforme, PeitoGeo> = {
  'homem-marrom':  { x0: 642, x1: 864, yTopo: 388, passador: { x: 537, y: 281 } },
  'mulher-branca': { x0: 666, x1: 878, yTopo: 382, passador: { x: 577, y: 273 } },
  'mulher-marrom': { x0: 614, x1: 810, yTopo: 352, passador: { x: 528, y: 250 } },
  'homem-branca':  { x0: 663, x1: 890, yTopo: 398, passador: { x: 558, y: 287 } },
};

/** Lugar de uma insígnia (centro e caixa, px da imagem). */
export interface LugarInsignia { cx: number; cy: number; w: number; h: number }

export interface DisposicaoPeito {
  /** Janela da cena: de x0 a x1 e a partir de y0 (px da imagem). */
  vista: { x0: number; x1: number; y0: number };
  /** Amigo, Companheiro, Pesquisador, Pioneiro, Excursionista, Guia — da esquerda para a direita, logo acima do bolso. */
  regulares: LugarInsignia[];
  /** Líder, Líder Máster e Líder Máster avançado, na fileira de cima. */
  lideres: LugarInsignia[];
  /** Faixinhas das avançadas, na mesma ordem das classes: embaixo Amigo/Companheiro/Pesquisador, em cima Pioneiro/Excursionista/Guia. */
  avancadas: LugarInsignia[];
}

/** Insígnias do uniforme: regulares sobre o bolso, liderança acima e as avançadas por último (mais acima). */
export function disposicaoPeito(chave: ChaveUniforme): DisposicaoPeito {
  const g = PEITO[chave];
  const k = (g.x1 - g.x0) / 222;
  const centroX = (g.x0 + g.x1) / 2;
  const largura = g.x1 - g.x0;
  const yA = g.yTopo - 32 * k;
  const yB = g.yTopo - 74 * k;
  const yC = g.yTopo - 109 * k;
  const yD = g.yTopo - 133 * k;
  const regulares = Array.from({ length: 6 }, (_, i) => ({ cx: g.x0 + ((i + 0.5) * largura) / 6, cy: yA, w: 40 * k, h: 40 * k }));
  const lideres: LugarInsignia[] = [
    { cx: centroX - 58 * k, cy: yB, w: 38 * k, h: 38 * k },
    { cx: centroX, cy: yB, w: 56 * k, h: 40 * k },
    { cx: centroX + 58 * k, cy: yB, w: 56 * k, h: 40 * k },
  ];
  const barra = (cx: number, cy: number): LugarInsignia => ({ cx, cy, w: 64 * k, h: 53.6 * k });
  const avancadas = [
    barra(centroX - 68 * k, yC), barra(centroX, yC), barra(centroX + 68 * k, yC),
    barra(centroX - 68 * k, yD), barra(centroX, yD), barra(centroX + 68 * k, yD),
  ];
  return { vista: { x0: g.passador.x - 70, x1: g.x1 + 36, y0: g.yTopo - 200 * k }, regulares, lideres, avancadas };
}

/** Tarja branca do nome (px da imagem): centro, comprimento, altura e inclinação (graus, horário) do lado maior. */
export interface TarjaNome { cx: number; cy: number; comp: number; alt: number; angulo: number }

const TARJA: Record<ChaveUniforme, TarjaNome> = {
  'homem-marrom':  { cx: 355.3, cy: 311.6, comp: 146.2, alt: 33.5, angulo: -23.8 },
  'mulher-branca': { cx: 393.6, cy: 297.5, comp: 139.6, alt: 32.0, angulo: -21.9 },
  'mulher-marrom': { cx: 363.4, cy: 275.0, comp: 128.5, alt: 29.3, angulo: -21.7 },
  'homem-branca':  { cx: 368.7, cy: 321.1, comp: 149.9, alt: 34.0, angulo: -24.4 },
};

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
  /** Tarja branca do nome, logo abaixo da bandeira. */
  tarja: TarjaNome;
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
    tarja: TARJA[chave],
  };
}
