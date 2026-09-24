import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

interface Props {
  texto?: string;
  corTexto?: string;
}

// Animação infinita de "carregando": uma Bíblia flutuando sobre a fogueira
// do acampamento, com a barraca e o pinheiro ao lado. Só usa Animated do
// React Native, então não depende de nenhuma biblioteca extra.
export function CarregandoAcampamento({ texto = 'Carregando ranking...', corTexto = '#667' }: Props) {
  const flutuar = useRef(new Animated.Value(0)).current;
  const chama = useRef(new Animated.Value(0)).current;
  const brilho = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const laco = (v: Animated.Value, duracao: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: duracao, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: duracao, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      );
    const animacoes = [laco(flutuar, 900), laco(chama, 320), laco(brilho, 600)];
    animacoes.forEach((a) => a.start());
    return () => animacoes.forEach((a) => a.stop());
  }, [flutuar, chama, brilho]);

  const biblia = {
    transform: [
      { translateY: flutuar.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) },
      { rotate: flutuar.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] }) },
    ],
  };
  const fogo = {
    opacity: chama.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }),
    transform: [
      { scale: chama.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] }) },
      { rotate: chama.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] }) },
    ],
  };
  const opacidadeBrilho = brilho.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });

  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel={texto}>
      <View style={styles.cena}>
        <Text style={styles.barraca}>⛺</Text>
        <View style={styles.centro}>
          <Animated.Text style={[styles.biblia, biblia]}>📖</Animated.Text>
          <Animated.Text style={[styles.fogo, fogo]}>🔥</Animated.Text>
        </View>
        <Text style={styles.arvore}>🌲</Text>
      </View>
      <View style={styles.linhaTexto}>
        <Text style={[styles.texto, { color: corTexto }]}>{texto}</Text>
        <Animated.Text style={[styles.texto, { color: corTexto, opacity: opacidadeBrilho }]}>✨</Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  cena: { flexDirection: 'row', alignItems: 'flex-end', gap: 14 },
  centro: { alignItems: 'center', width: 64 },
  biblia: { fontSize: 34, marginBottom: 2 },
  fogo: { fontSize: 44 },
  barraca: { fontSize: 40 },
  arvore: { fontSize: 40 },
  linhaTexto: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  texto: { fontSize: 14, fontWeight: '700' },
});
