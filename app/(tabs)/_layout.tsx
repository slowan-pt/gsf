import { Redirect } from 'expo-router';
import { router, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuthStore } from '../../src/stores/authStore';
import { useContextoStore } from '../../src/stores/contextoStore';
import { usePermissoes } from '../../src/lib/permissoes';
import { BottomNav } from '../../src/components/BottomNav';

export default function TabsLayout() {
  const usuario = useAuthStore((s) => s.usuario);
  const logout = useAuthStore((s) => s.logout);
  const selecaoContextoPendente = useContextoStore((s) => s.selecaoPendente);
  const { pode } = usePermissoes();
  const podePontuar = pode('gerenciar_pontuacao');
  const podeUnidades = pode('gerenciar_unidades');
  const insets = useSafeAreaInsets();

  if (!usuario) return <Redirect href="/auth/login" />;
  if (selecaoContextoPendente) return <Redirect href="/auth/contexto" />;

  async function sair() {
    await logout();
    router.replace('/auth/login');
  }

  function confirmarSair() {
    if (Platform.OS === 'web') {
      if (window.confirm('Deseja sair do sistema?')) sair();
      return;
    }
    Alert.alert('Sair', 'Deseja sair do sistema?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: sair },
    ]);
  }

  return (
    <View style={{ flex: 1 }}>
      {/*
        Usa o MESMO BottomNav das demais 25 telas do app, em vez da barra padrão
        do Expo Router. Antes existiam dois rodapés diferentes: as telas de aba
        mostravam 8 itens (incluindo Atividades/Unidades/Agenda) e o resto do app
        mostrava os 6 do BottomNav — agora é uma implementação só.
      */}
      <Tabs
        tabBar={() => <BottomNav />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Início',
            tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="ranking"
          options={{
            title: 'Ranking',
            tabBarIcon: ({ color, size }) => <Ionicons name="trophy" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="membros"
          options={{
            title: 'Membros',
            tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="pontuacao"
          options={{
            href: podePontuar ? undefined : null,
            title: 'Pontuação',
            tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-circle" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="atividades"
          options={{
            title: 'Atividades',
            tabBarIcon: ({ color, size }) => <Ionicons name="clipboard" size={size} color={color} />,
          }}
        />
        <Tabs.Screen name="anexo" options={{ href: null }} />
        <Tabs.Screen name="mensagens" options={{ href: null }} />
        <Tabs.Screen
          name="extras"
          options={{
            href: podePontuar ? undefined : null,
            title: 'Extras',
            tabBarIcon: ({ color, size }) => <Ionicons name="star" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="unidades"
          options={{
            href: podeUnidades ? undefined : null,
            title: 'Unidades',
            tabBarIcon: ({ color, size }) => <Ionicons name="flag" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="calendario"
          options={{
            title: 'Agenda',
            tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
          }}
        />
      </Tabs>

      <TouchableOpacity
        onPress={confirmarSair}
        style={[styles.logoutFloating, { top: Math.max(insets.top + 10, 18) }]}
        accessibilityLabel="Sair do sistema"
      >
        <Ionicons name="log-out-outline" size={17} color="#fff" />
        <Text style={styles.logoutFloatingText}>Sair</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  logoutFloating: {
    position: 'absolute',
    right: 12,
    zIndex: 999,
    elevation: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(26,58,92,0.88)',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  logoutFloatingText: { color: '#fff', fontWeight: '900', fontSize: 12 },
});
