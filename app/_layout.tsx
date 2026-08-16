import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
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
import { ETAPAS_CARGA, executarPrimeiraCarga, primeiraCargaConcluida } from '../src/lib/primeiraCarga';
import { StatusSincronia } from '../src/components/StatusSincronia';
import { useSincroniaStore } from '../src/stores/sincroniaStore';
import { popularBancoDeDados } from '../src/lib/seed_local';
import { registrarTokenPush } from '../src/lib/notifications';
import { registrarPWA } from '../src/lib/pwa';
import { instalarFontesAtividadesWeb } from '../src/lib/paletaAtividades';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

/** Tempo máximo segurando a tela de progresso antes de liberar o app. */
const LIMITE_ESPERA_CARGA_MS = 30_000;

const estilosCarga = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#1a3a5c', alignItems: 'center', justifyContent: 'center', padding: 32 },
  titulo: { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  sub: { color: '#a8c8e8', fontSize: 13, textAlign: 'center', marginTop: 8, marginBottom: 26, lineHeight: 19 },
  barraFundo: { width: '100%', height: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  barraPreenchida: { height: '100%', borderRadius: 999, backgroundColor: '#f39c12' },
  etapa: { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  contagem: { color: '#a8c8e8', fontSize: 12, marginTop: 4 },
});

// Logout automático após 2h sem interação (toque na tela ou app em segundo plano).
const LIMITE_INATIVIDADE_MS = 2 * 60 * 60 * 1000;
let ultimaAtividadeEm = Date.now();
function registrarAtividade() {
  ultimaAtividadeEm = Date.now();
}

export default function RootLayout() {
  const [pronto, setPronto] = useState(false);
  const [cargaInicial, setCargaInicial] = useState<{ feitas: number; total: number; rotulo: string } | null>(null);
  const carregarUsuario = useAuthStore((s) => s.carregarUsuario);
  const usuario = useAuthStore((s) => s.usuario);
  const carregarContextos = useContextoStore((s) => s.carregarContextos);
  const notifListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  /**
   * Segura a tela de progresso até o download terminar de verdade. Se passar de
   * 30s, libera o app e o restante segue baixando em segundo plano, avisando por
   * uma tarja — melhor do que prender o usuário numa espera indefinida.
   */
  async function rodarPrimeiraCarga() {
    setCargaInicial({ feitas: 0, total: ETAPAS_CARGA.length, rotulo: 'Iniciando...' });

    const carga = executarPrimeiraCarga((feitas, total, rotulo) =>
      setCargaInicial({ feitas, total, rotulo })
    );

    let estourouTempo = false;
    const resultado = await Promise.race([
      carga,
      new Promise<null>((resolve) =>
        setTimeout(() => { estourouTempo = true; resolve(null); }, LIMITE_ESPERA_CARGA_MS)
      ),
    ]);

    setCargaInicial(null);

    if (estourouTempo && !resultado) {
      // Continua baixando com o app já liberado.
      useSincroniaStore.getState().iniciarCargaSegundoPlano();
      carga
        .then(({ completa }) => useSincroniaStore.getState().finalizarCargaSegundoPlano(completa))
        .catch(() => useSincroniaStore.getState().finalizarCargaSegundoPlano(false));
      return;
    }

    // Terminou dentro do tempo: só avisa se ficou faltando alguma coisa.
    if (resultado && !resultado.completa) {
      useSincroniaStore.getState().finalizarCargaSegundoPlano(false);
    }
  }

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
        const db = await getDB();
        await popularBancoDeDados();
        // Sobrou coisa na fila da sessão anterior? Mostra a tarja já na abertura.
        const pendentes = await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) as total FROM fila_sync');
        if ((pendentes?.total ?? 0) > 0) useSincroniaStore.getState().marcarLocal(pendentes!.total);
      }
      await carregarUsuario();
      if (Platform.OS !== 'web') {
        // Na primeira abertura baixa tudo de uma vez, com progresso na tela.
        // Antes cada tela buscava o seu quando era aberta pela primeira vez, o
        // que dava a sensação de app lento durante todo o primeiro uso.
        const jaCarregou = await primeiraCargaConcluida();
        const temUsuario = !!useAuthStore.getState().usuario;
        if (!jaCarregou && temUsuario) {
          await SplashScreen.hideAsync();
          await rodarPrimeiraCarga();
          sincronizarTudo().catch(() => {});
        } else {
          puxarDeSupabase()
            .then(() => sincronizarTudo())
            .catch(() => {});
        }
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

  // Numa instalação nova o usuário ainda não está logado quando o app abre, então
  // a carga completa acontece aqui, logo depois do primeiro login.
  useEffect(() => {
    if (Platform.OS === 'web' || !pronto || !usuario?.id || cargaInicial) return;
    let cancelado = false;
    (async () => {
      if (await primeiraCargaConcluida()) return;
      if (cancelado) return;

      // Depois de um login novo, NUNCA bloqueamos a tela: trocar a navegação por
      // uma tela de progresso desmontava a pilha e, ao voltar, o app caía no
      // login de novo. Aqui entra direto e baixa em segundo plano, com a tarja
      // informando o que ainda falta.
      const sincronia = useSincroniaStore.getState();
      sincronia.atualizarProgressoCarga(0, ETAPAS_CARGA.length, 'Iniciando...');
      sincronia.iniciarCargaSegundoPlano();
      executarPrimeiraCarga((feitas, total, rotulo) => {
        if (!cancelado) useSincroniaStore.getState().atualizarProgressoCarga(feitas, total, rotulo);
      })
        .then(({ completa }) => useSincroniaStore.getState().finalizarCargaSegundoPlano(completa))
        .catch(() => useSincroniaStore.getState().finalizarCargaSegundoPlano(false));
    })();
    return () => { cancelado = true; };
  }, [usuario?.id, pronto]);

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

  // `!pronto` é essencial: só mostramos a tela de progresso enquanto a navegação
  // ainda não foi montada. Se ela substituísse uma pilha já montada, o app
  // perderia o histórico e voltaria para o login ao terminar.
  if (cargaInicial && !pronto) {
    const pct = cargaInicial.total > 0
      ? Math.round((cargaInicial.feitas / cargaInicial.total) * 100)
      : 0;
    return (
      <View style={estilosCarga.tela}>
        <Text style={estilosCarga.titulo}>Preparando o aplicativo</Text>
        <Text style={estilosCarga.sub}>
          Baixando os dados do clube. Isso acontece só nesta primeira vez.
        </Text>
        <View style={estilosCarga.barraFundo}>
          <View style={[estilosCarga.barraPreenchida, { width: `${pct}%` }]} />
        </View>
        <Text style={estilosCarga.etapa}>{cargaInicial.rotulo}</Text>
        <Text style={estilosCarga.contagem}>
          {cargaInicial.feitas} de {cargaInicial.total}
        </Text>
      </View>
    );
  }

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
        {Platform.OS !== 'web' && <StatusSincronia />}
        <StatusBar style="auto" />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
