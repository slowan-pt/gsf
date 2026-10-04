import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCores } from '../stores/temaStore';
import { Avatar } from './common/Avatar';
import { FundoDegrade, useCoresDegrade } from './Gradiente';
import { estiloCartao, textoSobre, type CoresTema } from '../lib/tema';

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

export interface ItemPodio {
  chave: string;
  nome: string;
  pontos: number;
  fotoUrl?: string | null;
  cor: string;
  /** Mostra uma bandeira no lugar da foto (pódio de unidades). */
  bandeira?: boolean;
  ehVoce?: boolean;
  aoAbrir: () => void;
}

/**
 * Pódio do protótipo (.podium-wrap): cartão em degradê com raios, rótulo
 * "Conquistas que inspiram", coroa sobre o 1º lugar e degraus 2 · 1 · 3.
 */
export function PodioCartao({ itens, brilho }: { itens: ItemPodio[]; brilho?: Animated.AnimatedInterpolation<number> }) {
  const cores = useCores();
  const [de] = useCoresDegrade();
  const [, ate] = useCoresDegrade('#a747ef');
  const ordem = [itens[1], itens[0], itens[2]];
  const degrau = (pos: number) => pos === 1
    ? { altura: 108, fundo: cores.secundaria, texto: '#70491b' }
    : pos === 2 ? { altura: 74, fundo: '#dfd3f3', texto: '#5c388b' } : { altura: 60, fundo: '#ffb070', texto: '#6a3f26' };
  return (
    <View style={[p.cartao, { boxShadow: `0px 5px 0px ${cores.profundo}` }]}>
      <FundoDegrade de={de} ate={ate} raios />
      <Text style={p.rotulo}>☆ CONQUISTAS QUE INSPIRAM ☆</Text>
      <View style={p.podio}>
        {ordem.map((it, i) => {
          if (!it) return <View key={`vazio-${i}`} style={{ flex: 1 }} />;
          const pos = i === 1 ? 1 : i === 0 ? 2 : 3;
          const d = degrau(pos);
          const tam = pos === 1 ? 70 : 55;
          return (
            <TouchableOpacity
              key={it.chave}
              style={p.vencedor}
              onPress={it.aoAbrir}
              accessibilityRole="button"
              accessibilityLabel={`${pos}º lugar: ${it.nome}, ${it.pontos} pontos${it.ehVoce ? ' (você)' : ''}`}
            >
              {pos === 1 ? <MaterialCommunityIcons name="crown-outline" size={30} color="#ffffff" style={p.coroa} /> : null}
              <View style={[p.aro, { width: tam + 6, height: tam + 6, borderRadius: (tam + 6) / 2, borderColor: pos === 1 || it.ehVoce ? cores.secundaria : '#dfcaf6' }]}>
                {it.bandeira ? (
                  <View style={[p.bandeira, { width: tam, height: tam, borderRadius: tam / 2, backgroundColor: it.cor }]}>
                    <Ionicons name="flag" size={tam * 0.42} color={textoSobre(it.cor)} />
                  </View>
                ) : (
                  <Avatar nome={it.nome} foto_url={it.fotoUrl ?? undefined} cor={it.cor} size={tam} />
                )}
                {it.ehVoce && brilho ? (
                  <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: tam, backgroundColor: cores.secundaria, opacity: brilho }]} />
                ) : null}
              </View>
              <Text style={p.nome} numberOfLines={1}>{it.nome.split(' ')[0]}</Text>
              <Text style={p.pontos}>{it.pontos.toLocaleString('pt-BR')} pts</Text>
              <View style={[p.degrau, { height: d.altura, backgroundColor: d.fundo }]}>
                <Text style={[p.numero, { color: d.texto }]}>{pos}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const p = StyleSheet.create({
  cartao: { borderRadius: 22, paddingTop: 20, paddingHorizontal: 16, marginBottom: 22, overflow: 'hidden' },
  rotulo: { color: '#fff', textAlign: 'center', fontSize: 11, fontWeight: '900', letterSpacing: 0.9 },
  podio: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, marginTop: 20 },
  vencedor: { flex: 1, minWidth: 0, alignItems: 'center' },
  coroa: { marginBottom: 4 },
  aro: { borderWidth: 3, alignItems: 'center', justifyContent: 'center', marginBottom: 8, overflow: 'hidden' },
  bandeira: { alignItems: 'center', justifyContent: 'center' },
  nome: { color: '#fff', fontSize: 13, fontWeight: '800' },
  pontos: { color: '#fff0fb', fontSize: 12, marginTop: 5, marginBottom: 12 },
  degrau: { alignSelf: 'stretch', borderTopLeftRadius: 14, borderTopRightRadius: 14, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 6, borderBottomColor: 'rgba(0,0,0,0.08)' },
  numero: { fontSize: 28, fontWeight: '900' },
});
