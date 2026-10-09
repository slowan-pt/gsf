import { useState } from 'react';
import { View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { BottomNav } from '../../src/components/BottomNav';
import { CabecalhoTela } from '../../src/components/CabecalhoTela';
import { FaixaUniforme } from '../../src/components/faixa/FaixaUniforme';
import { Segmentado } from '../../src/components/ui';
import { useAuthStore } from '../../src/stores/authStore';
import { useContextoStore } from '../../src/stores/contextoStore';
import { useCores } from '../../src/stores/temaStore';

/** Página do uniforme (faixa de especialidades e insígnias de classes). Dentro da ficha do membro o mesmo componente aparece no topo das abas. */
export default function FaixaEspecialidades() {
  const params = useLocalSearchParams<{ membro?: string; aba?: string }>();
  const usuario = useAuthStore((st) => st.usuario);
  const contextoAtivo = useContextoStore((st) => st.contextoAtivo);
  const cores = useCores();
  const membroId = Number(params.membro ?? contextoAtivo?.membro_id ?? usuario?.dbv_id ?? 0) || null;
  const [modo, setModo] = useState<'especialidades' | 'classes'>(params.aba === 'classes' ? 'classes' : 'especialidades');

  if (!usuario) return <Redirect href="/auth/login" />;

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <CabecalhoTela
        titulo={modo === 'classes' ? 'Minhas classes' : 'Minhas especialidades'}
        aoVoltar={() => (router.canGoBack() ? router.back() : router.replace('/' as any))}
      />
      <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
        <Segmentado
          opcoes={[{ valor: 'especialidades' as const, rotulo: 'Especialidades' }, { valor: 'classes' as const, rotulo: 'Classes' }]}
          valor={modo}
          onChange={(v) => setModo(v)}
        />
      </View>
      <FaixaUniforme membroId={membroId} modo={modo} />
      <BottomNav />
    </View>
  );
}
