/**
 * Cloudflare Worker — Keep-alive do Supabase
 * Executa via Cron Trigger a cada 3 dias para evitar pausa do projeto gratuito.
 * Deploy: npx wrangler deploy workers/keep-alive.js --config workers/wrangler-keepalive.toml
 */
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(event.cron === '0 3 * * *'
      ? executarRotinaDiaria(env)
      : executarPushAnoBiblico(env));
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

async function executarRotinaDiaria(env) {
  const keepAlive = await ping(env);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY nao configurada; automacoes ignoradas.');
    return { ...keepAlive, automacoes: false, motivo: 'service-role-ausente' };
  }

  const headers = cabecalhosServiceRole(env);
  const rpc = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/processar_automacoes_diarias`, {
    method: 'POST', headers, body: JSON.stringify({}),
  });
  if (!rpc.ok) throw new Error(`Automacao diaria falhou: ${rpc.status} ${await rpc.text()}`);
  const resultado = await rpc.json();
  const anoBiblico = await processarPushAnoBiblico(env, headers);
  const pushes = await enviarPushPendentes(env, headers);
  console.log('Automacao diaria concluida', JSON.stringify({ resultado, pushes }));
  return { ...keepAlive, automacoes: true, resultado, anoBiblico, pushes };
}

async function executarPushAnoBiblico(env) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY nao configurada; push do Ano Biblico ignorado.');
    return { anoBiblico: false, motivo: 'service-role-ausente' };
  }
  const headers = cabecalhosServiceRole(env);
  const anoBiblico = await processarPushAnoBiblico(env, headers);
  const pushes = await enviarPushPendentes(env, headers);
  return { anoBiblico, pushes };
}

async function processarPushAnoBiblico(env, headers) {
  const rpc = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/processar_push_ano_biblico`, {
    method: 'POST', headers, body: JSON.stringify({}),
  });
  if (!rpc.ok) {
    const body = await rpc.text();
    if (rpc.status === 404 || body.includes('PGRST202') || body.includes('Could not find the function')) {
      console.warn('RPC processar_push_ano_biblico ainda nao existe; migration pendente.');
      return { ativo: false, motivo: 'migration-pendente' };
    }
    throw new Error(`Push do Ano Biblico falhou: ${rpc.status} ${body}`);
  }
  const resultado = await rpc.json();
  console.log('Push do Ano Biblico processado', JSON.stringify(resultado));
  return { ativo: true, resultado };
}

function cabecalhosServiceRole(env) {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function enviarPushPendentes(env, headers) {
  const alertasRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/alertas_usuarios?select=id,usuario_id,titulo,corpo,rota&push_enviado_em=is.null&order=created_at.asc&limit=500`,
    { headers },
  );
  if (!alertasRes.ok) throw new Error(`Busca de alertas falhou: ${alertasRes.status} ${await alertasRes.text()}`);
  const alertas = await alertasRes.json();
  if (!alertas.length) return { alertas: 0, enviados: 0 };

  const usuarios = [...new Set(alertas.map((a) => a.usuario_id))];
  const filtro = encodeURIComponent(`(${usuarios.join(',')})`);
  const tokensRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/push_tokens?select=user_id,token&user_id=in.${filtro}`,
    { headers },
  );
  if (!tokensRes.ok) throw new Error(`Busca de tokens falhou: ${tokensRes.status} ${await tokensRes.text()}`);
  const tokens = await tokensRes.json();
  const porUsuario = new Map();
  for (const item of tokens) {
    if (!porUsuario.has(item.user_id)) porUsuario.set(item.user_id, []);
    porUsuario.get(item.user_id).push(item.token);
  }

  const mensagens = [];
  const idsComToken = new Set();
  for (const alerta of alertas) {
    for (const token of porUsuario.get(alerta.usuario_id) ?? []) {
      mensagens.push({
        to: token,
        sound: 'default',
        title: alerta.titulo,
        body: alerta.corpo,
        data: { tela: 'rota', rota: alerta.rota ?? '/mensagens' },
      });
      idsComToken.add(alerta.id);
    }
  }

  let enviados = 0;
  for (let i = 0; i < mensagens.length; i += 100) {
    const lote = mensagens.slice(i, i + 100);
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(lote),
    });
    if (!res.ok) throw new Error(`Expo Push falhou: ${res.status} ${await res.text()}`);
    enviados += lote.length;
  }

  // Sem token, o alerta continua disponivel dentro do app; com token, evita reenvio.
  if (idsComToken.size) {
    const ids = [...idsComToken].join(',');
    const marcar = await fetch(`${env.SUPABASE_URL}/rest/v1/alertas_usuarios?id=in.(${encodeURIComponent(ids)})`, {
      method: 'PATCH', headers, body: JSON.stringify({ push_enviado_em: new Date().toISOString() }),
    });
    if (!marcar.ok) throw new Error(`Marcacao de push falhou: ${marcar.status} ${await marcar.text()}`);
  }
  return { alertas: alertas.length, enviados };
}

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
