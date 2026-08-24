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

// As combinacoes mantem fundo claro com texto de alto contraste e blocos bem distinguiveis.
export const PALETAS_ATIVIDADES: PaletaAtividade[] = [
  { id: 'viva', nome: 'Viva', descricao: 'Azul, amarelo, verde e violeta', cores: [
    { backgroundColor: '#d8ebff', borderColor: '#4d91df', accentColor: '#0f4f97' },
    { backgroundColor: '#ffe9ba', borderColor: '#e6a72e', accentColor: '#855400' },
    { backgroundColor: '#d2f1dc', borderColor: '#48a76c', accentColor: '#176237' },
    { backgroundColor: '#ebddff', borderColor: '#9a63da', accentColor: '#54248f' },
  ] },
  { id: 'oceano', nome: 'Oceano', descricao: 'Azuis e turquesas', cores: [
    { backgroundColor: '#d6f4f4', borderColor: '#32a7ad', accentColor: '#075d64' },
    { backgroundColor: '#d9edff', borderColor: '#3b91da', accentColor: '#124e8a' },
    { backgroundColor: '#cdeee9', borderColor: '#38a294', accentColor: '#0b6156' },
    { backgroundColor: '#dbe5ff', borderColor: '#6687da', accentColor: '#344d96' },
  ] },
  { id: 'pomar', nome: 'Pomar', descricao: 'Verde, limao e pessego', cores: [
    { backgroundColor: '#dbf1d3', borderColor: '#65ad4a', accentColor: '#2c6420' },
    { backgroundColor: '#eef5c6', borderColor: '#a2b93c', accentColor: '#596c09' },
    { backgroundColor: '#ffe2c6', borderColor: '#dc8640', accentColor: '#8b4212' },
    { backgroundColor: '#d1efde', borderColor: '#4aa978', accentColor: '#16633e' },
  ] },
  { id: 'por-do-sol', nome: 'Por do sol', descricao: 'Coral, ouro e rosa', cores: [
    { backgroundColor: '#ffe0d3', borderColor: '#df7146', accentColor: '#8d3211' },
    { backgroundColor: '#ffeab7', borderColor: '#dc9c21', accentColor: '#775000' },
    { backgroundColor: '#ffdbe2', borderColor: '#da6078', accentColor: '#85233c' },
    { backgroundColor: '#f5dfcf', borderColor: '#bf8050', accentColor: '#703914' },
  ] },
  { id: 'floresta', nome: 'Floresta', descricao: 'Folhagem e terra', cores: [
    { backgroundColor: '#d9edd9', borderColor: '#559862', accentColor: '#215430' },
    { backgroundColor: '#e8efcb', borderColor: '#8da748', accentColor: '#4b6110' },
    { backgroundColor: '#eee2cb', borderColor: '#aa7d41', accentColor: '#634311' },
    { backgroundColor: '#d3e9df', borderColor: '#458b70', accentColor: '#16503a' },
  ] },
  { id: 'berry', nome: 'Frutas vermelhas', descricao: 'Rosa, uva e ameixa', cores: [
    { backgroundColor: '#ffdee8', borderColor: '#d55681', accentColor: '#822041' },
    { backgroundColor: '#ecdfff', borderColor: '#9763d1', accentColor: '#542783' },
    { backgroundColor: '#f8dfea', borderColor: '#bc5e89', accentColor: '#71203e' },
    { backgroundColor: '#ead9eb', borderColor: '#8e6090', accentColor: '#512854' },
  ] },
  { id: 'ceu', nome: 'Ceu claro', descricao: 'Azul suave com contraste', cores: [
    { backgroundColor: '#d6eaff', borderColor: '#508ed4', accentColor: '#124b87' },
    { backgroundColor: '#e4f2ff', borderColor: '#69a0d6', accentColor: '#28557f' },
    { backgroundColor: '#d3e4fa', borderColor: '#527cc0', accentColor: '#243f78' },
    { backgroundColor: '#e1eaff', borderColor: '#6b84cd', accentColor: '#354987' },
  ] },
  { id: 'menta', nome: 'Menta', descricao: 'Fresca e leve', cores: [
    { backgroundColor: '#d6f5eb', borderColor: '#40ac89', accentColor: '#0d6148' },
    { backgroundColor: '#e1f6d8', borderColor: '#67ad4d', accentColor: '#326617' },
    { backgroundColor: '#d5f0ef', borderColor: '#45a4aa', accentColor: '#115c62' },
    { backgroundColor: '#e6f3d5', borderColor: '#8fa744', accentColor: '#4c6011' },
  ] },
  { id: 'lavanda', nome: 'Lavanda', descricao: 'Violeta e lilas', cores: [
    { backgroundColor: '#eadcff', borderColor: '#9460d2', accentColor: '#512584' },
    { backgroundColor: '#f2defc', borderColor: '#ae62c3', accentColor: '#642878' },
    { backgroundColor: '#e4e0ff', borderColor: '#756bd3', accentColor: '#382e87' },
    { backgroundColor: '#f5deee', borderColor: '#bc6093', accentColor: '#742449' },
  ] },
  { id: 'citricos', nome: 'Citricos', descricao: 'Laranja e limao', cores: [
    { backgroundColor: '#ffedc2', borderColor: '#db9b24', accentColor: '#774d00' },
    { backgroundColor: '#eaf5c3', borderColor: '#99b637', accentColor: '#526500' },
    { backgroundColor: '#ffe0bf', borderColor: '#e28435', accentColor: '#873f06' },
    { backgroundColor: '#f2eeaf', borderColor: '#b5a929', accentColor: '#665b00' },
  ] },
  { id: 'coral', nome: 'Coral', descricao: 'Quente e acolhedora', cores: [
    { backgroundColor: '#ffdbd2', borderColor: '#df6856', accentColor: '#882719' },
    { backgroundColor: '#ffe1d0', borderColor: '#db784d', accentColor: '#813410' },
    { backgroundColor: '#ffddd9', borderColor: '#d85f65', accentColor: '#81262c' },
    { backgroundColor: '#ffe8dc', borderColor: '#d98c57', accentColor: '#784217' },
  ] },
  { id: 'jade', nome: 'Jade', descricao: 'Verdes profundos', cores: [
    { backgroundColor: '#d2eedf', borderColor: '#3c9a68', accentColor: '#125634' },
    { backgroundColor: '#d5ebe4', borderColor: '#3b907a', accentColor: '#105141' },
    { backgroundColor: '#d9f2d3', borderColor: '#5a9c4d', accentColor: '#286020' },
    { backgroundColor: '#cae9df', borderColor: '#32917b', accentColor: '#075245' },
  ] },
  { id: 'marinho', nome: 'Marinho', descricao: 'Azul institucional', cores: [
    { backgroundColor: '#d9e5f4', borderColor: '#557cae', accentColor: '#193e70' },
    { backgroundColor: '#e1e9f3', borderColor: '#647f9d', accentColor: '#2d485f' },
    { backgroundColor: '#d4e5ed', borderColor: '#4d8197', accentColor: '#184d61' },
    { backgroundColor: '#dce0f1', borderColor: '#666fa7', accentColor: '#343d75' },
  ] },
  { id: 'festa', nome: 'Festa', descricao: 'Colorida e forte', cores: [
    { backgroundColor: '#d2edff', borderColor: '#368ecc', accentColor: '#075180' },
    { backgroundColor: '#ffe1d2', borderColor: '#e46e42', accentColor: '#8d320c' },
    { backgroundColor: '#d5f2d9', borderColor: '#45a45a', accentColor: '#17612a' },
    { backgroundColor: '#ffe1f0', borderColor: '#d55e98', accentColor: '#80224e' },
  ] },
  { id: 'girassol', nome: 'Girassol', descricao: 'Ouro e folhas', cores: [
    { backgroundColor: '#fff0b9', borderColor: '#d6a123', accentColor: '#765000' },
    { backgroundColor: '#e4f0ce', borderColor: '#85a949', accentColor: '#476116' },
    { backgroundColor: '#ffe6ae', borderColor: '#d58b14', accentColor: '#774400' },
    { backgroundColor: '#d6edca', borderColor: '#5e9a45', accentColor: '#2f5c17' },
  ] },
  { id: 'oceano-profundo', nome: 'Oceano profundo', descricao: 'Petroleo e safira', cores: [
    { backgroundColor: '#d0edf0', borderColor: '#24848f', accentColor: '#084c55' },
    { backgroundColor: '#d1e5fa', borderColor: '#316faa', accentColor: '#113d6c' },
    { backgroundColor: '#d4eee7', borderColor: '#2f8b72', accentColor: '#0b5140' },
    { backgroundColor: '#d5dcf6', borderColor: '#5065ac', accentColor: '#253876' },
  ] },
  { id: 'rosa-cha', nome: 'Rosa cha', descricao: 'Rosado e neutro', cores: [
    { backgroundColor: '#f8e0e5', borderColor: '#bc697c', accentColor: '#70293a' },
    { backgroundColor: '#f1e5da', borderColor: '#ac8060', accentColor: '#63432b' },
    { backgroundColor: '#f4dee9', borderColor: '#b8698e', accentColor: '#6c2946' },
    { backgroundColor: '#ede2ed', borderColor: '#907090', accentColor: '#503851' },
  ] },
  { id: 'primavera', nome: 'Primavera', descricao: 'Flores e folhas', cores: [
    { backgroundColor: '#ffe1ed', borderColor: '#d65d91', accentColor: '#801e4e' },
    { backgroundColor: '#e0f3d6', borderColor: '#6da64e', accentColor: '#396218' },
    { backgroundColor: '#ffecc6', borderColor: '#dda52a', accentColor: '#775100' },
    { backgroundColor: '#e7dfff', borderColor: '#8566cb', accentColor: '#47268a' },
  ] },
  { id: 'terra', nome: 'Terra', descricao: 'Argila, musgo e trigo', cores: [
    { backgroundColor: '#f1dfd1', borderColor: '#b67651', accentColor: '#663819' },
    { backgroundColor: '#e2e7ca', borderColor: '#89984d', accentColor: '#4a551a' },
    { backgroundColor: '#f3e5c6', borderColor: '#bf9842', accentColor: '#684a0e' },
    { backgroundColor: '#e6ddd6', borderColor: '#96745e', accentColor: '#503728' },
  ] },
  { id: 'neon-suave', nome: 'Neon suave', descricao: 'Vibrante sem perder leitura', cores: [
    { backgroundColor: '#cff4ff', borderColor: '#24a8ce', accentColor: '#005a77' },
    { backgroundColor: '#e7ffc4', borderColor: '#82b42e', accentColor: '#416700' },
    { backgroundColor: '#ffddf4', borderColor: '#d34f9a', accentColor: '#7d154d' },
    { backgroundColor: '#ffe5b8', borderColor: '#e29317', accentColor: '#774500' },
  ] },
  { id: 'serenidade', nome: 'Serenidade', descricao: 'Calma e equilibrada', cores: [
    { backgroundColor: '#dcebf0', borderColor: '#6692a0', accentColor: '#2b515e' },
    { backgroundColor: '#e1eadc', borderColor: '#789568', accentColor: '#3f5c32' },
    { backgroundColor: '#ebe3d9', borderColor: '#9b8164', accentColor: '#59442d' },
    { backgroundColor: '#e5dfed', borderColor: '#84749c', accentColor: '#493c61' },
  ] },
];

export function paletaAtividadesPorId(id?: string | null): PaletaAtividade {
  return PALETAS_ATIVIDADES.find((paleta) => paleta.id === id) ??
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
  const foiPersonalizada = paleta.cores[0]?.backgroundColor !== original.cores[0]?.backgroundColor;
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
    paletaId: data?.paleta_atividades ?? PALETA_PADRAO_ATIVIDADES,
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
