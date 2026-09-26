import { useCallback, useRef } from 'react';
import { useFocusEffect, useNavigation, usePathname } from 'expo-router';
import { create } from 'zustand';

/**
 * A logo do clube (LogoClube) é um overlay global, mas cada tela tem um
 * cabeçalho de altura diferente. Cada cabeçalho registra aqui o centro
 * vertical da sua linha principal (foto do membro, título...) e a logo se
 * centraliza nele. Telas que não registram ficam com a posição padrão.
 */
interface MarcaCabecalhoState {
  centros: Record<string, number>;
  definirCentro: (rota: string, centroY: number) => void;
}

export const useMarcaCabecalhoStore = create<MarcaCabecalhoState>((set) => ({
  centros: {},
  definirCentro: (rota, centroY) =>
    set((estado) =>
      Math.abs((estado.centros[rota] ?? -1) - centroY) < 0.5
        ? estado
        : { centros: { ...estado.centros, [rota]: centroY } }
    ),
}));

/**
 * Use na linha principal do cabeçalho: `<View ref={linha.ref} onLayout={linha.onLayout}>`.
 * Só a tela em foco registra (abas ficam montadas em segundo plano).
 */
export function useLinhaCabecalho() {
  const ref = useRef<any>(null);
  const pathname = usePathname();
  const rotaRef = useRef(pathname);
  rotaRef.current = pathname;
  const navigation = useNavigation();
  const definirCentro = useMarcaCabecalhoStore((s) => s.definirCentro);

  const medir = useCallback(() => {
    if (!navigation.isFocused()) return;
    ref.current?.measureInWindow((_x: number, y: number, _w: number, h: number) => {
      if (h > 0 && Number.isFinite(y)) definirCentro(rotaRef.current, y + h / 2);
    });
  }, [definirCentro, navigation]);

  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(medir, 60);
      return () => clearTimeout(t);
    }, [medir])
  );

  return { ref, onLayout: medir };
}
