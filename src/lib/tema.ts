/** Tokens de cor "estruturais" (fundo, superfície, texto, borda) — não inclui
 * cores de marca/acento (azul do cabeçalho, medalhas, status verde/vermelho),
 * que continuam fixas nos dois modos por serem parte da identidade visual. */
export interface CoresTema {
  fundo: string;
  cartao: string;
  texto: string;
  textoSecundario: string;
  borda: string;
  input: string;
  placeholder: string;
  overlay: string;
  /** Cor de destaque para TEXTO/ícone (no escuro, versão clara da primária). */
  acento: string;
  /** Fundo suave do acento (pílula ativa do menu, botão secundário, tags). */
  acentoSuave: string;
  /** Cor da sombra sólida inferior dos cartões. */
  sombra: string;
  /** Primária da paleta do usuário (cabeçalho, aba/chip selecionado). */
  primaria: string;
  /** Secundária da paleta (carrosséis, botão Ler hoje, pontuação). */
  secundaria: string;
  /** Sombra sólida de elementos preenchidos com a primária. */
  profundo: string;
  isEscuro: boolean;
}

// Valores do protótipo aprovado (dbvp-frontend): --bg, --panel, --ink, --muted,
// --line, --shadow, --soft, --deep. Primária/secundária vêm da paleta do usuário.
export const CORES_CLARO: CoresTema = {
  fundo: '#f3edff',
  cartao: '#ffffff',
  texto: '#322049',
  textoSecundario: '#756183',
  borda: '#e6d8f3',
  input: '#ffffff',
  placeholder: '#756183',
  overlay: 'rgba(30,16,52,0.42)',
  acento: '#7c39e7',
  acentoSuave: '#ebe0fc',
  sombra: '#d6c0ec',
  primaria: '#7c39e7',
  secundaria: '#ffdf38',
  profundo: '#50268e',
  isEscuro: false,
};

export const CORES_ESCURO: CoresTema = {
  fundo: '#151022',
  cartao: '#261e38',
  texto: '#f7f2ff',
  textoSecundario: '#c2b4d5',
  borda: '#493c5f',
  input: '#261e38',
  placeholder: '#c2b4d5',
  overlay: 'rgba(0,0,0,0.6)',
  acento: '#d2b5ff',
  acentoSuave: '#3b2a55',
  sombra: '#0d0918',
  primaria: '#7c39e7',
  secundaria: '#ffdf38',
  profundo: '#100a1e',
  isEscuro: true,
};

/**
 * Cartão padrão do protótipo: fundo do painel, borda fina, cantos de 20 e
 * sombra SÓLIDA de 4px para baixo (box-shadow 0 4px 0 var(--shadow)).
 */
export function estiloCartao(cores: CoresTema, raio = 20) {
  return {
    backgroundColor: cores.cartao,
    borderRadius: raio,
    borderWidth: 1,
    borderColor: cores.borda,
    boxShadow: `0px 4px 0px ${cores.sombra}`,
  } as const;
}

/** Sombra sólida inferior (botões e elementos preenchidos). */
export function sombraSolida(cor: string, altura = 4) {
  return { boxShadow: `0px ${altura}px 0px ${cor}` } as const;
}

/** Mistura duas cores hex (peso = quanto de `b` entra). */
export function misturarCores(a: string, b: string, peso: number): string {
  const ra = hexParaRgb(a), rb = hexParaRgb(b);
  if (!ra || !rb) return a;
  const m = (x: number, y: number) => Math.round(x * (1 - peso) + y * peso).toString(16).padStart(2, '0');
  return `#${m(ra.r, rb.r)}${m(ra.g, rb.g)}${m(ra.b, rb.b)}`;
}

export function coresPorModo(escuro: boolean): CoresTema {
  return escuro ? CORES_ESCURO : CORES_CLARO;
}

/**
 * Cor de um ícone desenhado sobre uma superfície do tema (card, fundo,
 * linha de lista). No modo claro é o azul da marca, como sempre foi; no
 * escuro vira branco, porque o azul-marinho praticamente some contra o
 * fundo escuro (#0f1720/#1a2530).
 *
 * Só serve pra ícone sobre superfície do TEMA. Ícone dentro de caixinha de
 * cor fixa (selo verde de sucesso, pílula vermelha de erro) continua com a
 * cor própria — lá o contraste já está garantido pelo fundo da caixa.
 */
// Diâmetro da foto do membro/usuário no cabeçalho das telas. A logo do clube
// (LogoClube) usa o mesmo tamanho, pra as duas ficarem lado a lado alinhadas.
export const TAMANHO_FOTO_CABECALHO = 56;

export function corIcone(cores: CoresTema): string {
  return cores.isEscuro ? '#ffffff' : '#3b1f8f';
}

function hexParaRgb(cor: string): { r: number; g: number; b: number } | null {
  const hex = String(cor ?? '').trim().replace('#', '');
  const completo = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(completo)) return null;
  return {
    r: parseInt(completo.slice(0, 2), 16),
    g: parseInt(completo.slice(2, 4), 16),
    b: parseInt(completo.slice(4, 6), 16),
  };
}

/**
 * Versão do cabeçalho para o modo escuro: mistura a cor de marca do clube
 * com o fundo escuro, mantendo o tom (o clube continua reconhecível) mas
 * sem a faixa clara e saturada rasgando a tela no modo noturno.
 *
 * Não é um "escurecer" puro porque a cor vem da paleta escolhida pelo clube
 * e pode ser clara (amarelo, laranja) ou já escura (azul-marinho): puxar
 * todas para o mesmo fundo dá um resultado consistente nos dois casos.
 */
export function corCabecalhoPorTema(cor: string, escuro: boolean): string {
  if (!escuro) return cor;
  const rgb = hexParaRgb(cor);
  const fundo = hexParaRgb(CORES_ESCURO.fundo);
  if (!rgb || !fundo) return cor;
  const peso = 0.62; // quanto do fundo escuro entra na mistura
  const mistura = (canal: 'r' | 'g' | 'b') =>
    Math.round(rgb[canal] * (1 - peso) + fundo[canal] * peso);
  const hex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${hex(mistura('r'))}${hex(mistura('g'))}${hex(mistura('b'))}`;
}

/**
 * Cores fixas de status/realce (verde de "entregue", vermelho de "pendente",
 * cinzas de legenda...) foram escolhidas para fundo claro e ficam sem contraste
 * sobre os cartões escuros. No modo noturno esta função devolve uma versão clara
 * do mesmo tom; no claro devolve a cor original.
 */
const TONS_NOTURNOS: Record<string, string> = {
  '#2e7d32': '#7fdc98', '#388e3c': '#7fdc98', '#43a047': '#7fdc98', '#16a34a': '#7fdc98', '#1b5e20': '#7fdc98', '#15803d': '#7fdc98', '#69f0ae': '#69f0ae',
  '#c62828': '#ff9b9b', '#d32f2f': '#ff9b9b', '#c0392b': '#ff9b9b', '#b71c1c': '#ff9b9b', '#e53935': '#ff9b9b', '#dc2626': '#ff9b9b', '#b91c1c': '#ff9b9b',
  '#607d8b': '#b9c6cf', '#78909c': '#bcc7cf', '#90a4ae': '#c2ccd3', '#546e7a': '#b9c6cf', '#7b8794': '#c0c6d0', '#8a94a0': '#c3c8d1', '#9aa5b1': '#c6ccd4', '#b0bec5': '#ccd5db',
  '#777': '#c0c0cf', '#777777': '#c0c0cf', '#666': '#c0c0cf', '#666666': '#c0c0cf', '#888': '#c4c4d2', '#888888': '#c4c4d2', '#999': '#c8c8d4', '#999999': '#c8c8d4', '#aaa': '#cbcbd6', '#bbb': '#d0d0da', '#ccc': '#d6d6df',
  '#555': '#d4d4de', '#555555': '#d4d4de', '#444': '#e2e2ea', '#333': '#ececf3', '#333333': '#ececf3', '#222': '#f1eefc', '#222222': '#f1eefc', '#1f1b33': '#f1eefc', '#263238': '#eceff1', '#37474f': '#e3e8ea', '#455a64': '#dde3e6', '#52606d': '#d5dbe1', '#4a5866': '#d5dbe1', '#557': '#d0d0e2', '#667': '#cfd0dc',
  '#1565c0': '#9cc2ff', '#1976d2': '#9cc2ff', '#0d47a1': '#9cc2ff', '#0369a1': '#86d7fb', '#0b6477': '#86d7fb', '#0277bd': '#86d7fb',
  '#e65100': '#ffb877', '#f57c00': '#ffb877', '#ef6c00': '#ffb877', '#ff6b35': '#ffab85', '#b45309': '#fcc35a', '#92400e': '#fcc35a', '#8a6412': '#f5cf73', '#f9a825': '#ffd257', '#b8860b': '#f2c94c',
  '#5e35b1': '#cbb8ff', '#7c3aed': '#cbb8ff', '#6d28d9': '#cbb8ff', '#4b2bb0': '#cdbcff', '#3b1f8f': '#cdbcff', '#9c27b0': '#e2a6f0', '#c2185b': '#ff9ec4', '#e91e63': '#ff9ec4',
};

export function tomTexto(cor: string, cores: CoresTema): string {
  if (!cores.isEscuro) return cor;
  return TONS_NOTURNOS[String(cor).toLowerCase()] ?? corLegivel(cor, cores);
}

function luminancia(cor: string): number | null {
  const rgb = hexParaRgb(cor);
  if (!rgb) return null;
  const f = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(rgb.r) + 0.7152 * f(rgb.g) + 0.0722 * f(rgb.b);
}

function contraste(a: string, b: string): number {
  const la = luminancia(a), lb = luminancia(b);
  if (la == null || lb == null) return 21;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function misturar(cor: string, alvo: string, peso: number): string {
  const a = hexParaRgb(cor), b = hexParaRgb(alvo);
  if (!a || !b) return cor;
  const m = (x: number, y: number) => Math.round(x * (1 - peso) + y * peso).toString(16).padStart(2, '0');
  return `#${m(a.r, b.r)}${m(a.g, b.g)}${m(a.b, b.b)}`;
}

/**
 * Versão legível de uma cor de identidade (cor da classe, da unidade...) usada
 * como TEXTO sobre o fundo do tema: escurece no claro / clareia no escuro só o
 * necessário para chegar a 4,5:1, mantendo o tom.
 */
export function corLegivel(cor: string, cores: CoresTema, minimo = 4.5): string {
  if (!hexParaRgb(cor)) return cor;
  // No escuro mira o fundo tingido mais claro usado em selos/caixas, não só o cartão.
  const fundo = cores.isEscuro ? '#403d55' : cores.cartao;
  const alvo = cores.isEscuro ? '#ffffff' : '#000000';
  let atual = cor;
  for (let passo = 1; passo <= 10 && contraste(atual, fundo) < minimo; passo++) {
    atual = misturar(cor, alvo, passo * 0.08);
  }
  return atual;
}

/** Texto (branco ou quase preto) com melhor contraste sobre um fundo colorido. */
export function textoSobre(fundo: string): string {
  if (!hexParaRgb(fundo)) return '#ffffff';
  return contraste('#ffffff', fundo) >= contraste('#1a1033', fundo) ? '#ffffff' : '#1a1033';
}
