import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  carregarVisualAtividades,
  paletaAtividadesConfigurada,
  coresMarcaDaPaleta,
  PALETAS_ATIVIDADES,
  type PaletaAtividade,
} from '../lib/paletaAtividades';

export const COR_CABECALHO_PADRAO = '#7c39e7';
export const COR_SECUNDARIA_PADRAO = '#ffdf38';

const MARCA_LOCAL_KEY = 'ultima_marca_aparelho_v1';

interface MarcaLocal { primaria: string; secundaria: string }

const ehHex = (c: unknown): c is string => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);

function lerMarcaLocal(): MarcaLocal | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(MARCA_LOCAL_KEY) : null;
    if (!raw) return null;
    const m = JSON.parse(raw);
    return ehHex(m?.primaria) && ehHex(m?.secundaria) ? { primaria: m.primaria, secundaria: m.secundaria } : null;
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
  carregando: boolean;
  /** Busca a aparência do usuário e atualiza corCabecalho para o app inteiro. */
  carregar: (usuarioId?: string | null) => Promise<void>;
  /** Aplica na hora, sem esperar recarregar — usado ao salvar em Aparência. */
  definirCorCabecalho: (cor: string) => void;
  /** Lê a última marca usada neste aparelho (ou sorteia e guarda uma) — tela de login, antes de saber quem é o usuário. */
  iniciarMarcaLocal: () => Promise<void>;
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

export const useAparenciaStore = create<AparenciaState>((set) => ({
  corCabecalho: marcaInicial?.primaria ?? COR_CABECALHO_PADRAO,
  corSecundaria: marcaInicial?.secundaria ?? COR_SECUNDARIA_PADRAO,
  carregando: false,
  carregar: async (usuarioId) => {
    set({ carregando: true });
    try {
      const config = await carregarVisualAtividades(usuarioId);
      const paleta = paletaAtividadesConfigurada(config.paletaId, config.coresPersonalizadas);
      const marca = coresMarcaDaPaleta(paleta);
      const aplicada = { primaria: marca.primaria || COR_CABECALHO_PADRAO, secundaria: marca.secundaria || COR_SECUNDARIA_PADRAO };
      marcaDoUsuarioAplicada = true;
      set({ corCabecalho: aplicada.primaria, corSecundaria: aplicada.secundaria });
      gravarMarcaLocal(aplicada);
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
    gravarMarcaLocal({ primaria: marca.primaria, secundaria: marca.secundaria });
  },
  iniciarMarcaLocal: async () => {
    let marca = lerMarcaLocal();
    if (!marca) {
      try {
        const raw = await AsyncStorage.getItem(MARCA_LOCAL_KEY);
        const m = raw ? JSON.parse(raw) : null;
        if (ehHex(m?.primaria) && ehHex(m?.secundaria)) marca = { primaria: m.primaria, secundaria: m.secundaria };
      } catch {}
    }
    if (!marca) {
      marca = marcaAleatoria();
      gravarMarcaLocal(marca);
    }
    if (!marcaDoUsuarioAplicada) set({ corCabecalho: marca.primaria, corSecundaria: marca.secundaria });
  },
}));

void useAparenciaStore.getState().iniciarMarcaLocal();
