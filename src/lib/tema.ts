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
  textoSecundario: '#93a4b3',
  borda: '#2b3947',
  input: '#212e3a',
  placeholder: '#68798a',
  overlay: 'rgba(0,0,0,0.55)',
  isEscuro: true,
};

export function coresPorModo(escuro: boolean): CoresTema {
  return escuro ? CORES_ESCURO : CORES_CLARO;
}
