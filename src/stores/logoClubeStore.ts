import { create } from 'zustand';

interface LogoClubeState {
  logos: Record<number, string | null | undefined>;
  versoes: Record<number, number>;
  atualizarLogoClube: (clubeId: number, logoUrl: string | null) => void;
}

export const useLogoClubeStore = create<LogoClubeState>((set) => ({
  logos: {},
  versoes: {},
  atualizarLogoClube: (clubeId, logoUrl) => {
    set((state) => ({
      logos: { ...state.logos, [clubeId]: logoUrl },
      versoes: { ...state.versoes, [clubeId]: Date.now() },
    }));
  },
}));
