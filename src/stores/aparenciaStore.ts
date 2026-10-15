import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  carregarVisualAtividades,
  paletaAtividadesConfigurada,
  coresMarcaDaPaleta,
  PALETAS_ATIVIDADES,
  type PaletaAtividade,
} from '../lib/paletaAtividades';
import { aplicarFonteGlobal, definirCorTextoGlobal } from '../lib/fonteGlobal';

export const COR_CABECALHO_PADRAO = '#7c39e7';
export const COR_SECUNDARIA_PADRAO = '#ffdf38';

const MARCA_LOCAL_KEY = 'ultima_marca_aparelho_v1';

interface MarcaLocal { primaria: string; secundaria: string; degradeAtivo?: boolean; corDegrade?: string | null; fonteId?: string; corTexto?: string | null }

const ehHex = (c: unknown): c is string => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);

function lerMarcaLocal(): MarcaLocal | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(MARCA_LOCAL_KEY) : null;
    if (!raw) return null;
    const m = JSON.parse(raw);
    return ehHex(m?.primaria) && ehHex(m?.secundaria)
      ? { primaria: m.primaria, secundaria: m.secundaria, degradeAtivo: m.degradeAtivo !== false, corDegrade: ehHex(m.corDegrade) ? m.corDegrade : null, fonteId: typeof m.fonteId === 'string' ? m.fonteId : undefined, corTexto: ehHex(m.corTexto) ? m.corTexto : null }
      : null;
  } catch {
    return null;
  }
}

function gravarMarcaLocal(marca: MarcaLocal) {
  const raw = JSON.stringify(marca);
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(MARCA_LOCAL_KEY, raw); } catch {}
  AsyncStorage.setItem(MARCA_LOCAL_KEY, raw).catch(() => {});
}

/** Sorteia uma paleta (uma só vez por aparelho) para quem ainda não escolheu nenhuma. */
function marcaAleatoria(): MarcaLocal {
  const p = PALETAS_ATIVIDADES[Math.floor(Math.random() * PALETAS_ATIVIDADES.length)];
  const m = coresMarcaDaPaleta(p);
  return { primaria: m.primaria, secundaria: m.secundaria };
}

interface AparenciaState {
  /** Cor primária da marca (cabeçalho, abas ativas, destaques). */
  corCabecalho: string;
  /** Cor secundária da marca (carrosséis, botão Ler hoje, pontos). */
  corSecundaria: string;
  /** Degradê do cabeçalho ligado; desligado = cor lisa. */
  degradeAtivo: boolean;
  /** Cor final do degradê escolhida pelo usuário; null = automática. */
  corDegrade: string | null;
  /** Fonte escolhida em Aparência (vale para o app inteiro). */
  fonteId: string;
  /** Cor do texto escolhida em Aparência (null = a padrão do tema). */
  corTexto: string | null;
  carregando: boolean;
  /** Busca a aparência do usuário e atualiza corCabecalho para o app inteiro. */
  carregar: (usuarioId?: string | null) => Promise<void>;
  /** Aplica na hora, sem esperar recarregar — usado ao salvar em Aparência. */
  definirCorCabecalho: (cor: string) => void;
  /** Lê a última marca usada neste aparelho (ou sorteia e guarda uma) — tela de login, antes de saber quem é o usuário. */
  iniciarMarcaLocal: () => Promise<void>;
  /** Troca a fonte do app inteiro na hora. */
  definirFonte: (fonteId: string) => void;
  /** Troca a cor dos textos do app inteiro na hora (null = padrão). */
  definirCorTexto: (cor: string | null) => void;
  /** Liga/desliga o degradê e define a cor final (null = automática). */
  definirDegrade: (ativo: boolean, cor: string | null) => void;
  /** Aplica primária e secundária da paleta escolhida. */
  definirPaleta: (paleta: PaletaAtividade) => void;
}

/**
 * Fonte única da cor de cabeçalho: antes só a tela Início lia a paleta do
 * usuário (carregarVisualAtividades) e aplicava no próprio cabeçalho — todas
 * as outras telas (Classes, Ranking, Membros etc.) tinham a cor fixa
 * ('#4b2bb0') no StyleSheet, então nunca acompanhavam a personalização e o
 * cabeçalho mudava de tom ao trocar de tela. Este store é populado uma vez
 * (ver app/_layout.tsx) e todas as telas leem o mesmo valor.
 */
// A marca real do usuário (carregar/definirPaleta) sempre vence a lida do aparelho.
let marcaDoUsuarioAplicada = false;
const marcaInicial = lerMarcaLocal();

export const useAparenciaStore = create<AparenciaState>((set, get) => ({
  corCabecalho: marcaInicial?.primaria ?? COR_CABECALHO_PADRAO,
  corSecundaria: marcaInicial?.secundaria ?? COR_SECUNDARIA_PADRAO,
  degradeAtivo: marcaInicial?.degradeAtivo ?? true,
  corDegrade: marcaInicial?.corDegrade ?? null,
  fonteId: marcaInicial?.fonteId ?? 'padrao',
  corTexto: marcaInicial?.corTexto ?? null,
  carregando: false,
  carregar: async (usuarioId) => {
    set({ carregando: true });
    try {
      const config = await carregarVisualAtividades(usuarioId);
      const paleta = paletaAtividadesConfigurada(config.paletaId, config.coresPersonalizadas);
      const marca = coresMarcaDaPaleta(paleta);
      const degradeAtivo = config.degradeAtivo !== false;
      const corDegrade = ehHex(config.corDegrade) ? config.corDegrade : null;
      const aplicada = { primaria: marca.primaria || COR_CABECALHO_PADRAO, secundaria: marca.secundaria || COR_SECUNDARIA_PADRAO, degradeAtivo, corDegrade, fonteId: config.fonteId, corTexto: get().corTexto };
      marcaDoUsuarioAplicada = true;
      set({ corCabecalho: aplicada.primaria, corSecundaria: aplicada.secundaria, degradeAtivo, corDegrade, fonteId: config.fonteId });
      gravarMarcaLocal(aplicada);
      void aplicarFonteGlobal(config.fonteId);
    } catch {
      set({ corCabecalho: COR_CABECALHO_PADRAO, corSecundaria: COR_SECUNDARIA_PADRAO });
    } finally {
      set({ carregando: false });
    }
  },
  definirCorCabecalho: (cor) => set({ corCabecalho: cor || COR_CABECALHO_PADRAO }),
  definirPaleta: (paleta) => {
    const marca = coresMarcaDaPaleta(paleta);
    marcaDoUsuarioAplicada = true;
    set({ corCabecalho: marca.primaria, corSecundaria: marca.secundaria });
    const { degradeAtivo, corDegrade, fonteId, corTexto } = get();
    gravarMarcaLocal({ primaria: marca.primaria, secundaria: marca.secundaria, degradeAtivo, corDegrade, fonteId, corTexto });
  },
  definirDegrade: (ativo, cor) => {
    const corDegrade = ehHex(cor) ? cor : null;
    set({ degradeAtivo: ativo, corDegrade });
    const { corCabecalho, corSecundaria, fonteId, corTexto } = get();
    gravarMarcaLocal({ primaria: corCabecalho, secundaria: corSecundaria, degradeAtivo: ativo, corDegrade, fonteId, corTexto });
  },
  definirFonte: (fonteId) => {
    set({ fonteId });
    const { corCabecalho, corSecundaria, degradeAtivo, corDegrade, corTexto } = get();
    gravarMarcaLocal({ primaria: corCabecalho, secundaria: corSecundaria, degradeAtivo, corDegrade, fonteId, corTexto });
    void aplicarFonteGlobal(fonteId);
  },
  definirCorTexto: (cor) => {
    const corTexto = ehHex(cor) ? cor : null;
    set({ corTexto });
    const { corCabecalho, corSecundaria, degradeAtivo, corDegrade, fonteId } = get();
    gravarMarcaLocal({ primaria: corCabecalho, secundaria: corSecundaria, degradeAtivo, corDegrade, fonteId, corTexto });
    definirCorTextoGlobal(corTexto);
  },
  iniciarMarcaLocal: async () => {
    let marca = lerMarcaLocal();
    if (!marca) {
      try {
        const raw = await AsyncStorage.getItem(MARCA_LOCAL_KEY);
        const m = raw ? JSON.parse(raw) : null;
        if (ehHex(m?.primaria) && ehHex(m?.secundaria)) marca = { primaria: m.primaria, secundaria: m.secundaria, degradeAtivo: m.degradeAtivo !== false, corDegrade: ehHex(m.corDegrade) ? m.corDegrade : null, fonteId: typeof m.fonteId === 'string' ? m.fonteId : undefined, corTexto: ehHex(m.corTexto) ? m.corTexto : null };
      } catch {}
    }
    if (!marca) {
      marca = marcaAleatoria();
      gravarMarcaLocal(marca);
    }
    if (!marcaDoUsuarioAplicada) set({ corCabecalho: marca.primaria, corSecundaria: marca.secundaria, degradeAtivo: marca.degradeAtivo !== false, corDegrade: marca.corDegrade ?? null, fonteId: marca.fonteId ?? get().fonteId, corTexto: marca.corTexto ?? null });
    void aplicarFonteGlobal(get().fonteId);
    definirCorTextoGlobal(get().corTexto);
  },
}));

void useAparenciaStore.getState().iniciarMarcaLocal();
// A fonte do último uso vale já na abertura do app (antes de saber quem é o usuário).
void aplicarFonteGlobal(useAparenciaStore.getState().fonteId);
definirCorTextoGlobal(useAparenciaStore.getState().corTexto);
