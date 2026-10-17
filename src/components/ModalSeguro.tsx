import { Modal as ModalRN, Platform, View, type ModalProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCores } from '../stores/temaStore';

/**
 * Modal que respeita as barras do Android (borda a borda): sem isso, botões do rodapé de janelas
 * e o cabeçalho de janelas de tela cheia ficavam por baixo da barra de navegação e da barra de status.
 * Nos demais sistemas é o Modal normal.
 */
export function Modal(props: ModalProps) {
  const insets = useSafeAreaInsets();
  const cores = useCores();
  if (Platform.OS !== 'android') return <ModalRN {...props} />;
  const { children, transparent } = props;
  return (
    <ModalRN {...props}>
      <View
        style={{
          flex: 1,
          paddingTop: transparent ? 0 : insets.top,
          paddingBottom: insets.bottom,
          backgroundColor: transparent ? undefined : cores.fundo,
        }}
      >
        {children}
      </View>
    </ModalRN>
  );
}
