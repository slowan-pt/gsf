import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Platform, StyleSheet, Text, View } from 'react-native';
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
import {
  baixarTudo, cargaEstaRodando, ETAPAS_CARGA, marcarTelaCargaExibida,
  primeiraCargaConcluida, telaCargaJaExibida, temCargaPendente,
} from '../src/lib/primeiraCarga';
import { StatusSincronia } from '../src/components/StatusSincronia';
import { KeyboardViewportGuard } from '../src/components/KeyboardViewportGuard';
import { useSincroniaStore } from '../src/stores/sincroniaStore';
import { popularBancoDeDados } from '../src/lib/seed_local';
import { registrarTokenPush } from '../src/lib/notifications';
import { registrarPWA } from '../src/lib/pwa';
import { instalarFontesAtividadesWeb } from '../src/lib/paletaAtividades';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

/** Tempo máximo segurando a tela de progresso antes de liberar o app. */
const LIMITE_ESPERA_CARGA_MS = 40_000;

const estilosCarga = StyleSheet.create({
  tela: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a3a5c',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    zIndex: 1000,
    elevation: 1000,
  },
  titulo: { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  sub: { color: '#a8c8e8', fontSize: 13, textAlign: 'center', marginTop: 8, marginBottom: 26, lineHeight: 19 },
  barraFundo: { width: '100%', height: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  barraPreenchida: { height: '100%', borderRadius: 999, backgroundColor: '#f39c12' },
  etapa: { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 16, textAlign: 'center' },
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
  // Avança sozinha por 40s, sem depender de quantas etapas realmente terminaram
  // — dá a sensação de progresso constante mesmo quando uma etapa pesada demora.
  const progressoBarra = useRef(new Animated.Value(0)).current;

  /**
   * Primeira abertura: mostra a barra de progresso sobre o app e segura por até
   * 30s. Passando disso, libera o uso e o download continua sozinho, se
   * retentando quantas vezes for preciso — o usuário nunca precisa fechar e
   * reabrir o app para completar o que faltou.
   */
  async function rodarPrimeiraCarga() {
    // Marca de imediato: essa tela cheia só pode aparecer uma vez na vida do
    // app, tenha o download terminado a tempo ou não.
    await marcarTelaCargaExibida();
    setCargaInicial({ feitas: 0, total: ETAPAS_CARGA.length, rotulo: 'Iniciando...' });
    progressoBarra.setValue(0);
    Animated.timing(progressoBarra, {
      toValue: 100,
      duration: LIMITE_ESPERA_CARGA_MS,
      useNativeDriver: false,
    }).start();

    const sincronia = useSincroniaStore.getState();

    // Libera assim que o essencial (nomes, pontuação, classes) chegar — não faz
    // sentido segurar o usuário esperando documentos e fichas.
    let liberarPorEssenciais: (() => void) | null = null;
    const essenciaisProntos = new Promise<'essenciais'>((resolve) => {
      liberarPorEssenciais = () => resolve('essenciais');
    });

    const carga = baixarTudo(
      ({ feitas, total, rotulo }) => {
        setCargaInicial({ feitas, total, rotulo });
        sincronia.atualizarProgressoCarga(feitas, total, rotulo);
      },
      () => liberarPorEssenciais?.()
    );

    let desfecho: 'completo' | 'essenciais' | 'tempo' = 'tempo';
    try {
      desfecho = await Promise.race([
        carga.then(() => 'completo' as const),
        essenciaisProntos,
        new Promise<'tempo'>((resolve) => setTimeout(() => resolve('tempo'), LIMITE_ESPERA_CARGA_MS)),
      ]);
    } finally {
      // Acontecendo o que acontecer, a tela de progresso sai. Nunca deixar o
      // usuário preso esperando por um erro inesperado.
      setCargaInicial(null);
    }
    const terminouATempo = desfecho === 'completo';

    if (terminouATempo) {
      sincronia.finalizarCargaSegundoPlano(true);
      sincronizarTudo().catch(() => {});
      return;
    }

    // Ainda baixando: avisa pela tarja e acompanha até o fim, sem travar nada.
    sincronia.iniciarCargaSegundoPlano();
    carga
      .then((completa) => useSincroniaStore.getState().finalizarCargaSegundoPlano(completa))
      .catch(() => useSincroniaStore.getState().finalizarCargaSegundoPlano(false))
      .finally(() => sincronizarTudo().catch(() => {}));
  }

  /**
   * Retoma o que faltou da carga inicial SEM mostrar a tela cheia — só a tarja
   * discreta. Usado quando a tela de progresso já apareceu antes (em outra
   * abertura do app) mas o download não tinha terminado.
   */
  function retomarCargaEmSegundoPlano() {
    if (cargaEstaRodando()) return;
    const sincronia = useSincroniaStore.getState();
    sincronia.iniciarCargaSegundoPlano();
    baixarTudo(({ feitas, total, rotulo }) =>
      useSincroniaStore.getState().atualizarProgressoCarga(feitas, total, rotulo)
    )
      .then((completa) => useSincroniaStore.getState().finalizarCargaSegundoPlano(completa))
      .catch(() => useSincroniaStore.getState().finalizarCargaSegundoPlano(false));
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
      setPronto(true);
      await SplashScreen.hideAsync();

      if (Platform.OS !== 'web') {
        const jaCarregou = await primeiraCargaConcluida();
        const jaExibiuTela = await telaCargaJaExibida();
        const temUsuario = !!useAuthStore.getState().usuario;
        if (!jaCarregou && !jaExibiuTela && temUsuario) {
          // Sem await: a barra aparece sobre o app e se resolve sozinha.
          void rodarPrimeiraCarga();
        } else {
          // Tela cheia já foi mostrada antes (ou nem precisa) — no máximo a
          // tarja discreta retoma o que faltou, nunca a tela de progresso de novo.
          if (!jaCarregou && temUsuario) retomarCargaEmSegundoPlano();
          puxarDeSupabase()
            .then(() => sincronizarTudo())
            .catch(() => {});
        }
      }
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
      if (await telaCargaJaExibida()) {
        // A tela cheia já apareceu numa abertura anterior — não mostra de novo,
        // só retoma o que faltou pela tarja discreta.
        retomarCargaEmSegundoPlano();
        return;
      }
      // Mesmo fluxo da abertura: barra por até 30s e, se precisar, continua
      // baixando em segundo plano. A barra é sobreposta, então a navegação
      // recém-criada pelo login não é desmontada.
      await rodarPrimeiraCarga();
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
      // Ficou faltando algo da carga inicial? Retoma sozinho — nunca dependemos
      // de o usuário fechar e abrir o app de novo. Mas só se não houver um
      // download já em curso, senão o aviso reinicia a cada evento de rede.
      if (temCargaPendente() && !cargaEstaRodando()) {
        const sincronia = useSincroniaStore.getState();
        sincronia.iniciarCargaSegundoPlano();
        baixarTudo(({ feitas, total, rotulo }) =>
          useSincroniaStore.getState().atualizarProgressoCarga(feitas, total, rotulo)
        )
          .then((completa) => useSincroniaStore.getState().finalizarCargaSegundoPlano(completa))
          .catch(() => useSincroniaStore.getState().finalizarCargaSegundoPlano(false));
        return;
      }
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
        <KeyboardViewportGuard />
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

        {/* SOBREPOSIÇÃO, nunca substituição: trocar a navegação por esta tela
            desmontava a pilha e jogava o usuário de volta no login ao terminar. */}
        {cargaInicial && (
          <View style={estilosCarga.tela}>
            <Text style={estilosCarga.titulo}>Aguarde, sincronizando informações</Text>
            <Text style={estilosCarga.sub}>
              Baixando os dados do clube. Isso acontece só nesta primeira vez.
            </Text>
            <View style={estilosCarga.barraFundo}>
              <Animated.View
                style={[
                  estilosCarga.barraPreenchida,
                  { width: progressoBarra.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) },
                ]}
              />
            </View>
            <Text style={estilosCarga.etapa}>{cargaInicial.rotulo}</Text>
          </View>
        )}

        {Platform.OS !== 'web' && <StatusSincronia />}
        <StatusBar style="auto" />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
