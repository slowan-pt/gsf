import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
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
import NetInfo from '@react-native-community/netinfo';
import { agendarEnvioFila, puxarDeSupabase, sincronizarTudo } from '../src/lib/sync';
import { popularBancoDeDados } from '../src/lib/seed_local';
import { registrarTokenPush } from '../src/lib/notifications';
import { registrarPWA } from '../src/lib/pwa';
import { instalarFontesAtividadesWeb } from '../src/lib/paletaAtividades';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// Logout automático após 2h sem interação (toque na tela ou app em segundo plano).
const LIMITE_INATIVIDADE_MS = 2 * 60 * 60 * 1000;
let ultimaAtividadeEm = Date.now();
function registrarAtividade() {
  ultimaAtividadeEm = Date.now();
}

export default function RootLayout() {
  const [pronto, setPronto] = useState(false);
  const carregarUsuario = useAuthStore((s) => s.carregarUsuario);
  const usuario = useAuthStore((s) => s.usuario);
  const carregarContextos = useContextoStore((s) => s.carregarContextos);
  const notifListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    registrarPWA();
    if (Platform.OS === 'web') {
      instalarFontesAtividadesWeb();
    }

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

  // Logout automático por inatividade (2h). Reseta o relógio quando o app volta
  // pro primeiro plano (contando o tempo em background) e checa periodicamente
  // enquanto estiver aberto.
  useEffect(() => {
    if (!usuario) return;
    registrarAtividade();

    const verificar = () => {
      if (Date.now() - ultimaAtividadeEm > LIMITE_INATIVIDADE_MS) {
        useAuthStore.getState().logout().finally(() => router.replace('/auth/login'));
      }
    };

    const intervalo = setInterval(verificar, 60 * 1000);
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') verificar();
    });

    return () => {
      clearInterval(intervalo);
      sub.remove();
    };
  }, [usuario?.id]);

  // Mantém app e servidor em dia: envia o que estiver pendente na fila e puxa
  // novidades sempre que o app volta pro primeiro plano ou a internet retorna.
  useEffect(() => {
    if (Platform.OS === 'web' || !usuario) return;

    const sincronizar = () => {
      agendarEnvioFila(200);
      puxarDeSupabase().catch(() => {});
    };

    const subApp = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') sincronizar();
    });
    const cancelarNet = NetInfo.addEventListener((estado) => {
      if (estado.isConnected) agendarEnvioFila(200);
    });

    return () => {
      subApp.remove();
      cancelarNet();
    };
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
      <GestureHandlerRootView style={{ flex: 1 }} onTouchStart={registrarAtividade}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="auth/login" />
          <Stack.Screen name="auth/mfa" />
          <Stack.Screen name="auth/consent" />
          <Stack.Screen name="auth/contexto" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="convite/[token]" />
          <Stack.Screen name="classe-biblica/index" />
          <Stack.Screen name="classes/index" />
          <Stack.Screen name="classes/enviar" />
          <Stack.Screen name="admin/aprovacoes" />
          <Stack.Screen name="classes/[dbvId]" />
        </Stack>
        <StatusBar style="auto" />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
