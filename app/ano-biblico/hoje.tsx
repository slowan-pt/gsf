import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { obterDiaDeHoje } from '../../src/lib/anoBiblico';

/**
 * Tela fina de redirecionamento: resolve o dia de hoje (já considerando a
 * variante bissexta de 28/29-fev) e substitui pela tela de leitura. Existe
 * separada de [id].tsx para o banner do dashboard e o atalho da home nunca
 * precisarem calcular a data por conta própria nem ficarem com um link
 * "grudado" no dia de quando o app foi aberto.
 */
export default function HojeAnoBiblicoScreen() {
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    obterDiaDeHoje()
      .then((dia) => {
        if (!dia) {
          setErro('O plano de leitura de hoje ainda não foi cadastrado.');
          return;
        }
        router.replace({ pathname: '/ano-biblico/[id]', params: { id: String(dia.id) } } as any);
      })
      .catch((e) => setErro(e?.message ?? 'Não foi possível abrir a leitura de hoje.'));
  }, []);

  return (
    <View style={s.container}>
      {erro ? <Text style={s.erro}>{erro}</Text> : <ActivityIndicator size="large" color="#1a3a5c" />}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f5f9', alignItems: 'center', justifyContent: 'center', padding: 24 },
  erro: { color: '#c0392b', textAlign: 'center' },
});
