import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { estiloCartao, type CoresTema } from '../lib/tema';

/** Valor animado 0→1→0 em laço; fica parado (0) quando o sistema pede menos movimento. */
export function usePulso(ativo = true, duracao = 1200) {
  const valor = useRef(new Animated.Value(0)).current;
  const [reduzido, setReduzido] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduzido).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduzido);
    return () => sub?.remove?.();
  }, []);
  useEffect(() => {
    if (!ativo || reduzido) { valor.setValue(0); return; }
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(valor, { toValue: 1, duration: duracao, useNativeDriver: true }),
      Animated.timing(valor, { toValue: 0, duration: duracao, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, [ativo, reduzido, duracao, valor]);
  return { valor, reduzido };
}

/**
 * Cena de acampamento (barracas, árvores, fogueira com chama pulsando) usada nos
 * estados em que não há lista para mostrar: sem dados, falha na consulta, etc.
 */
export function CenaAcampamento({ titulo, texto, cores, aoTentarNovamente, erro }: {
  titulo: string;
  texto: string;
  cores: CoresTema;
  aoTentarNovamente?: () => void;
  erro?: boolean;
}) {
  const { valor } = usePulso(!erro, 700);
  const chama = valor.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  return (
    <View style={[s.cena, estiloCartao(cores)]} accessible accessibilityLabel={`${titulo}. ${texto}`}>
      <View style={s.palco}>
        <Text style={s.emoji}>🌲</Text>
        <Text style={s.emoji}>⛺</Text>
        <Animated.Text style={[s.emoji, { transform: [{ scale: chama }] }]}>{erro ? '🪵' : '🔥'}</Animated.Text>
        <Text style={s.emoji}>⛺</Text>
        <Text style={s.emoji}>🌲</Text>
      </View>
      <Text style={[s.titulo, { color: cores.texto }]}>{titulo}</Text>
      <Text style={[s.texto, { color: cores.textoSecundario }]}>{texto}</Text>
      {aoTentarNovamente ? (
        <TouchableOpacity onPress={aoTentarNovamente} accessibilityRole="button" style={[s.botao, { backgroundColor: cores.acento }]}>
          <Text style={[s.botaoTexto, { color: cores.isEscuro ? '#1a1033' : '#fff' }]}>Tentar novamente</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  cena: { alignItems: 'center', padding: 24, marginTop: 24, gap: 8 },
  palco: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 6 },
  emoji: { fontSize: 34 },
  titulo: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  texto: { fontSize: 13, textAlign: 'center' },
  botao: { marginTop: 8, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, minHeight: 44, justifyContent: 'center' },
  botaoTexto: { fontSize: 13, fontWeight: '800' },
});
