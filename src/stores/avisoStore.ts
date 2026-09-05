import { create } from 'zustand';

export type TipoAviso = 'info' | 'erro' | 'sucesso';

interface BotaoAviso {
  texto: string;
  onPress?: () => void;
  estilo?: 'padrao' | 'cancelar';
}

interface AvisoState {
  visivel: boolean;
  titulo: string;
  mensagem: string;
  tipo: TipoAviso;
  botoes: BotaoAviso[];
  mostrar: (opcoes: { titulo?: string; mensagem: string; tipo?: TipoAviso; botoes?: BotaoAviso[] }) => void;
  fechar: () => void;
}

/**
 * Substitui window.alert()/Alert.alert() nas telas de autenticação — os
 * dois renderizam um popup cinza do navegador/sistema, sem nada a ver com a
 * identidade visual do app (azul marinho + dourado). Este modal usa o mesmo
 * padrão de card branco sobre fundo azul das telas de login/MFA/reset.
 */
export const useAvisoStore = create<AvisoState>((set) => ({
  visivel: false,
  titulo: '',
  mensagem: '',
  tipo: 'info',
  botoes: [],
  mostrar: ({ titulo, mensagem, tipo = 'info', botoes }) => {
    const rotuloPadrao = tipo === 'erro' ? 'Erro' : tipo === 'sucesso' ? 'Pronto' : 'Aviso';
    set({
      visivel: true,
      titulo: titulo ?? rotuloPadrao,
      mensagem,
      tipo,
      botoes: botoes ?? [{ texto: 'OK', estilo: 'padrao' }],
    });
  },
  fechar: () => set({ visivel: false }),
}));

/** Atalho — cobre o caso comum de "avisar e fechar", sem precisar montar o objeto todo. */
export function avisar(mensagem: string, tipo: TipoAviso = 'info', titulo?: string) {
  useAvisoStore.getState().mostrar({ mensagem, tipo, titulo });
}
