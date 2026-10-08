import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useCores } from '../stores/temaStore';
import { misturarCores } from '../lib/tema';

/** Segunda cor do degradê para a marca padrão (115deg, primária → violeta do protótipo). */
export const VIOLETA_DEGRADE = '#a048ee';
const PRIMARIA_PADRAO = '#7c39e7';

function rgbParaHsl(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  if (d === 0) return [0, 0, l];
  const sat = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, sat, l];
}

function hslParaHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Segunda cor do degradê a partir da própria marca: mesmo tom, girado um pouco e mais claro. */
export function fimDoDegrade(primaria: string): string {
  if (primaria.toLowerCase() === PRIMARIA_PADRAO) return VIOLETA_DEGRADE;
  const hsl = rgbParaHsl(primaria);
  if (!hsl) return primaria;
  return hslParaHex((hsl[0] + 24) % 360, Math.min(1, hsl[1] + 0.05), Math.min(0.72, hsl[2] + 0.08));
}

/** Cores do degradê de cabeçalho/hero para o tema atual (no escuro, mistura com o fundo). */
export function useCoresDegrade(_fim?: string): [string, string] {
  const cores = useCores();
  const fim = fimDoDegrade(cores.primaria);
  if (!cores.isEscuro) return [cores.primaria, fim];
  const padrao = cores.primaria.toLowerCase() === PRIMARIA_PADRAO;
  const tom = padrao ? '#5c2d79' : fim;
  return [misturarCores(cores.primaria, '#151022', 0.18), misturarCores(misturarCores(cores.primaria, tom, padrao ? 0.28 : 0.5), '#151022', padrao ? 0.1 : 0.3)];
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
