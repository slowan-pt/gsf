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
  isEscuro: boolean;
}

export const CORES_CLARO: CoresTema = {
  fundo: '#f0f4f8',
  cartao: '#ffffff',
  texto: '#1f2933',
  textoSecundario: '#78909c',
  borda: '#e4eaf1',
  input: '#ffffff',
  placeholder: '#9aa5b1',
  overlay: 'rgba(10,20,35,0.35)',
  isEscuro: false,
};

export const CORES_ESCURO: CoresTema = {
  fundo: '#0f1720',
  cartao: '#1a2530',
  texto: '#eef2f6',
  // Clareado de #93a4b3: em rótulo pequeno ("Membros", "Diretoria") sobre o
  // card escuro o tom anterior ficava apagado demais na tela do celular.
  textoSecundario: '#aebecb',
  borda: '#2b3947',
  input: '#212e3a',
  placeholder: '#68798a',
  overlay: 'rgba(0,0,0,0.55)',
  isEscuro: true,
};

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
export function corIcone(cores: CoresTema): string {
  return cores.isEscuro ? '#ffffff' : '#1a3a5c';
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
