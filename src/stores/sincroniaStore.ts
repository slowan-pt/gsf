import { create } from 'zustand';

export type EstadoSincronia =
  | 'ocioso'
  /** Gravado no aparelho, ainda não enviado ao servidor. */
  | 'local'
  | 'enviando'
  /** Já está no servidor, visível para todo mundo. */
  | 'concluido'
  | 'erro';

/** Download inicial que passou dos 30s e seguiu rodando em segundo plano. */
export type EstadoCargaInicial = 'ocioso' | 'baixando' | 'concluida' | 'incompleta';

interface SincroniaState {
  estado: EstadoSincronia;
  /** Quantos registros ainda esperam envio. */
  pendentes: number;
  /** Quantos registros o último envio ignorou por já estarem iguais no servidor. */
  ignorados: number;
  cargaInicial: EstadoCargaInicial;
  /** Progresso do download em segundo plano, para a tarja dizer o que falta. */
  cargaFeitas: number;
  cargaTotal: number;
  cargaRotulo: string;
  /** A tarja de download só aparece uma vez, nos primeiros segundos. */
  cargaAvisoVisivel: boolean;
  atualizarProgressoCarga: (feitas: number, total: number, rotulo: string) => void;
  marcarLocal: (pendentes?: number) => void;
  marcarEnviando: () => void;
  marcarConcluido: (ignorados?: number) => void;
  marcarErro: () => void;
  iniciarCargaSegundoPlano: () => void;
  finalizarCargaSegundoPlano: (completa: boolean) => void;
  ocultarAvisoCarga: () => void;
  limpar: () => void;
}

/** Tempo que a tarja de download inicial fica visível antes de sumir sozinha. */
const MS_AVISO_CARGA_VISIVEL = 15_000;

/** Some sozinho depois de confirmar o envio, para a tarja não ficar na tela. */
const MS_ATE_SUMIR = 2600;
let temporizador: ReturnType<typeof setTimeout> | null = null;

function cancelarSumico() {
  if (temporizador) {
    clearTimeout(temporizador);
    temporizador = null;
  }
}

let temporizadorCarga: ReturnType<typeof setTimeout> | null = null;
let temporizadorAvisoCarga: ReturnType<typeof setTimeout> | null = null;

export const useSincroniaStore = create<SincroniaState>((set) => ({
  estado: 'ocioso',
  pendentes: 0,
  ignorados: 0,
  cargaInicial: 'ocioso',
  cargaFeitas: 0,
  cargaTotal: 0,
  cargaRotulo: '',
  cargaAvisoVisivel: true,

  atualizarProgressoCarga: (feitas, total, rotulo) =>
    set({ cargaFeitas: feitas, cargaTotal: total, cargaRotulo: rotulo }),

  iniciarCargaSegundoPlano: () => {
    if (temporizadorCarga) { clearTimeout(temporizadorCarga); temporizadorCarga = null; }
    if (temporizadorAvisoCarga) { clearTimeout(temporizadorAvisoCarga); temporizadorAvisoCarga = null; }
    set({ cargaInicial: 'baixando', cargaAvisoVisivel: true });
    // Só mostra nos primeiros segundos; depois some e segue baixando quieto.
    temporizadorAvisoCarga = setTimeout(() => {
      temporizadorAvisoCarga = null;
      set({ cargaAvisoVisivel: false });
    }, MS_AVISO_CARGA_VISIVEL);
  },

  finalizarCargaSegundoPlano: (completa) => {
    set({ cargaInicial: completa ? 'concluida' : 'incompleta' });
    if (temporizadorCarga) clearTimeout(temporizadorCarga);
    // O aviso final fica um pouco mais para o usuário perceber que terminou.
    temporizadorCarga = setTimeout(() => {
      temporizadorCarga = null;
      set({ cargaInicial: 'ocioso' });
    }, completa ? 4000 : 6000);
  },

  ocultarAvisoCarga: () => {
    if (temporizadorAvisoCarga) { clearTimeout(temporizadorAvisoCarga); temporizadorAvisoCarga = null; }
    set({ cargaAvisoVisivel: false });
  },

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
