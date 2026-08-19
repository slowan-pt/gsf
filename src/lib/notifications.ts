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

    const payload = {
      user_id: userId,
      token,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('push_tokens')
      .upsert(payload, { onConflict: 'user_id,token' });

    if (error) {
      // Ambientes antigos podem ter sido criados com a coluna "plataforma".
      // Mantemos fallback para não quebrar dev/prod durante a transição.
      const legado = {
        user_id: userId,
        token,
        plataforma: Platform.OS,
        updated_at: new Date().toISOString(),
      };
      const { error: erroLegado } = await supabase
        .from('push_tokens')
        .upsert(legado, { onConflict: 'user_id,token' });

      if (erroLegado) {
        console.warn('[push] não foi possível salvar o token:', erroLegado.message);
      }
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
      .order('updated_at', { ascending: false })
      .limit(1);
    resultado.tokenNoServidor = (data?.[0]?.token as string) ?? null;
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
    .order('updated_at', { ascending: false })
    .limit(1);
  if (error) return `Erro ao ler o token: ${error.message}`;
  const token = data?.[0]?.token as string | undefined;
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
        channelId: 'default',
        priority: 'high',
      }]),
    });
    const corpo = await resp.text();
    return resp.ok ? `Enviado. Resposta do Expo: ${corpo}` : `Expo recusou (${resp.status}): ${corpo}`;
  } catch (e: any) {
    return `Falha de rede ao enviar: ${e?.message ?? e}`;
  }
}

export interface ResultadoPush {
  tokens: number;
  enviados: number;
  erros: string[];
}

function tokenExpoValido(token: string) {
  return /^ExponentPushToken\[[^\]]+\]$|^ExpoPushToken\[[^\]]+\]$/.test(token);
}

/** Envia notificação push para todos os usuários registrados via Expo Push API. */
export async function enviarParaTodos(
  titulo: string,
  corpo: string,
  dados?: Record<string, string>
): Promise<ResultadoPush> {
  const resultado: ResultadoPush = { tokens: 0, enviados: 0, erros: [] };

  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const { data: sessao } = await supabase.auth.getSession();
      const jwt = sessao.session?.access_token;
      if (jwt) {
        const resp = await fetch('/api/push-clube', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({ titulo, corpo, dados }),
        });
        if (resp.ok) {
          return await resp.json() as ResultadoPush;
        }
        const msg = await resp.text().catch(() => '');
        resultado.erros.push(`Endpoint push ${resp.status}: ${msg}`);
      }
    }

    const { data: rows, error } = await supabase.from('push_tokens').select('token');
    if (error) {
      console.warn('[push] não foi possível ler os tokens:', error.message);
      resultado.erros.push(error.message);
      return resultado;
    }
    if (!rows || rows.length === 0) {
      console.warn('[push] nenhum aparelho registrado para receber notificação.');
      return resultado;
    }

    const tokens = Array.from(new Set(rows.map((r) => String(r.token)).filter(tokenExpoValido)));
    resultado.tokens = tokens.length;
    if (tokens.length === 0) return resultado;

    const mensagens = tokens.map((token) => ({
      to: token,
      title: titulo,
      body: corpo,
      data: dados ?? {},
      sound: 'default',
      channelId: 'default',
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
        const msg = await resp.text().catch(() => '');
        console.warn('[push] Expo recusou o envio:', resp.status, msg);
        resultado.erros.push(`Expo ${resp.status}: ${msg}`);
      } else {
        resultado.enviados += mensagens.slice(i, i + 100).length;
      }
    }
  } catch (erro: any) {
    const msg = erro?.message ?? String(erro);
    console.warn('[push] falha ao enviar notificação:', msg);
    resultado.erros.push(msg);
  }

  return resultado;
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

    tokens = Array.from(new Set(tokens.filter(tokenExpoValido)));
    if (tokens.length === 0) return;

    const mensagens = tokens.map((token) => ({
      to: token,
      title: titulo,
      body: corpo,
      data: dados,
      sound: 'default',
      channelId: 'default',
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
