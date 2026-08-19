interface Env {
  EXPO_PUBLIC_SUPABASE_URL?: string;
  EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
}

interface PushBody {
  titulo?: string;
  corpo?: string;
  dados?: Record<string, string>;
}

type PagesContext = {
  request: Request;
  env: Env;
};

type PagesHandler = (ctx: PagesContext) => Promise<Response> | Response;

const SUPABASE_URL_PADRAO = 'https://enoacjmlcznsrvynnamf.supabase.co';
const SUPABASE_ANON_PADRAO =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVub2Fjam1sY3puc3J2eW5uYW1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNjkzNjAsImV4cCI6MjA5Mzc0NTM2MH0.oCu9IiQGLXAX27CBeqQVbwAsro64jDqrEKUwLrBzBMc';

function tokenExpoValido(token: string) {
  return /^ExponentPushToken\[[^\]]+\]$|^ExpoPushToken\[[^\]]+\]$/.test(token);
}

function json(status: number, body: unknown) {
  return Response.json(body, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}

function respostaOptions() {
  return new Response(null, {
  status: 204,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  },
  });
}

async function enviarPush({ request, env }: PagesContext) {
  const auth = request.headers.get('authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) {
    return json(401, { ok: false, error: 'Usuário não autenticado.' });
  }

  let body: PushBody;
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, error: 'Corpo inválido.' });
  }

  const titulo = String(body.titulo ?? '').trim();
  const corpo = String(body.corpo ?? '').trim();
  if (!titulo || !corpo) {
    return json(400, { ok: false, error: 'Título e mensagem são obrigatórios.' });
  }

  const supabaseUrl = env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL ?? SUPABASE_URL_PADRAO;
  const anon = env.SUPABASE_ANON_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? SUPABASE_ANON_PADRAO;

  const tokensResp = await fetch(`${supabaseUrl}/rest/v1/push_tokens?select=token`, {
    headers: {
      apikey: anon,
      authorization: auth,
      accept: 'application/json',
    },
  });

  if (!tokensResp.ok) {
    const detalhe = await tokensResp.text().catch(() => '');
    return json(tokensResp.status, {
      ok: false,
      error: 'Não foi possível ler os aparelhos cadastrados para push.',
      detalhe,
    });
  }

  const rows = (await tokensResp.json()) as Array<{ token?: string }>;
  const tokens = Array.from(new Set(rows.map((r) => String(r.token ?? '')).filter(tokenExpoValido)));
  if (tokens.length === 0) {
    return json(200, { ok: true, tokens: 0, enviados: 0, erros: [] });
  }

  let enviados = 0;
  const erros: string[] = [];
  const mensagens = tokens.map((token) => ({
    to: token,
    title: titulo,
    body: corpo,
    data: body.dados ?? {},
    sound: 'default',
    channelId: 'default',
    priority: 'high',
  }));

  for (let i = 0; i < mensagens.length; i += 100) {
    const lote = mensagens.slice(i, i + 100);
    const resp = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(lote),
    });
    const texto = await resp.text().catch(() => '');
    if (!resp.ok) erros.push(`Expo ${resp.status}: ${texto}`);
    else enviados += lote.length;
  }

  return json(200, { ok: erros.length === 0, tokens: tokens.length, enviados, erros });
}

export const onRequest: PagesHandler = async (ctx) => {
  if (ctx.request.method === 'OPTIONS') return respostaOptions();
  if (ctx.request.method === 'POST') return enviarPush(ctx);
  return json(405, { ok: false, error: 'Método não permitido.' });
};
