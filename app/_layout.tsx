import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../src/stores/authStore';
import { getDB } from '../src/lib/database';
import { puxarDeSupabase, sincronizarTudo } from '../src/lib/sync';
import { popularBancoDeDados } from '../src/lib/seed_local';
import { registrarTokenPush } from '../src/lib/notifications';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  const carregarUsuario = useAuthStore((s) => s.carregarUsuario);
  const usuario = useAuthStore((s) => s.usuario);
  const notifListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    async function init() {
      if (Platform.OS !== 'web') {
        await getDB();
        await popularBancoDeDados();
      }
      await carregarUsuario();
      if (Platform.OS !== 'web') {
        puxarDeSupabase()
          .then(() => sincronizarTudo())
          .catch(() => {});
      }
      await SplashScreen.hideAsync();
    }
    init();
  }, []);

  // Registra token quando o usuário fizer login
  useEffect(() => {
    if (!usuario?.id) return;
    registrarTokenPush(usuario.id);
  }, [usuario?.id]);

  // Listeners de notificação
  useEffect(() => {
    // Notificação recebida com app aberto (apenas mostra — handler já configurado)
    notifListener.current = Notifications.addNotificationReceivedListener(() => {});

    // Usuário tocou na notificação
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const dados = response.notification.request.content.data as Record<string, string>;
      const tela = dados?.tela;
      if (tela === 'calendario') router.push('/(tabs)/calendario');
      else if (tela === 'ranking')   router.push('/(tabs)/ranking');
      else if (tela === 'mensagens') router.push('/admin/mensagens');
      else if (tela === 'atividades') router.push('/atividades');
    });

    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="auth/login" />
          <Stack.Screen name="(tabs)" />
        </Stack>
        <StatusBar style="auto" />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
