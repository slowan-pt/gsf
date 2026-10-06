interface Env {
  EXPO_PUBLIC_SUPABASE_URL?: string;
  EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
}

interface Mensagem {
  tokens?: string[];
  titulo?: string;
  corpo?: string;
  dados?: Record<string, string>;
}

type PagesContext = { request: Request; env: Env };
type PagesHandler = (ctx: PagesContext) => Promise<Response> | Response;

const SUPABASE_URL_PADRAO = 'https://enoacjmlcznsrvynnamf.supabase.co';
const SUPABASE_ANON_PADRAO =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVub2Fjam1sY3puc3J2eW5uYW1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNjkzNjAsImV4cCI6MjA5Mzc0NTM2MH0.oCu9IiQGLXAX27CBeqQVbwAsro64jDqrEKUwLrBzBMc';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown) {
  return Response.json(body, { status, headers: CORS });
}

function tokenExpoValido(token: string) {
  return /^ExponentPushToken\[[^\]]+\]$|^ExpoPushToken\[[^\]]+\]$/.test(token);
}

/**
 * Repassa para o Expo os avisos do fluxo de classes (os tokens já vêm filtrados
 * pelo banco, que só entrega os de quem participa do fluxo). Exige usuário logado.
 */
async function enviar({ request, env }: PagesContext) {
  const auth = request.headers.get('authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) return json(401, { ok: false, error: 'Usuário não autenticado.' });

  const supabaseUrl = env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL ?? SUPABASE_URL_PADRAO;
  const anon = env.SUPABASE_ANON_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? SUPABASE_ANON_PADRAO;
  const quem = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anon, authorization: auth } });
  if (!quem.ok) return json(401, { ok: false, error: 'Sessão inválida.' });

  let body: { mensagens?: Mensagem[] };
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, error: 'Corpo inválido.' });
  }

  const lote = (body.mensagens ?? []).flatMap((m) => {
    const titulo = String(m.titulo ?? '').trim();
    const corpo = String(m.corpo ?? '').trim();
    if (!titulo || !corpo) return [];
    return Array.from(new Set((m.tokens ?? []).map(String).filter(tokenExpoValido))).map((to) => ({
      to, title: titulo, body: corpo, data: m.dados ?? {}, sound: 'default', channelId: 'default', priority: 'high',
    }));
  });
  if (lote.length === 0) return json(200, { ok: true, enviados: 0 });

  const erros: string[] = [];
  let enviados = 0;
  for (let i = 0; i < lote.length; i += 100) {
    const parte = lote.slice(i, i + 100);
    const resp = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(parte),
    });
    if (resp.ok) enviados += parte.length;
    else erros.push(`Expo ${resp.status}`);
  }
  return json(200, { ok: erros.length === 0, enviados, erros });
}

export const onRequest: PagesHandler = async (ctx) => {
  if (ctx.request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (ctx.request.method === 'POST') return enviar(ctx);
  return json(405, { ok: false, error: 'Método não permitido.' });
};
