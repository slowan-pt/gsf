import { create } from 'zustand';

export type EstadoSincronia =
  | 'ocioso'
  /** Gravado no aparelho, ainda não enviado ao servidor. */
  | 'local'
  | 'enviando'
  /** Já está no servidor, visível para todo mundo. */
  | 'concluido'
  | 'erro';

interface SincroniaState {
  estado: EstadoSincronia;
  /** Quantos registros ainda esperam envio. */
  pendentes: number;
  /** Quantos registros o último envio ignorou por já estarem iguais no servidor. */
  ignorados: number;
  marcarLocal: (pendentes?: number) => void;
  marcarEnviando: () => void;
  marcarConcluido: (ignorados?: number) => void;
  marcarErro: () => void;
  limpar: () => void;
}

/** Some sozinho depois de confirmar o envio, para a tarja não ficar na tela. */
const MS_ATE_SUMIR = 2600;
let temporizador: ReturnType<typeof setTimeout> | null = null;

function cancelarSumico() {
  if (temporizador) {
    clearTimeout(temporizador);
    temporizador = null;
  }
}

export const useSincroniaStore = create<SincroniaState>((set) => ({
  estado: 'ocioso',
  pendentes: 0,
  ignorados: 0,

  marcarLocal: (pendentes) => {
    cancelarSumico();
    set((s) => ({ estado: 'local', pendentes: pendentes ?? s.pendentes + 1 }));
  },

  marcarEnviando: () => {
    cancelarSumico();
    set({ estado: 'enviando' });
  },

  marcarConcluido: (ignorados = 0) => {
    cancelarSumico();
    set({ estado: 'concluido', pendentes: 0, ignorados });
    temporizador = setTimeout(() => {
      temporizador = null;
      set({ estado: 'ocioso', ignorados: 0 });
    }, MS_ATE_SUMIR);
  },

  marcarErro: () => {
    cancelarSumico();
    set({ estado: 'erro' });
  },

  limpar: () => {
    cancelarSumico();
    set({ estado: 'ocioso', pendentes: 0, ignorados: 0 });
  },
}));
