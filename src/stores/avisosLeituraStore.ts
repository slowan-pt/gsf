import { create } from 'zustand';

interface AvisosLeituraState {
  revisao: number;
  registrarAlteracao: () => void;
}

export const useAvisosLeituraStore = create<AvisosLeituraState>((set) => ({
  revisao: 0,
  registrarAlteracao: () => set((estado) => ({ revisao: estado.revisao + 1 })),
}));
