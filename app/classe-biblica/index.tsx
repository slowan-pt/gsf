import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BottomNav } from '../../src/components/BottomNav';
import { CabecalhoTela } from '../../src/components/CabecalhoTela';
import { useCores } from '../../src/stores/temaStore';
import { corIcone } from '../../src/lib/tema';
import { listarClasses, type ClasseBiblica } from '../../src/lib/classeBiblica';

/** Menu das classes bíblicas disponíveis (a integrada + as cadastradas pelo Admin TI). */
export default function ClasseBiblicaMenu() {
  const cores = useCores();
  const [classes, setClasses] = useState<ClasseBiblica[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async (puxou = false) => {
    if (puxou) setAtualizando(true);
    try {
      setClasses(await listarClasses());
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  return (
    <View style={[s.container, { backgroundColor: cores.fundo }]}>
      <CabecalhoTela
        titulo="Classe Bíblica"
        subtitulo="Escolha um estudo"
        aoVoltar={() => router.canGoBack() ? router.back() : router.replace('/')}
      />

      {carregando ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={corIcone(cores)} />
      ) : (
        <ScrollView
          contentContainerStyle={s.lista}
          refreshControl={<RefreshControl refreshing={atualizando} onRefresh={() => carregar(true)} />}
        >
          {classes.map((c) => (
            <TouchableOpacity
              key={c.slug}
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/classe-biblica/[slug]', params: { slug: c.slug } })}
              style={[s.card, { backgroundColor: cores.cartao, borderColor: cores.borda }]}
            >
              <View style={[s.icone, { backgroundColor: cores.input }]}>
                <Ionicons name="book" size={24} color={corIcone(cores)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.titulo, { color: cores.texto }]}>{c.titulo}</Text>
                {c.descricao ? <Text style={[s.desc, { color: cores.textoSecundario }]} numberOfLines={2}>{c.descricao}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={20} color={cores.textoSecundario} />
            </TouchableOpacity>
          ))}
          <Text style={[s.rodape, { color: cores.textoSecundario }]}>
            Suas respostas ficam salvas no aparelho e sincronizam com a sua conta.
          </Text>
        </ScrollView>
      )}

      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  lista: { padding: 16, paddingBottom: 40, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: 16, padding: 14 },
  icone: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 16, fontWeight: '800' },
  desc: { fontSize: 12, marginTop: 3 },
  rodape: { fontSize: 12, textAlign: 'center', marginTop: 12 },
});
