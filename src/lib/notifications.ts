import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Como as notificações aparecem com o app aberto
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Solicita permissão, obtém o token Expo Push e salva no Supabase. */
export async function registrarTokenPush(userId: string): Promise<void> {
  if (!Device.isDevice) return; // Não funciona em emulador

  const { status: atual } = await Notifications.getPermissionsAsync();
  let status = atual;
  if (atual !== 'granted') {
    const { status: novo } = await Notifications.requestPermissionsAsync();
    status = novo;
  }
  if (status !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Clube Fonseca',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1a3a5c',
      sound: 'default',
    });
  }

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;

    const tokenResult = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();

    const token = tokenResult.data;

    const { error } = await supabase.from('push_tokens').upsert(
      {
        user_id: userId,
        token,
        plataforma: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
    if (error) {
      console.warn('[push] não foi possível salvar o token:', error.message);
    }
  } catch (erro: any) {
    // Causa mais comum no Android: build sem as credenciais do Firebase
    // (google-services.json + chave FCM no projeto Expo). Sem isso o aparelho
    // não consegue obter um token e nunca recebe notificação.
    console.warn('[push] falha ao obter o token de notificação:', erro?.message ?? erro);
  }
}

/**
 * Diagnóstico de push: diz se ESTE aparelho conseguiu registrar um token e se
 * ele chegou ao servidor. Sem isso a falha era invisível — não dava para saber
 * se o problema era o registro, a permissão ou o envio.
 */
export async function diagnosticarPush(userId: string): Promise<{
  ehDispositivo: boolean;
  permissao: string;
  tokenLocal: string | null;
  tokenNoServidor: string | null;
  erro: string | null;
}> {
  const resultado = {
    ehDispositivo: Device.isDevice,
    permissao: 'desconhecida',
    tokenLocal: null as string | null,
    tokenNoServidor: null as string | null,
    erro: null as string | null,
  };

  try {
    const { status } = await Notifications.getPermissionsAsync();
    resultado.permissao = status;

    if (Device.isDevice && status === 'granted') {
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        (Constants as any).easConfig?.projectId;
      const tokenResult = projectId
        ? await Notifications.getExpoPushTokenAsync({ projectId })
        : await Notifications.getExpoPushTokenAsync();
      resultado.tokenLocal = tokenResult.data;
    }

    const { data } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', userId)
      .maybeSingle();
    resultado.tokenNoServidor = (data?.token as string) ?? null;
  } catch (e: any) {
    resultado.erro = e?.message ?? String(e);
  }

  return resultado;
}

/** Manda uma notificação de teste só para este usuário. */
export async function enviarPushDeTeste(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return `Erro ao ler o token: ${error.message}`;
  const token = data?.token as string | undefined;
  if (!token) return 'Nenhum token registrado para este usuário.';

  try {
    const resp = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify([{
        to: token,
        title: '🔔 Teste de notificação',
        body: 'Se você está vendo isso, o push está funcionando.',
        sound: 'default',
        priority: 'high',
      }]),
    });
    const corpo = await resp.text();
    return resp.ok ? `Enviado. Resposta do Expo: ${corpo}` : `Expo recusou (${resp.status}): ${corpo}`;
  } catch (e: any) {
    return `Falha de rede ao enviar: ${e?.message ?? e}`;
  }
}

/** Envia notificação push para todos os usuários registrados via Expo Push API. */
export async function enviarParaTodos(
  titulo: string,
  corpo: string,
  dados?: Record<string, string>
): Promise<void> {
  try {
    const { data: rows, error } = await supabase.from('push_tokens').select('token');
    if (error) {
      console.warn('[push] não foi possível ler os tokens:', error.message);
      return;
    }
    if (!rows || rows.length === 0) {
      console.warn('[push] nenhum aparelho registrado para receber notificação.');
      return;
    }

    const mensagens = rows.map((r) => ({
      to: r.token as string,
      title: titulo,
      body: corpo,
      data: dados ?? {},
      sound: 'default',
      priority: 'high',
    }));

    // Expo Push API aceita até 100 mensagens por requisição
    for (let i = 0; i < mensagens.length; i += 100) {
      const resp = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(mensagens.slice(i, i + 100)),
      });
      if (!resp.ok) {
        console.warn('[push] Expo recusou o envio:', resp.status, await resp.text().catch(() => ''));
      }
    }
  } catch (erro: any) {
    console.warn('[push] falha ao enviar notificação:', erro?.message ?? erro);
  }
}

/** Envia notificação push para alvos específicos (todos, unidade ou desbravador). */
export async function enviarParaAlvos(
  titulo: string,
  corpo: string,
  dados: Record<string, string>,
  destino: 'todos' | 'unidade' | 'desbravador',
  unidadeId?: number,
  dbvId?: number
): Promise<void> {
  try {
    let tokens: string[] = [];

    if (destino === 'todos') {
      const { data: rows } = await supabase.from('push_tokens').select('token');
      tokens = (rows ?? []).map((r) => r.token as string);
    } else if (destino === 'unidade' && unidadeId !== undefined) {
      const { data: usuarios } = await supabase
        .from('usuarios')
        .select('id')
        .eq('unidade_id', unidadeId);
      const userIds = (usuarios ?? []).map((u) => u.id);
      if (userIds.length > 0) {
        const { data: rows } = await supabase
          .from('push_tokens')
          .select('token')
          .in('user_id', userIds);
        tokens = (rows ?? []).map((r) => r.token as string);
      }
    } else if (destino === 'desbravador' && dbvId !== undefined) {
      const { data: usuarios } = await supabase
        .from('usuarios')
        .select('id')
        .eq('dbv_id', dbvId)
        .limit(1);
      const userId = usuarios?.[0]?.id;
      if (userId) {
        const { data: rows } = await supabase
          .from('push_tokens')
          .select('token')
          .eq('user_id', userId);
        tokens = (rows ?? []).map((r) => r.token as string);
      }
    }

    if (tokens.length === 0) return;

    const mensagens = tokens.map((token) => ({
      to: token,
      title: titulo,
      body: corpo,
      data: dados,
      sound: 'default',
      priority: 'high',
    }));

    for (let i = 0; i < mensagens.length; i += 100) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(mensagens.slice(i, i + 100)),
      });
    }
  } catch {
    // Falha silenciosa
  }
}
