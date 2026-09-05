import { create } from 'zustand';
import {
  carregarVisualAtividades,
  paletaAtividadesConfigurada,
  corCabecalhoDaPaleta,
} from '../lib/paletaAtividades';

export const COR_CABECALHO_PADRAO = '#1a3a5c';

interface AparenciaState {
  corCabecalho: string;
  carregando: boolean;
  /** Busca a aparência do usuário e atualiza corCabecalho para o app inteiro. */
  carregar: (usuarioId?: string | null) => Promise<void>;
  /** Aplica na hora, sem esperar recarregar — usado ao salvar em Aparência. */
  definirCorCabecalho: (cor: string) => void;
}

/**
 * Fonte única da cor de cabeçalho: antes só a tela Início lia a paleta do
 * usuário (carregarVisualAtividades) e aplicava no próprio cabeçalho — todas
 * as outras telas (Classes, Ranking, Membros etc.) tinham a cor fixa
 * ('#1a3a5c') no StyleSheet, então nunca acompanhavam a personalização e o
 * cabeçalho mudava de tom ao trocar de tela. Este store é populado uma vez
 * (ver app/_layout.tsx) e todas as telas leem o mesmo valor.
 */
export const useAparenciaStore = create<AparenciaState>((set) => ({
  corCabecalho: COR_CABECALHO_PADRAO,
  carregando: false,
  carregar: async (usuarioId) => {
    set({ carregando: true });
    try {
      const config = await carregarVisualAtividades(usuarioId);
      const paleta = paletaAtividadesConfigurada(config.paletaId, config.coresPersonalizadas);
      set({ corCabecalho: corCabecalhoDaPaleta(paleta) || COR_CABECALHO_PADRAO });
    } catch {
      set({ corCabecalho: COR_CABECALHO_PADRAO });
    } finally {
      set({ carregando: false });
    }
  },
  definirCorCabecalho: (cor) => set({ corCabecalho: cor || COR_CABECALHO_PADRAO }),
}));
