import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, Animated, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent,
  Platform, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import { useCores } from '../stores/temaStore';

export function useMovimentoReduzido() {
  const [reduzido, setReduzido] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduzido).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduzido);
    return () => sub?.remove?.();
  }, []);
  return reduzido;
}

/**
 * Carrossel do protótipo (.carousel-shell + .track + .carousel-next): a seta
 * avança 80% da largura; ao chegar ao fim o botão alarga e vira "Ver todas",
 * que chama `aoVerTodas`. Voltando do fim, vira seta de novo.
 */
export function Carrossel({ children, aoVerTodas, rotulo, topoSeta = 38, deslocamentoInicial, larguraItem, itemInicial, alinharEsquerdaWeb }: {
  children: ReactNode;
  /** Rola até esta posição quando o valor chega/muda (ex.: item atual). */
  deslocamentoInicial?: number;
  /** Itens todos desta largura: o carrossel fica compacto (setas menores) e cada item para centralizado entre as setas. */
  larguraItem?: number;
  /** Com `larguraItem`: posição x (no conteúdo) do item que deve abrir centralizado. */
  itemInicial?: number;
  alinharEsquerdaWeb?: boolean;
  /** Sem isto, o botão da direita some ao chegar no fim. */
  aoVerTodas?: () => void;
  rotulo: string;
  topoSeta?: number;
}) {
  const cores = useCores();
  const { width } = useWindowDimensions();
  const webLargo = Platform.OS === 'web' && !!alinharEsquerdaWeb && width >= 900;
  const reduzido = useMovimentoReduzido();
  const scroll = useRef<ScrollView>(null);
  const medidas = useRef({ x: 0, conteudo: 0, visivel: 0 });
  const alvo = useRef(0);
  const programadaAte = useRef(0);
  const [noFim, setNoFim] = useState(false);
  const [noInicio, setNoInicio] = useState(true);
  const compacto = larguraItem != null;
  const larguraSeta = compacto ? 30 : 44;
  const [visivelLargura, setVisivelLargura] = useState(0);
  // Folga nas pontas para o primeiro e o último item pararem no centro.
  const folga = !webLargo && compacto && visivelLargura > larguraItem! ? Math.floor((visivelLargura - larguraItem!) / 2) : 2;
  const largura = useRef(new Animated.Value(larguraSeta)).current;

  const atualizarFim = useCallback(() => {
    const { x, conteudo, visivel } = medidas.current;
    const fim = conteudo > 0 && visivel > 0 && conteudo - visivel - x < 5;
    setNoFim((a) => (a === fim ? a : fim));
    const inicio = x < 5;
    setNoInicio((a) => (a === inicio ? a : inicio));
  }, []);

  const destinoInicial = webLargo ? 0 : compacto && itemInicial != null ? Math.max(0, itemInicial - folga) : deslocamentoInicial;
  useEffect(() => {
    if (destinoInicial == null || (destinoInicial <= 0 && !webLargo)) return;
    const t = setTimeout(() => {
      alvo.current = destinoInicial;
      programadaAte.current = Date.now() + 700;
      scroll.current?.scrollTo({ x: destinoInicial, animated: false });
    }, 60);
    return () => clearTimeout(t);
  }, [destinoInicial, webLargo]);

  useEffect(() => {
    Animated.timing(largura, { toValue: noFim ? (compacto ? 78 : 104) : larguraSeta, duration: reduzido ? 0 : 240, useNativeDriver: false }).start();
  }, [noFim, reduzido, largura, compacto, larguraSeta]);

  function aoRolar(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = e.nativeEvent.contentOffset.x;
    medidas.current.x = x;
    if (Date.now() > programadaAte.current && x < alvo.current - 8) alvo.current = x;
    atualizarFim();
  }

  function aoPressionar() {
    if (noFim) { aoVerTodas?.(); return; }
    const { x, visivel, conteudo } = medidas.current;
    const destino = Math.min(Math.max(0, conteudo - visivel), Math.max(x, alvo.current) + visivel * 0.8);
    alvo.current = destino;
    programadaAte.current = Date.now() + 700;
    scroll.current?.scrollTo({ x: destino, animated: !reduzido });
    if (destino >= conteudo - visivel - 4) { medidas.current.x = destino; atualizarFim(); }
  }

  function aoVoltar() {
    const { x, visivel } = medidas.current;
    const destino = Math.max(0, x - visivel * 0.8);
    alvo.current = destino;
    programadaAte.current = Date.now() + 700;
    scroll.current?.scrollTo({ x: destino, animated: !reduzido });
    if (destino < 5) { medidas.current.x = destino; atualizarFim(); }
  }

  const mostrarDireita = !noFim || !!aoVerTodas;

  const controles = (
    <>
      {!noInicio && (
        <View style={[s.setaWrap, compacto && s.setaWrapCompacta, { top: topoSeta, left: 0, width: larguraSeta }, webLargo && s.setaWeb]}>
          <TouchableOpacity
            onPress={aoVoltar}
            accessibilityRole="button"
            accessibilityLabel={`Voltar: ${rotulo}`}
            style={[s.seta, compacto && s.setaCompacta, { backgroundColor: cores.primaria, borderColor: '#ffffff', boxShadow: `0px ${compacto ? 3 : 4}px 0px ${cores.profundo}` }]}
          >
            <Text style={[s.setaTexto, compacto && s.setaTextoCompacto]}>‹</Text>
          </TouchableOpacity>
        </View>
      )}
      {mostrarDireita && (
      <Animated.View style={[s.setaWrap, compacto && s.setaWrapCompacta, { top: topoSeta, width: largura }, webLargo && s.setaWeb]}>
        <TouchableOpacity
          onPress={aoPressionar}
          accessibilityRole="button"
          accessibilityLabel={noFim ? `Ver todas: ${rotulo}` : `Avançar: ${rotulo}`}
          style={[s.seta, compacto && s.setaCompacta, { backgroundColor: cores.primaria, borderColor: '#ffffff', boxShadow: `0px ${compacto ? 3 : 4}px 0px ${cores.profundo}` }]}
        >
          <Text style={[s.setaTexto, compacto && s.setaTextoCompacto, noFim && s.setaTextoFim, noFim && compacto && s.setaTextoFimCompacto]} numberOfLines={1}>{noFim ? 'Ver todas' : '›'}</Text>
        </TouchableOpacity>
      </Animated.View>
      )}
    </>
  );

  return (
    <View>
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={webLargo}
        contentContainerStyle={[s.trilho, compacto && { paddingHorizontal: folga }]}
        scrollEventThrottle={16}
        onScroll={aoRolar}
        onLayout={(e: LayoutChangeEvent) => { medidas.current.visivel = e.nativeEvent.layout.width; setVisivelLargura(e.nativeEvent.layout.width); atualizarFim(); }}
        onContentSizeChange={(w) => { medidas.current.conteudo = w; atualizarFim(); }}
      >
        {children}
        {compacto ? null : <View style={{ width: 110 }} />}
      </ScrollView>
      {webLargo ? <View style={s.controlesWeb}>{controles}</View> : controles}
    </View>
  );
}

const s = StyleSheet.create({
  trilho: { gap: 12, paddingTop: 4, paddingHorizontal: 2, paddingBottom: 10 },
  setaWrap: { position: 'absolute', right: 0, height: 48, zIndex: 2 },
  setaWrapCompacta: { height: 34 },
  controlesWeb: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  setaWeb: { position: 'relative', top: 0, left: 0, right: 0 },
  seta: { flex: 1, borderWidth: 3, borderRadius: 16, alignItems: 'center', justifyContent: 'center', },
  setaCompacta: { borderWidth: 2, borderRadius: 12 },
  setaTexto: { color: '#ffffff', fontSize: 27, fontWeight: '900', lineHeight: 30 },
  setaTextoCompacto: { fontSize: 20, lineHeight: 22 },
  setaTextoFim: { fontSize: 13, lineHeight: 16 },
  setaTextoFimCompacto: { fontSize: 11, lineHeight: 14 },
});
