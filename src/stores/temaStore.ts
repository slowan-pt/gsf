import { create } from 'zustand';
import { CORES_CLARO, coresPorModo, type CoresTema } from '../lib/tema';
import { carregarModoEscuro, salvarModoEscuro } from '../lib/temaConfig';

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
