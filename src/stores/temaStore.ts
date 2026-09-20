import { create } from 'zustand';
import { CORES_CLARO, coresPorModo, corCabecalhoPorTema, type CoresTema } from '../lib/tema';
import { carregarModoEscuro, salvarModoEscuro } from '../lib/temaConfig';
import { useAparenciaStore } from './aparenciaStore';

interface TemaState {
  escuro: boolean;
  cores: CoresTema;
  carregando: boolean;
  carregar: (usuarioId?: string | null) => Promise<void>;
  definirModoEscuro: (usuarioId: string | undefined | null, escuro: boolean) => Promise<void>;
}

export const useTemaStore = create<TemaState>((set) => ({
  escuro: false,
  cores: CORES_CLARO,
  carregando: true,

  carregar: async (usuarioId) => {
    const escuro = await carregarModoEscuro(usuarioId);
    set({ escuro, cores: coresPorModo(escuro), carregando: false });
  },

  definirModoEscuro: async (usuarioId, escuro) => {
    set({ escuro, cores: coresPorModo(escuro) });
    if (usuarioId) {
      try {
        await salvarModoEscuro(usuarioId, escuro);
      } catch {
        // Falha ao salvar não desfaz a troca visual local — só não persiste
        // pros outros aparelhos até uma próxima tentativa.
      }
    }
  },
}));

/** Atalho pras telas: `const cores = useCores();` */
export function useCores(): CoresTema {
  return useTemaStore((s) => s.cores);
}

/**
 * Cor do cabeçalho já ajustada ao tema. Todas as telas usam este hook em vez
 * de ler `corCabecalho` direto do aparenciaStore: assim a faixa do topo
 * acompanha o modo escuro num lugar só, sem depender de cada tela lembrar.
 */
export function useCorCabecalho(): string {
  const escuro = useTemaStore((s) => s.escuro);
  const cor = useAparenciaStore((s) => s.corCabecalho);
  return corCabecalhoPorTema(cor, escuro);
}
