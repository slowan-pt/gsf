import { create } from 'zustand';

interface AtualizacaoState {
  /** Link da App Store quando há versão mais nova (só iOS); null = nada a fazer. */
  urlLoja: string | null;
  versaoLoja: string | null;
  definir: (urlLoja: string | null, versaoLoja: string | null) => void;
}

export const useAtualizacaoStore = create<AtualizacaoState>((set) => ({
  urlLoja: null,
  versaoLoja: null,
  definir: (urlLoja, versaoLoja) => set({ urlLoja, versaoLoja }),
}));
