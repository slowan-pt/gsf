import { supabase } from './supabase';

export interface CorBlocoAtividade {
  backgroundColor: string;
  borderColor: string;
  accentColor: string;
}

export interface PaletaAtividade {
  id: string;
  nome: string;
  descricao: string;
  cores: CorBlocoAtividade[];
}

export const PALETA_PADRAO_ATIVIDADES = 'viva';
export const FONTE_PADRAO_ATIVIDADES = 'padrao';

export interface FonteAtividade {
  id: string;
  nome: string;
  descricao: string;
  fontFamily?: string;
  googleFamily?: string;
}

export interface VisualAtividadesConfig {
  paletaId: string;
  coresPersonalizadas: string[] | null;
  fonteId: string;
}

export const FONTES_ATIVIDADES: FonteAtividade[] = [
  { id: 'padrao', nome: 'Padrao', descricao: 'Limpa e direta' },
  { id: 'inter', nome: 'Inter', descricao: 'Moderna e neutra', fontFamily: 'Inter, Arial, sans-serif', googleFamily: 'Inter:wght@400;600;700;800;900' },
  { id: 'poppins', nome: 'Poppins', descricao: 'Jovem e arredondada', fontFamily: 'Poppins, Arial, sans-serif', googleFamily: 'Poppins:wght@400;600;700;800;900' },
  { id: 'nunito', nome: 'Nunito', descricao: 'Amigavel e leve', fontFamily: 'Nunito, Arial, sans-serif', googleFamily: 'Nunito:wght@400;600;700;800;900' },
  { id: 'montserrat', nome: 'Montserrat', descricao: 'Forte e urbana', fontFamily: 'Montserrat, Arial, sans-serif', googleFamily: 'Montserrat:wght@400;600;700;800;900' },
  { id: 'quicksand', nome: 'Quicksand', descricao: 'Suave e juvenil', fontFamily: 'Quicksand, Arial, sans-serif', googleFamily: 'Quicksand:wght@400;600;700;800' },
  { id: 'rubik', nome: 'Rubik', descricao: 'Dinamica', fontFamily: 'Rubik, Arial, sans-serif', googleFamily: 'Rubik:wght@400;600;700;800;900' },
  { id: 'outfit', nome: 'Outfit', descricao: 'Atual e limpa', fontFamily: 'Outfit, Arial, sans-serif', googleFamily: 'Outfit:wght@400;600;700;800;900' },
  { id: 'urbanist', nome: 'Urbanist', descricao: 'Tecnologica e leve', fontFamily: 'Urbanist, Arial, sans-serif', googleFamily: 'Urbanist:wght@400;600;700;800;900' },
  { id: 'sora', nome: 'Sora', descricao: 'Digital e elegante', fontFamily: 'Sora, Arial, sans-serif', googleFamily: 'Sora:wght@400;600;700;800' },
  { id: 'barlow', nome: 'Barlow', descricao: 'Esportiva e clara', fontFamily: 'Barlow, Arial, sans-serif', googleFamily: 'Barlow:wght@400;600;700;800;900' },
  { id: 'jakarta', nome: 'Jakarta Sans', descricao: 'Premium e moderna', fontFamily: '"Plus Jakarta Sans", Arial, sans-serif', googleFamily: 'Plus+Jakarta+Sans:wght@400;600;700;800' },
  { id: 'manrope', nome: 'Manrope', descricao: 'Minimalista', fontFamily: 'Manrope, Arial, sans-serif', googleFamily: 'Manrope:wght@400;600;700;800' },
  { id: 'humanista', nome: 'Humanista', descricao: 'Acolhedora', fontFamily: '"Trebuchet MS", Arial, sans-serif' },
  { id: 'classica', nome: 'Classica', descricao: 'Tradicional', fontFamily: 'Georgia, serif' },
  { id: 'editorial', nome: 'Editorial', descricao: 'Formal', fontFamily: '"Times New Roman", serif' },
  { id: 'moderna', nome: 'Moderna', descricao: 'Objetiva', fontFamily: 'Arial, sans-serif' },
  { id: 'legivel', nome: 'Legivel', descricao: 'Espacosa', fontFamily: 'Verdana, sans-serif' },
  { id: 'compacta', nome: 'Compacta', descricao: 'Discreta', fontFamily: 'Tahoma, sans-serif' },
  { id: 'tecnica', nome: 'Tecnica', descricao: 'Monoespacada', fontFamily: '"Courier New", monospace' },
];

export function instalarFontesAtividadesWeb() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('fontes-atividades-google')) return;
  const familias = FONTES_ATIVIDADES
    .map((fonte) => fonte.googleFamily)
    .filter(Boolean)
    .join('&family=');
  if (!familias) return;

  const preconnectGoogle = document.createElement('link');
  preconnectGoogle.rel = 'preconnect';
  preconnectGoogle.href = 'https://fonts.googleapis.com';
  document.head.appendChild(preconnectGoogle);

  const preconnectStatic = document.createElement('link');
  preconnectStatic.rel = 'preconnect';
  preconnectStatic.href = 'https://fonts.gstatic.com';
  preconnectStatic.crossOrigin = 'anonymous';
  document.head.appendChild(preconnectStatic);

  const link = document.createElement('link');
  link.id = 'fontes-atividades-google';
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${familias}&display=swap`;
  document.head.appendChild(link);
}

function hslHex(h: number, s: number, l: number) {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Bloco a partir de um matiz: fundo vivo e claro, borda média e destaque escuro (texto legível). */
function blocoDoMatiz(h: number, sat = 82): CorBlocoAtividade {
  return {
    backgroundColor: hslHex(h, sat, 82),
    borderColor: hslHex(h, Math.max(sat - 18, 8), 50),
    accentColor: hslHex(h, Math.min(sat + 4, 100), 22),
  };
}

function paletaDeMatizes(id: string, nome: string, descricao: string, matizes: number[], sat = 82): PaletaAtividade {
  return { id, nome, descricao, cores: matizes.map((h) => blocoDoMatiz(h, sat)) };
}

// Cada paleta ocupa uma região própria do círculo de cores (e tem cabeçalho próprio em
// MARCA_POR_PALETA), para a troca ser visível logo de cara. Fundos claros + destaque escuro
// mantêm o texto legível.
export const PALETAS_ATIVIDADES: PaletaAtividade[] = [
  paletaDeMatizes('viva', 'Viva', 'Azul, amarelo, verde e violeta', [212, 42, 142, 270]),
  paletaDeMatizes('oceano', 'Oceano', 'Ciano e turquesa', [186, 198, 172, 208]),
  paletaDeMatizes('ceu', 'Céu', 'Azul forte', [214, 224, 204, 234]),
  paletaDeMatizes('menta', 'Menta', 'Verde esmeralda', [160, 145, 172, 130]),
  paletaDeMatizes('floresta', 'Floresta', 'Oliva e folhagem', [95, 75, 115, 55], 70),
  paletaDeMatizes('citricos', 'Cítricos', 'Âmbar, limão e laranja', [44, 70, 30, 56]),
  paletaDeMatizes('por-do-sol', 'Pôr do sol', 'Laranja, coral e rosa', [16, 38, 350, 26]),
  paletaDeMatizes('rubi', 'Rubi', 'Vermelho e carmim', [0, 10, 350, 20]),
  paletaDeMatizes('berry', 'Frutas vermelhas', 'Magenta, rosa e ameixa', [336, 316, 296, 350]),
  paletaDeMatizes('lavanda', 'Lavanda', 'Índigo e lilás', [250, 266, 236, 282]),
  paletaDeMatizes('terra', 'Terra', 'Argila, marrom e trigo', [22, 40, 12, 52], 46),
  paletaDeMatizes('grafite', 'Grafite', 'Cinza neutro e sóbrio', [215, 200, 230, 210], 12),
];

/** Ids de paletas antigas (removidas por serem parecidas demais) → paleta equivalente. */
const ALIAS_PALETAS: Record<string, string> = {
  'oceano-profundo': 'oceano',
  marinho: 'ceu',
  jade: 'menta',
  pomar: 'floresta',
  girassol: 'citricos',
  coral: 'por-do-sol',
  'rosa-cha': 'berry',
  primavera: 'berry',
  festa: 'viva',
  'neon-suave': 'viva',
  serenidade: 'terra',
};

export function paletaAtividadesPorId(id?: string | null): PaletaAtividade {
  const alvo = (id && ALIAS_PALETAS[id]) || id;
  return PALETAS_ATIVIDADES.find((paleta) => paleta.id === alvo) ??
    PALETAS_ATIVIDADES.find((paleta) => paleta.id === PALETA_PADRAO_ATIVIDADES)!;
}

export function fonteAtividadesPorId(id?: string | null): FonteAtividade {
  return FONTES_ATIVIDADES.find((fonte) => fonte.id === id) ??
    FONTES_ATIVIDADES.find((fonte) => fonte.id === FONTE_PADRAO_ATIVIDADES)!;
}

function hexRgb(cor: string) {
  const normalizada = cor.replace('#', '');
  const valor = normalizada.length === 3
    ? normalizada.split('').map((parte) => parte + parte).join('')
    : normalizada;
  if (!/^[0-9a-fA-F]{6}$/.test(valor)) return null;
  return {
    r: parseInt(valor.slice(0, 2), 16),
    g: parseInt(valor.slice(2, 4), 16),
    b: parseInt(valor.slice(4, 6), 16),
  };
}

function rgbHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('')}`;
}

export function corTextoContraste(cor: string) {
  const rgb = hexRgb(cor);
  if (!rgb) return '#1a3a5c';
  const luminancia = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminancia > 0.57 ? '#14324f' : '#ffffff';
}

function escurecer(cor: string, fator: number) {
  const rgb = hexRgb(cor);
  if (!rgb) return '#1a3a5c';
  return rgbHex(rgb.r * (1 - fator), rgb.g * (1 - fator), rgb.b * (1 - fator));
}

export function paletaAtividadesConfigurada(paletaId: string, coresPersonalizadas?: string[] | null): PaletaAtividade {
  const paleta = paletaAtividadesPorId(paletaId);
  if (!coresPersonalizadas?.length) return paleta;
  return {
    ...paleta,
    cores: paleta.cores.map((cor, indice) => {
      const fundo = coresPersonalizadas[indice];
      if (!fundo || !hexRgb(fundo)) return cor;
      return {
        backgroundColor: fundo,
        borderColor: escurecer(fundo, 0.22),
        accentColor: corTextoContraste(fundo),
      };
    }),
  };
}

export function corCabecalhoDaPaleta(paleta: PaletaAtividade) {
  const original = paletaAtividadesPorId(paleta.id);
  // Antes só comparava o Bloco 1 (índice 0): trocar a cor de qualquer outro
  // bloco pela paleta rápida deixava o cabeçalho (visível em toda a tela)
  // sem mudar nada, dando a impressão de que só temas prontos "aplicavam".
  // Qualquer bloco personalizado já conta como personalização do cabeçalho.
  const foiPersonalizada = paleta.cores.some((cor, indice) => cor.backgroundColor !== original.cores[indice]?.backgroundColor);
  return foiPersonalizada
    ? escurecer(paleta.cores[0]?.backgroundColor ?? '#4d91df', 0.5)
    : original.cores[0]?.accentColor ?? '#1a3a5c';
}

/**
 * Aparência das atividades é por USUÁRIO, não por clube — cada pessoa
 * escolhe a própria e ela só aparece pra ela, em qualquer aparelho em que
 * fizer login. `usuarioId` ausente (ainda carregando a sessão) devolve o
 * padrão sem consultar o banco.
 */
export async function carregarVisualAtividades(usuarioId?: string | null): Promise<VisualAtividadesConfig> {
  if (!usuarioId) {
    return { paletaId: PALETA_PADRAO_ATIVIDADES, coresPersonalizadas: null, fonteId: FONTE_PADRAO_ATIVIDADES };
  }
  const { data, error } = await supabase
    .from('configuracoes_visuais_usuario')
    .select('paleta_atividades,cores_atividades,fonte_atividades')
    .eq('usuario_id', usuarioId)
    .maybeSingle();
  if (error) {
    return { paletaId: PALETA_PADRAO_ATIVIDADES, coresPersonalizadas: null, fonteId: FONTE_PADRAO_ATIVIDADES };
  }
  return {
    paletaId: paletaAtividadesPorId(data?.paleta_atividades).id,
    coresPersonalizadas: Array.isArray(data?.cores_atividades) ? data.cores_atividades : null,
    fonteId: data?.fonte_atividades ?? FONTE_PADRAO_ATIVIDADES,
  };
}

export async function salvarVisualAtividades(usuarioId: string, config: VisualAtividadesConfig) {
  const { error } = await supabase
    .from('configuracoes_visuais_usuario')
    .upsert({
      usuario_id: usuarioId,
      paleta_atividades: config.paletaId,
      cores_atividades: config.coresPersonalizadas,
      fonte_atividades: config.fonteId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'usuario_id' });
  if (error) throw error;
}

function hexParaRgb(cor: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(cor.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function misturar(a: [number, number, number], b: [number, number, number], t: number): string {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Versão do bloco colorido para o modo escuro. As cores da paleta são pastéis
 * claros, que no tema escuro deixavam o texto (branco/claro) ilegível: o fundo
 * vira um tom escuro tingido pela cor do bloco e o destaque é clareado.
 */
export function corBlocoModoEscuro(cor: CorBlocoAtividade): CorBlocoAtividade {
  const destaque = hexParaRgb(cor.accentColor) ?? hexParaRgb(cor.borderColor) ?? hexParaRgb(cor.backgroundColor);
  if (!destaque) return cor;
  const superficie: [number, number, number] = [26, 37, 48];
  return {
    backgroundColor: misturar(superficie, destaque, 0.2),
    borderColor: misturar(superficie, destaque, 0.55),
    accentColor: misturar(destaque, [255, 255, 255], 0.55),
  };
}

/**
 * Cores de marca do redesign (cabeçalho, abas ativas, destaques) por paleta,
 * iguais às do protótipo aprovado: [primária, secundária]. Paletas que não
 * estão no protótipo derivam a primária da própria paleta.
 */
const MARCA_POR_PALETA: Record<string, [string, string]> = {
  viva: ['#7c39e7', '#ffdf38'],
  oceano: ['#0891b2', '#fde047'],
  ceu: ['#2563eb', '#ffdf38'],
  menta: ['#0f9d7a', '#fde68a'],
  floresta: ['#4d7c0f', '#fcd34d'],
  citricos: ['#c27c0e', '#2dd4bf'],
  'por-do-sol': ['#e0582f', '#ffd151'],
  rubi: ['#c0262d', '#fde047'],
  berry: ['#c026a3', '#ffe14d'],
  lavanda: ['#5b4fd6', '#ffcf4d'],
  terra: ['#8a5a3c', '#f0c36a'],
  grafite: ['#3f4a5a', '#ffd151'],
};

export function coresMarcaDaPaleta(paleta: PaletaAtividade): { primaria: string; secundaria: string } {
  const original = paletaAtividadesPorId(paleta.id);
  const personalizada = paleta.cores.some((cor, indice) => cor.backgroundColor !== original.cores[indice]?.backgroundColor);
  const marca = MARCA_POR_PALETA[paleta.id];
  if (marca && !personalizada) return { primaria: marca[0], secundaria: marca[1] };
  return { primaria: corCabecalhoDaPaleta(paleta), secundaria: marca?.[1] ?? '#ffdf38' };
}
