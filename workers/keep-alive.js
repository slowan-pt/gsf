/**
 * Cloudflare Worker — Keep-alive do Supabase
 * Executa via Cron Trigger a cada 3 dias para evitar pausa do projeto gratuito.
 * Deploy: npx wrangler deploy workers/keep-alive.js --config workers/wrangler-keepalive.toml
 */
export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(ping(env));
  },

  // Permite testar via GET https://<worker>.workers.dev/
  async fetch(request, env) {
    if (new URL(request.url).pathname !== '/ping') {
      return new Response('gsf-clubes keep-alive worker', { status: 200 });
    }
    const result = await ping(env);
    return Response.json(result);
  },
};

async function ping(env) {
  // GET simples na tabela de clubes (sempre existe, RLS retorna [] sem credenciais de clube)
  const url = `${env.SUPABASE_URL}/rest/v1/clubes?select=id&limit=1`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
    },
  });

  const ts = new Date().toISOString();
  if (res.ok) {
    console.log(`[${ts}] Supabase keep-alive OK (${res.status})`);
    return { ok: true, status: res.status, ts };
  }

  const body = await res.text().catch(() => '');
  console.error(`[${ts}] Supabase keep-alive FALHOU (${res.status}): ${body}`);
  return { ok: false, status: res.status, body, ts };
}
