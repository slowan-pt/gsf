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
export function Carrossel({ children, aoVerTodas, rotulo, topoSeta = 38, deslocamentoInicial, porPagina, indiceInicial }: {
  /** Com `porPagina`, recebe a largura de cada item. */
  children: ReactNode | ((larguraItem: number) => ReactNode);
  /** Rola até esta posição quando o valor chega/muda (ex.: item atual). */
  deslocamentoInicial?: number;
  /** Quantos itens cabem de uma vez na largura: o carrossel divide o espaço, fica compacto (setas menores) e anda de página em página. */
  porPagina?: number;
  /** Com `porPagina`: índice do item que deve estar visível ao abrir (abre na página dele). */
  indiceInicial?: number;
  /** Sem isto, o botão da direita some ao chegar no fim. */
  aoVerTodas?: () => void;
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
  const [noInicio, setNoInicio] = useState(true);
  const compacto = porPagina != null;
  const larguraSeta = compacto ? 26 : 44;
  const [visivelLargura, setVisivelLargura] = useState(0);
  const vao = 8;
  const n = porPagina ?? 1;
  const larguraItem = Math.max(40, Math.floor(((visivelLargura || 280) - 4 - vao * (n - 1)) / n));
  const passo = (larguraItem + vao) * n;
  const largura = useRef(new Animated.Value(larguraSeta)).current;

  const atualizarFim = useCallback(() => {
    const { x, conteudo, visivel } = medidas.current;
    const fim = conteudo > 0 && visivel > 0 && conteudo - visivel - x < 5;
    setNoFim((a) => (a === fim ? a : fim));
    const inicio = x < 5;
    setNoInicio((a) => (a === inicio ? a : inicio));
  }, []);

  const destinoInicial = compacto && indiceInicial != null && visivelLargura > 0 ? Math.floor(indiceInicial / n) * passo : deslocamentoInicial;
  useEffect(() => {
    if (destinoInicial == null || destinoInicial <= 0) return;
    const t = setTimeout(() => {
      alvo.current = destinoInicial;
      programadaAte.current = Date.now() + 700;
      scroll.current?.scrollTo({ x: destinoInicial, animated: false });
    }, 60);
    return () => clearTimeout(t);
  }, [destinoInicial]);

  useEffect(() => {
    Animated.timing(largura, { toValue: noFim ? (compacto ? 70 : 104) : larguraSeta, duration: reduzido ? 0 : 240, useNativeDriver: false }).start();
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
    const destino = Math.min(Math.max(0, conteudo - visivel), Math.max(x, alvo.current) + (compacto ? passo : visivel * 0.8));
    alvo.current = destino;
    programadaAte.current = Date.now() + 700;
    scroll.current?.scrollTo({ x: destino, animated: !reduzido });
    if (destino >= conteudo - visivel - 4) { medidas.current.x = destino; atualizarFim(); }
  }

  function aoVoltar() {
    const { x, visivel } = medidas.current;
    const destino = Math.max(0, x - (compacto ? passo : visivel * 0.8));
    alvo.current = destino;
    programadaAte.current = Date.now() + 700;
    scroll.current?.scrollTo({ x: destino, animated: !reduzido });
    if (destino < 5) { medidas.current.x = destino; atualizarFim(); }
  }

  const mostrarDireita = !noFim || !!aoVerTodas;

  return (
    <View>
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[s.trilho, compacto && { gap: vao }]}
        scrollEventThrottle={16}
        onScroll={aoRolar}
        onLayout={(e: LayoutChangeEvent) => { medidas.current.visivel = e.nativeEvent.layout.width; setVisivelLargura(e.nativeEvent.layout.width); atualizarFim(); }}
        onContentSizeChange={(w) => { medidas.current.conteudo = w; atualizarFim(); }}
      >
        {typeof children === 'function' ? children(larguraItem) : children}
        <View style={{ width: compacto ? 70 : 110 }} />
      </ScrollView>
      {!noInicio && (
        <View style={[s.setaWrap, compacto && s.setaWrapCompacta, { top: topoSeta, left: 0, width: larguraSeta }]}>
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
      <Animated.View style={[s.setaWrap, compacto && s.setaWrapCompacta, { top: topoSeta, width: largura }]}>
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
    </View>
  );
}

const s = StyleSheet.create({
  trilho: { gap: 12, paddingTop: 4, paddingHorizontal: 2, paddingBottom: 10 },
  setaWrap: { position: 'absolute', right: 0, height: 48, zIndex: 2 },
  setaWrapCompacta: { height: 32 },
  seta: { flex: 1, borderWidth: 3, borderRadius: 16, alignItems: 'center', justifyContent: 'center', },
  setaCompacta: { borderWidth: 2, borderRadius: 12 },
  setaTexto: { color: '#ffffff', fontSize: 27, fontWeight: '900', lineHeight: 30 },
  setaTextoCompacto: { fontSize: 20, lineHeight: 22 },
  setaTextoFim: { fontSize: 13, lineHeight: 16 },
  setaTextoFimCompacto: { fontSize: 11, lineHeight: 14 },
});
