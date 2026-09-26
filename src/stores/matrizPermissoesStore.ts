import { create } from 'zustand';

/** Sobe a cada vez que a matriz de permissões muda, para os componentes recalcularem. */
export const useMatrizPermissoesStore = create<{ versao: number; subir: () => void }>((set) => ({
  versao: 0,
  subir: () => set((s) => ({ versao: s.versao + 1 })),
}));
