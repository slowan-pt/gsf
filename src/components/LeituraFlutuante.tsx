import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Dimensions, PanResponder, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { obterDiaDeHoje, obterDiasLidos } from '../lib/anoBiblico';
import { useAuthStore } from '../stores/authStore';
import { useContextoStore } from '../stores/contextoStore';
import { useCores } from '../stores/temaStore';

const TAMANHO = 76;
const MARGEM = 8;
const ESPERA_ARRASTE_MS = 180;
const PARADA_VELOCIDADE = 0.055; // px/ms
const PARADA_TEMPO_MS = 6500;
const RESTITUICAO_PAREDE = 0.97;

/**
 * Botão flutuante "Ler hoje". Aparece enquanto a leitura bíblica de hoje (estado
 * real do Ano Bíblico) não foi concluída e some assim que ela é registrada.
 * Segure e arraste para mover; ao soltar com velocidade ele quica nas bordas da
 * área visível (entre cabeçalho e menu inferior) e desacelera até parar.
 *
 * Deve ser montado dentro de um contêiner que ocupa a área entre o cabeçalho e o
 * menu inferior — os limites vêm do tamanho medido desse contêiner, então valem
 * para qualquer comprimento de página, rotação ou redimensionamento.
 */
export function LeituraFlutuante() {
  const cores = useCores();
  const insets = useSafeAreaInsets();
  const usuario = useAuthStore((s) => s.usuario);
  const contextoAtivo = useContextoStore((s) => s.contextoAtivo);
  const dbvId = contextoAtivo?.membro_id ?? usuario?.dbv_id ?? null;

  const [pendente, setPendente] = useState(false);
  const [reduzirMovimento, setReduzirMovimento] = useState(false);
  const [area, setArea] = useState(() => {
    const j = Dimensions.get('window');
    return { w: j.width, h: j.height };
  });

  const pos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const atual = useRef({ x: -1, y: -1 });
  const limites = useRef({ minX: MARGEM, maxX: 0, minY: MARGEM, maxY: 0 });
  const raf = useRef<number | null>(null);
  const pulso = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduzirMovimento).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduzirMovimento);
    return () => sub?.remove?.();
  }, []);

  // Leitura de hoje ainda pendente? Reavalia sempre que a tela volta ao foco.
  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      (async () => {
        if (!dbvId) { if (ativo) setPendente(false); return; }
        try {
          const dia = await obterDiaDeHoje();
          if (!dia) { if (ativo) setPendente(false); return; }
          const lidos = await obterDiasLidos(dbvId, new Date().getFullYear());
          if (ativo) setPendente(!lidos.has(dia.id));
        } catch {
          // Sem como confirmar: não mostra um botão que pode estar desatualizado.
          if (ativo) setPendente(false);
        }
      })();
      return () => { ativo = false; };
    }, [dbvId])
  );

  // Pulso suave enquanto pendente (desligado com "reduzir movimento").
  useEffect(() => {
    if (!pendente || reduzirMovimento) { pulso.setValue(0); return; }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulso, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulso, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pendente, reduzirMovimento, pulso]);

  const pararFisica = useCallback(() => {
    if (raf.current != null) { cancelAnimationFrame(raf.current); raf.current = null; }
  }, []);

  const limitar = useCallback((x: number, y: number) => ({
    x: Math.min(Math.max(x, limites.current.minX), limites.current.maxX),
    y: Math.min(Math.max(y, limites.current.minY), limites.current.maxY),
  }), []);

  const mover = useCallback((x: number, y: number) => {
    atual.current = { x, y };
    pos.setValue({ x, y });
  }, [pos]);

  // Recalcula limites a cada mudança de área/safe area e reenquadra o botão.
  useEffect(() => {
    limites.current = {
      minX: MARGEM + insets.left,
      maxX: Math.max(MARGEM + insets.left, area.w - TAMANHO - MARGEM - insets.right),
      minY: MARGEM,
      maxY: Math.max(MARGEM, area.h - TAMANHO - MARGEM),
    };
    if (atual.current.x < 0) {
      // Posição inicial: canto inferior direito.
      mover(limites.current.maxX, limites.current.maxY);
    } else {
      const p = limitar(atual.current.x, atual.current.y);
      mover(p.x, p.y);
    }
  }, [area.w, area.h, insets.left, insets.right, limitar, mover]);

  useEffect(() => () => pararFisica(), [pararFisica]);

  const solto = useCallback((vx: number, vy: number) => {
    if (reduzirMovimento) return;
    pararFisica();
    let velX = vx;
    let velY = vy;
    if (Math.hypot(velX, velY) < PARADA_VELOCIDADE) return;
    const inicio = Date.now();
    let ultimo = inicio;
    const passo = () => {
      const agora = Date.now();
      const dt = Math.min(48, agora - ultimo);
      ultimo = agora;
      let x = atual.current.x + velX * dt;
      let y = atual.current.y + velY * dt;
      const l = limites.current;
      if (x < l.minX) { x = l.minX; velX = Math.abs(velX) * RESTITUICAO_PAREDE; }
      else if (x > l.maxX) { x = l.maxX; velX = -Math.abs(velX) * RESTITUICAO_PAREDE; }
      if (y < l.minY) { y = l.minY; velY = Math.abs(velY) * RESTITUICAO_PAREDE; }
      else if (y > l.maxY) { y = l.maxY; velY = -Math.abs(velY) * RESTITUICAO_PAREDE; }
      mover(x, y);
      // Quica rápido no começo e desacelera: o atrito cresce com o tempo.
      const decorrido = agora - inicio;
      const atrito = 0.997 - (0.997 - 0.979) * Math.min(1, decorrido / 2500);
      const fator = Math.pow(atrito, dt / 16);
      velX *= fator;
      velY *= fator;
      if (Math.hypot(velX, velY) < PARADA_VELOCIDADE || decorrido > PARADA_TEMPO_MS) { raf.current = null; return; }
      raf.current = requestAnimationFrame(passo);
    };
    raf.current = requestAnimationFrame(passo);
  }, [mover, pararFisica, reduzirMovimento]);

  const estado = useRef({ armado: false, moveu: false, timer: null as any, origem: { x: 0, y: 0 }, amostras: [] as { t: number; x: number; y: number }[] });

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        pararFisica();
        const e = estado.current;
        e.armado = false;
        e.moveu = false;
        e.origem = { ...atual.current };
        e.amostras = [];
        clearTimeout(e.timer);
        e.timer = setTimeout(() => { e.armado = true; }, ESPERA_ARRASTE_MS);
      },
      onPanResponderMove: (_ev, g) => {
        const e = estado.current;
        if (Math.hypot(g.dx, g.dy) > 6) e.moveu = true;
        if (!e.armado) return;
        const p = limitar(e.origem.x + g.dx, e.origem.y + g.dy);
        mover(p.x, p.y);
        const t = Date.now();
        e.amostras.push({ t, x: p.x, y: p.y });
        e.amostras = e.amostras.filter((a) => t - a.t < 120);
      },
      onPanResponderRelease: () => {
        const e = estado.current;
        clearTimeout(e.timer);
        if (!e.armado) {
          if (!e.moveu) router.push('/ano-biblico/hoje' as any);
          return;
        }
        const a = e.amostras;
        if (a.length >= 2) {
          const p0 = a[0];
          const p1 = a[a.length - 1];
          const dt = Math.max(1, p1.t - p0.t);
          solto((p1.x - p0.x) / dt, (p1.y - p0.y) / dt);
        }
      },
      onPanResponderTerminate: () => { clearTimeout(estado.current.timer); },
    })
  ).current;

  if (!pendente) return null;

  const escala = pulso.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const halo = pulso.interpolate({ inputRange: [0, 1], outputRange: [0.33, 0.6] });

  return (
    <View
      pointerEvents="box-none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      <Animated.View
        {...responder.panHandlers}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Ler hoje: abrir a leitura bíblica de hoje"
        style={[s.orbe, { transform: [{ translateX: pos.x }, { translateY: pos.y }, { scale: escala }] }]}
      >
        {/* .orb: aro na primária, fundo na secundária, sombra sólida lilás e halo rosa. */}
        <Animated.View pointerEvents="none" style={[s.halo, { opacity: halo }]} />
        <View style={[s.miolo, { backgroundColor: cores.secundaria, borderColor: cores.primaria }]}>
          <Ionicons name="book-outline" size={27} color="#4e245b" />
          <Text style={s.texto}>Ler hoje</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  orbe: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: TAMANHO,
    height: TAMANHO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miolo: {
    width: TAMANHO,
    height: TAMANHO,
    borderRadius: TAMANHO / 2,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 5px 0px #b587d8',
  },
  halo: { position: 'absolute', width: TAMANHO + 12, height: TAMANHO + 12, borderRadius: (TAMANHO + 12) / 2, backgroundColor: '#ff8cbd' },
  texto: { fontSize: 11, fontWeight: '900', color: '#4e245b', marginTop: 1 },
});
