import { create } from 'zustand';
import {
  carregarVisualAtividades,
  paletaAtividadesConfigurada,
  coresMarcaDaPaleta,
  type PaletaAtividade,
} from '../lib/paletaAtividades';

export const COR_CABECALHO_PADRAO = '#7c39e7';
export const COR_SECUNDARIA_PADRAO = '#ffdf38';

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
export const useAparenciaStore = create<AparenciaState>((set) => ({
  corCabecalho: COR_CABECALHO_PADRAO,
  corSecundaria: COR_SECUNDARIA_PADRAO,
  carregando: false,
  carregar: async (usuarioId) => {
    set({ carregando: true });
    try {
      const config = await carregarVisualAtividades(usuarioId);
      const paleta = paletaAtividadesConfigurada(config.paletaId, config.coresPersonalizadas);
      const marca = coresMarcaDaPaleta(paleta);
      set({ corCabecalho: marca.primaria || COR_CABECALHO_PADRAO, corSecundaria: marca.secundaria || COR_SECUNDARIA_PADRAO });
    } catch {
      set({ corCabecalho: COR_CABECALHO_PADRAO, corSecundaria: COR_SECUNDARIA_PADRAO });
    } finally {
      set({ carregando: false });
    }
  },
  definirCorCabecalho: (cor) => set({ corCabecalho: cor || COR_CABECALHO_PADRAO }),
  definirPaleta: (paleta) => {
    const marca = coresMarcaDaPaleta(paleta);
    set({ corCabecalho: marca.primaria, corSecundaria: marca.secundaria });
  },
}));
