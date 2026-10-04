import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, Animated, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
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
export function Carrossel({ children, aoVerTodas, rotulo, topoSeta = 38, deslocamentoInicial }: {
  children: ReactNode;
  /** Rola até esta posição quando o valor chega/muda (ex.: item atual). */
  deslocamentoInicial?: number;
  aoVerTodas: () => void;
  rotulo: string;
  topoSeta?: number;
}) {
  const cores = useCores();
  const reduzido = useMovimentoReduzido();
  const scroll = useRef<ScrollView>(null);
  const medidas = useRef({ x: 0, conteudo: 0, visivel: 0 });
  const alvo = useRef(0);
  const programadaAte = useRef(0);
  const [noFim, setNoFim] = useState(false);
  const largura = useRef(new Animated.Value(44)).current;

  const atualizarFim = useCallback(() => {
    const { x, conteudo, visivel } = medidas.current;
    const fim = conteudo > 0 && visivel > 0 && conteudo - visivel - x < 5;
    setNoFim((a) => (a === fim ? a : fim));
  }, []);

  useEffect(() => {
    if (deslocamentoInicial == null || deslocamentoInicial <= 0) return;
    const t = setTimeout(() => {
      alvo.current = deslocamentoInicial;
      programadaAte.current = Date.now() + 700;
      scroll.current?.scrollTo({ x: deslocamentoInicial, animated: false });
    }, 60);
    return () => clearTimeout(t);
  }, [deslocamentoInicial]);

  useEffect(() => {
    Animated.timing(largura, { toValue: noFim ? 104 : 44, duration: reduzido ? 0 : 240, useNativeDriver: false }).start();
  }, [noFim, reduzido, largura]);

  function aoRolar(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = e.nativeEvent.contentOffset.x;
    medidas.current.x = x;
    if (Date.now() > programadaAte.current && x < alvo.current - 8) alvo.current = x;
    atualizarFim();
  }

  function aoPressionar() {
    if (noFim) { aoVerTodas(); return; }
    const { x, visivel, conteudo } = medidas.current;
    const destino = Math.min(Math.max(0, conteudo - visivel), Math.max(x, alvo.current) + visivel * 0.8);
    alvo.current = destino;
    programadaAte.current = Date.now() + 700;
    scroll.current?.scrollTo({ x: destino, animated: !reduzido });
    if (destino >= conteudo - visivel - 4) { medidas.current.x = destino; atualizarFim(); }
  }

  return (
    <View>
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.trilho}
        scrollEventThrottle={16}
        onScroll={aoRolar}
        onLayout={(e: LayoutChangeEvent) => { medidas.current.visivel = e.nativeEvent.layout.width; atualizarFim(); }}
        onContentSizeChange={(w) => { medidas.current.conteudo = w; atualizarFim(); }}
      >
        {children}
        <View style={{ width: 110 }} />
      </ScrollView>
      <Animated.View style={[s.setaWrap, { top: topoSeta, width: largura }]}>
        <TouchableOpacity
          onPress={aoPressionar}
          accessibilityRole="button"
          accessibilityLabel={noFim ? `Ver todas: ${rotulo}` : `Avançar: ${rotulo}`}
          style={[s.seta, { backgroundColor: cores.secundaria, borderColor: cores.primaria }]}
        >
          <Text style={[s.setaTexto, noFim && s.setaTextoFim]} numberOfLines={1}>{noFim ? 'Ver todas' : '›'}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  trilho: { gap: 12, paddingTop: 4, paddingHorizontal: 2, paddingBottom: 10 },
  setaWrap: { position: 'absolute', right: 0, height: 48, zIndex: 2 },
  seta: { flex: 1, borderWidth: 3, borderRadius: 16, alignItems: 'center', justifyContent: 'center', boxShadow: '0px 4px 0px #b18adc' },
  setaTexto: { color: '#442264', fontSize: 27, fontWeight: '900', lineHeight: 30 },
  setaTextoFim: { fontSize: 13, lineHeight: 16 },
});
