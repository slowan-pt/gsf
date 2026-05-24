import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../src/stores/authStore';
import { useContextoStore } from '../src/stores/contextoStore';
import { getDB } from '../src/lib/database';
import { puxarDeSupabase, sincronizarTudo } from '../src/lib/sync';
import { popularBancoDeDados } from '../src/lib/seed_local';
import { registrarTokenPush } from '../src/lib/notifications';
import { registrarPWA } from '../src/lib/pwa';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  const [pronto, setPronto] = useState(false);
  const carregarUsuario = useAuthStore((s) => s.carregarUsuario);
  const usuario = useAuthStore((s) => s.usuario);
  const carregarContextos = useContextoStore((s) => s.carregarContextos);
  const notifListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    registrarPWA();

    async function init() {
      if (Platform.OS !== 'web') {
        await Font.loadAsync(Ionicons.font);
      }
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
      setPronto(true);
      await SplashScreen.hideAsync();
    }
    init().catch(async (error) => {
      console.warn('Falha ao inicializar app:', error);
      setPronto(true);
      await SplashScreen.hideAsync();
    });
  }, []);

  // Registra token quando o usuário fizer login
  useEffect(() => {
    if (!usuario?.id) return;
    registrarTokenPush(usuario.id);
    carregarContextos(usuario).catch(() => {});
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
      else if (tela === 'mensagens') router.push('/mensagens');
      else if (tela === 'atividades') router.push('/(tabs)/atividades');
    });

    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  if (!pronto) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="auth/login" />
          <Stack.Screen name="auth/mfa" />
          <Stack.Screen name="auth/consent" />
          <Stack.Screen name="auth/contexto" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="convite/[token]" />
        </Stack>
        <StatusBar style="auto" />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
