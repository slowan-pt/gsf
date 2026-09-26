import { ReactNode } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCorCabecalho } from '../stores/temaStore';
import { TAMANHO_FOTO_CABECALHO } from '../lib/tema';
import { useLinhaCabecalho } from '../lib/marcaCabecalho';

/**
 * Topo e base do cabeçalho: a linha de 56 px (foto/título/logo) fica centralizada
 * na barra e a altura total é a mesma em todas as telas (40 + 56 + 26 = 122).
 * Em celular com entalhe, o topo cresce para não invadir a barra de status e a
 * base encolhe na mesma medida.
 */
export const TOPO_CABECALHO = 40;
export const ALTURA_CABECALHO = 122;

export function useMedidasCabecalho() {
  const insets = useSafeAreaInsets();
  const topo = Platform.OS === 'web' ? TOPO_CABECALHO : Math.max(TOPO_CABECALHO, insets.top + 8);
  const base = Math.max(12, ALTURA_CABECALHO - TAMANHO_FOTO_CABECALHO - topo);
  return { topo, base };
}
/** Reserva à direita para a logo do clube (16 de margem + 56 + folga). */
export const RESERVA_LOGO_CABECALHO = 76;

interface Props {
  titulo: string;
  subtitulo?: string;
  /** Mostra a seta de voltar à esquerda do título. */
  aoVoltar?: () => void;
  /** Botões de ação, à direita do título e à esquerda da logo do clube. */
  acoes?: ReactNode;
}

/**
 * Barra de título padrão das telas principais: mesma altura, cor, tipografia e
 * posição da logo do clube em todas. Só título e ações ficam na barra; datas,
 * abas e filtros vão logo abaixo, no corpo da tela.
 */
export function CabecalhoTela({ titulo, subtitulo, aoVoltar, acoes }: Props) {
  const corCabecalho = useCorCabecalho();
  const linha = useLinhaCabecalho();
  const { topo, base } = useMedidasCabecalho();

  return (
    <View style={[estilos.barra, { backgroundColor: corCabecalho, paddingTop: topo, paddingBottom: base }]}>
      <View ref={linha.ref} onLayout={linha.onLayout} style={estilos.linha}>
        {aoVoltar ? (
          <TouchableOpacity onPress={aoVoltar} style={estilos.voltar} accessibilityLabel="Voltar">
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        ) : null}
        <View style={estilos.textos}>
          <Text style={estilos.titulo} numberOfLines={1}>{titulo}</Text>
          {subtitulo ? <Text style={estilos.subtitulo} numberOfLines={1}>{subtitulo}</Text> : null}
        </View>
        {acoes ? <View style={estilos.acoes}>{acoes}</View> : null}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: {
    paddingLeft: 20,
    paddingRight: RESERVA_LOGO_CABECALHO,
  },
  linha: {
    height: TAMANHO_FOTO_CABECALHO,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  voltar: { padding: 4, marginLeft: -4 },
  textos: { flex: 1, justifyContent: 'center' },
  titulo: { color: '#fff', fontSize: 22, fontWeight: '800' },
  subtitulo: { color: 'rgba(255,255,255,0.78)', fontSize: 12, marginTop: 2 },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
