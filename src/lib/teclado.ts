import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Altura livre a acrescentar no fim de um formulário rolável enquanto o teclado
 * está aberto.
 *
 * No Android a janela já encolhe sozinha (`adjustResize`), mas isso não basta:
 * se o campo em foco é um dos últimos, não sobra conteúdo abaixo dele para a
 * lista rolar, e ele fica preso atrás do teclado. Acrescentar espaço no fim dá
 * essa folga, e aí o próprio React Native traz o campo para a área visível.
 *
 * Devolve 0 com o teclado fechado, então não deixa buraco na tela.
 */
export function useEspacoParaTeclado(): number {
  const [espaco, setEspaco] = useState(0);

  useEffect(() => {
    // No iOS o evento "Will" chega antes da animação, o que evita o salto.
    const aoAbrir = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const aoFechar = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const abriu = Keyboard.addListener(aoAbrir, (evento) => {
      setEspaco(evento.endCoordinates?.height ?? 280);
    });
    const fechou = Keyboard.addListener(aoFechar, () => setEspaco(0));

    return () => {
      abriu.remove();
      fechou.remove();
    };
  }, []);

  return espaco;
}
