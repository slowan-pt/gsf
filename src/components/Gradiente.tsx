import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useCores } from '../stores/temaStore';
import { misturarCores } from '../lib/tema';

/** Segunda cor fixa do degradê do protótipo (115deg, primária → violeta). */
export const VIOLETA_DEGRADE = '#a048ee';

/** Cores do degradê de cabeçalho/hero para o tema atual (no escuro, mistura com o fundo). */
export function useCoresDegrade(fim = VIOLETA_DEGRADE): [string, string] {
  const cores = useCores();
  if (!cores.isEscuro) return [cores.primaria, fim];
  return [misturarCores(cores.primaria, '#151022', 0.18), misturarCores(misturarCores(cores.primaria, '#5c2d79', 0.28), '#151022', 0.1)];
}

/**
 * Preenche o pai com um degradê linear de 115° (como `linear-gradient(115deg, a, b)`).
 * Coloque como primeiro filho de um View com `overflow: 'hidden'`.
 */
export function FundoDegrade({ de, ate, raios = false }: { de: string; ate: string; raios?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={`g${id}`} x1="0" y1="0.29" x2="1" y2="0.71">
            <Stop offset="0" stopColor={de} />
            <Stop offset="1" stopColor={ate} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#g${id})`} />
      </Svg>
      {raios ? <Raios /> : null}
    </View>
  );
}

/** Raios em leque (repeating-conic-gradient do protótipo) no canto superior direito. */
function Raios() {
  const tamanho = 240;
  const r = tamanho / 2;
  const fatias = [];
  for (let i = 0; i < 24; i += 2) {
    const a0 = (i * 15 * Math.PI) / 180;
    const a1 = ((i + 1) * 15 * Math.PI) / 180;
    const x0 = r + r * Math.sin(a0), y0 = r - r * Math.cos(a0);
    const x1 = r + r * Math.sin(a1), y1 = r - r * Math.cos(a1);
    fatias.push(<Path key={i} d={`M${r},${r} L${x0},${y0} A${r},${r} 0 0,1 ${x1},${y1} Z`} fill="#ffffff" fillOpacity={0.07} />);
  }
  return (
    <View pointerEvents="none" style={{ position: 'absolute', right: -60, top: -80, width: tamanho, height: tamanho }}>
      <Svg width={tamanho} height={tamanho}><G>{fatias}</G></Svg>
    </View>
  );
}
