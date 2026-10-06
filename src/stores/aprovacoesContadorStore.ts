import { create } from 'zustand';

/** Quantas classes aguardam a aprovação de quem está logado (mostrado no menu inferior). */
interface ContadorState {
  total: number;
  definir: (total: number) => void;
}

export const useAprovacoesContador = create<ContadorState>((set) => ({
  total: 0,
  definir: (total) => set({ total }),
}));
