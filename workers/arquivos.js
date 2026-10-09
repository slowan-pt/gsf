// Worker de arquivos públicos do app (fotos de membros e anexos), guardados no
// R2 para não gastar o egresso do Supabase.
//
//   GET    /<bucket>/<caminho>   público, com cache longo. Se o arquivo ainda não
//                                está no R2, busca no Storage do Supabase, guarda
//                                aqui e devolve (migração preguiçosa).
//   PUT    /<bucket>/<caminho>   envia (exige login do Supabase). ?upsert=1 sobrescreve.
//   DELETE /<bucket>/<caminho>   remove (exige login do Supabase).
//
// Os buckets privados (documentos, backup do ranking, requisitos) NÃO passam por
// aqui: continuam no Supabase, com as políticas de acesso de sempre.

// catalogo-mda (insígnias das especialidades) é só leitura aqui: o import do catálogo
// grava direto no Supabase; o Worker apenas serve e guarda em cache (migração preguiçosa).
const BUCKETS = ['fotos_membros', 'atividades', 'catalogo-mda'];
const TAMANHO_MAXIMO = 20 * 1024 * 1024;
// Bloqueia só o que executa script no navegador; anexos podem ser de vários tipos.
const TIPOS_BLOQUEADOS = /^(text\/html|application\/xhtml\+xml|image\/svg\+xml|text\/javascript|application\/javascript)$/i;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Max-Age': '86400',
};

function resposta(status, corpo, extra = {}) {
  return new Response(typeof corpo === 'string' || corpo == null ? corpo : JSON.stringify(corpo), {
    status,
    headers: { ...CORS, ...(typeof corpo === 'object' && corpo !== null ? { 'Content-Type': 'application/json' } : {}), ...extra },
  });
}

function separar(url) {
  const partes = url.pathname.split('/').filter(Boolean).map((p) => decodeURIComponent(p));
  const bucket = partes.shift();
  const caminho = partes.join('/');
  if (!BUCKETS.includes(bucket) || !caminho || caminho.includes('..') || caminho.startsWith('/')) return null;
  return { bucket, caminho, chave: `${bucket}/${caminho}` };
}

function urlSupabase(env, caminho) {
  return `${env.SUPABASE_URL}${caminho}`;
}

function cabecalhosSupabase(env, token) {
  return { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function usuarioDoToken(env, token) {
  const r = await fetch(urlSupabase(env, '/auth/v1/user'), { headers: cabecalhosSupabase(env, token) });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.id ? u : null;
}

async function rpcBooleano(env, token, funcao, corpo) {
  const r = await fetch(urlSupabase(env, `/rest/v1/rpc/${funcao}`), {
    method: 'POST',
    headers: cabecalhosSupabase(env, token),
    body: JSON.stringify(corpo),
  });
  if (!r.ok) return false;
  return (await r.json()) === true;
}

// Mesmas regras das políticas de Storage do Supabase para escrever/apagar.
async function podeEscrever(env, token, usuario, bucket, caminho) {
  if (bucket === 'atividades') return true; // qualquer usuário logado, como antes
  if (bucket === 'catalogo-mda') return false; // somente leitura pelo Worker

  // fotos_membros
  const [pasta, segundo] = caminho.split('/');
  if (pasta === 'responsaveis') return segundo === usuario.id;
  if (!/^[0-9]+$/.test(pasta ?? '')) return false;
  if (await rpcBooleano(env, token, 'current_user_pode_gerenciar_foto_arquivo', { name: caminho })) return true;

  // Regra por clube (migration 079).
  const r = await fetch(urlSupabase(env, `/rest/v1/desbravadores?id=eq.${pasta}&select=clube_id`), {
    headers: cabecalhosSupabase(env, token),
  });
  const linhas = r.ok ? await r.json() : [];
  const clubeId = Number(linhas?.[0]?.clube_id ?? 1);
  return rpcBooleano(env, token, 'current_user_can_manage_member_photo', { target_clube_id: clubeId });
}

async function servir(request, env, ctx, alvo) {
  const cache = caches.default;
  const chaveCache = new Request(new URL(request.url).origin + '/' + encodeURI(alvo.chave), { method: 'GET' });
  const emCache = await cache.match(chaveCache);
  if (emCache) return emCache;

  // Falha do R2 (leitura ou gravação) nunca derruba a imagem: serve direto do Supabase.
  let objeto = null;
  try { objeto = await env.ARQUIVOS.get(alvo.chave); } catch { objeto = null; }
  let corpo;
  let tipo;
  if (objeto) {
    corpo = objeto.body;
    tipo = objeto.httpMetadata?.contentType;
  } else {
    // Ainda não migrado: busca no Supabase, guarda no R2 e devolve.
    const origem = await fetch(urlSupabase(env, `/storage/v1/object/public/${alvo.bucket}/${encodeURI(alvo.caminho)}`));
    if (!origem.ok) return resposta(404, 'Arquivo não encontrado.');
    tipo = origem.headers.get('content-type') ?? 'application/octet-stream';
    const bytes = await origem.arrayBuffer();
    try { await env.ARQUIVOS.put(alvo.chave, bytes, { httpMetadata: { contentType: tipo } }); } catch { /* serve mesmo assim */ }
    corpo = bytes;
  }

  const res = new Response(corpo, {
    headers: {
      ...CORS,
      'Content-Type': tipo || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
  if (request.method === 'GET') ctx.waitUntil(cache.put(chaveCache, res.clone()));
  return res;
}

async function enviar(request, env, alvo, url) {
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.replace(/^bearer\s+/i, '');
  if (!token) return resposta(401, { error: 'Não autenticado.' });
  const usuario = await usuarioDoToken(env, token);
  if (!usuario) return resposta(401, { error: 'Sessão inválida.' });
  if (!(await podeEscrever(env, token, usuario, alvo.bucket, alvo.caminho))) {
    return resposta(403, { error: 'Sem permissão para enviar este arquivo.' });
  }

  const tipo = (request.headers.get('content-type') ?? 'application/octet-stream').split(';')[0].trim();
  if (TIPOS_BLOQUEADOS.test(tipo)) return resposta(415, { error: `Tipo de arquivo não permitido (${tipo}).` });
  const declarado = Number(request.headers.get('content-length') ?? 0);
  if (declarado > TAMANHO_MAXIMO) return resposta(413, { error: 'Arquivo muito grande (máx. 20 MB).' });

  if (url.searchParams.get('upsert') !== '1' && (await env.ARQUIVOS.head(alvo.chave))) {
    return resposta(409, { error: 'O arquivo já existe.' });
  }
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) return resposta(400, { error: 'Arquivo vazio.' });
  if (bytes.byteLength > TAMANHO_MAXIMO) return resposta(413, { error: 'Arquivo muito grande (máx. 20 MB).' });

  await env.ARQUIVOS.put(alvo.chave, bytes, { httpMetadata: { contentType: tipo } });
  // O cache da borda pode ter a versão antiga (upsert).
  await caches.default.delete(new Request(url.origin + '/' + encodeURI(alvo.chave), { method: 'GET' }));
  return resposta(200, { ok: true, path: alvo.caminho, bucket: alvo.bucket });
}

async function remover(request, env, alvo, url) {
  const token = (request.headers.get('authorization') ?? '').replace(/^bearer\s+/i, '');
  if (!token) return resposta(401, { error: 'Não autenticado.' });
  const usuario = await usuarioDoToken(env, token);
  if (!usuario) return resposta(401, { error: 'Sessão inválida.' });
  if (!(await podeEscrever(env, token, usuario, alvo.bucket, alvo.caminho))) {
    return resposta(403, { error: 'Sem permissão para remover este arquivo.' });
  }
  await env.ARQUIVOS.delete(alvo.chave);
  await caches.default.delete(new Request(url.origin + '/' + encodeURI(alvo.chave), { method: 'GET' }));
  return resposta(200, { ok: true });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    if (url.pathname === '/' || url.pathname === '/saude') return resposta(200, { ok: true });
    const alvo = separar(url);
    if (!alvo) return resposta(404, 'Não encontrado.');

    try {
      if (request.method === 'GET' || request.method === 'HEAD') return await servir(request, env, ctx, alvo);
      if (request.method === 'PUT' || request.method === 'POST') return await enviar(request, env, alvo, url);
      if (request.method === 'DELETE') return await remover(request, env, alvo, url);
      return resposta(405, 'Método não permitido.');
    } catch (erro) {
      return resposta(500, { error: 'Falha no servidor de arquivos.' });
    }
  },
};
