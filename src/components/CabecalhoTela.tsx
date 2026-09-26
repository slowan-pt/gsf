import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCorCabecalho } from '../stores/temaStore';
import { TAMANHO_FOTO_CABECALHO } from '../lib/tema';
import { useLinhaCabecalho } from '../lib/marcaCabecalho';

/** Topo, linha e base do cabeçalho: altura total idêntica em todas as telas (48 + 56 + 18). */
export const TOPO_CABECALHO = 48;
export const BASE_CABECALHO = 18;
/** Reserva à direita para a logo do clube (16 de margem + 56 + folga). */
export const RESERVA_LOGO_CABECALHO = 76;

interface Props {
  titulo: string;
  subtitulo?: string;
  /** Botões de ação, à direita do título e à esquerda da logo do clube. */
  acoes?: ReactNode;
}

/**
 * Barra de título padrão das telas principais: mesma altura, cor, tipografia e
 * posição da logo do clube em todas. Só título e ações ficam na barra; datas,
 * abas e filtros vão logo abaixo, no corpo da tela.
 */
export function CabecalhoTela({ titulo, subtitulo, acoes }: Props) {
  const corCabecalho = useCorCabecalho();
  const linha = useLinhaCabecalho();

  return (
    <View style={[estilos.barra, { backgroundColor: corCabecalho }]}>
      <View ref={linha.ref} onLayout={linha.onLayout} style={estilos.linha}>
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
    paddingTop: TOPO_CABECALHO,
    paddingBottom: BASE_CABECALHO,
    paddingLeft: 20,
    paddingRight: RESERVA_LOGO_CABECALHO,
  },
  linha: {
    height: TAMANHO_FOTO_CABECALHO,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textos: { flex: 1, justifyContent: 'center' },
  titulo: { color: '#fff', fontSize: 22, fontWeight: '800' },
  subtitulo: { color: 'rgba(255,255,255,0.78)', fontSize: 12, marginTop: 2 },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
