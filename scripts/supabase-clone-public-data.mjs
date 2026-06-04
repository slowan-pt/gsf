import { createClient } from '@supabase/supabase-js';

const prodUrl = process.env.PROD_SUPABASE_URL;
const prodServiceKey = process.env.PROD_SUPABASE_SERVICE_ROLE_KEY;
const devUrl = process.env.DEV_SUPABASE_URL;
const devServiceKey = process.env.DEV_SUPABASE_SERVICE_ROLE_KEY;
const devAdminEmail = process.env.DEV_ADMIN_EMAIL;
const devAdminPassword = process.env.DEV_ADMIN_PASSWORD;

if (!prodUrl || !prodServiceKey || !devUrl || !devServiceKey) {
  console.error('Defina PROD_SUPABASE_URL, PROD_SUPABASE_SERVICE_ROLE_KEY, DEV_SUPABASE_URL e DEV_SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const prod = createClient(prodUrl, prodServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const dev = createClient(devUrl, devServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TABLES = [
  'programas',
  'clubes',
  'perfis_acesso',
  'unidades',
  'desbravadores',
  'documentos',
  'progresso_classes',
  'especialidades',
  'eventos',
  'pontuacoes',
  'config_pontuacao',
  'config_pontuacao_itens',
  'pontuacao_itens',
  'pontuacoes_custom',
  'config_campori',
  'parcelas_campori_config',
  'pagamentos_campori',
  'documento_tipos',
  'documentos_modelo',
  'documento_status',
  'documento_imagens',
  'documentos_pais_config',
  'classes_modelo',
  'cargos_modelo',
  'especialidades_modelo',
  'mda_requisitos_modelo',
  'classe_biblica_respostas',
  'lgpd_termos',
  'lgpd_aceites',
  'pre_cadastro_links',
  'pre_cadastros',
  'pre_cadastro_responsaveis',
  'responsavel_membros',
  'usuarios',
  'usuario_clubes',
  'mensagens_clube',
  'mensagens_clube_lidos',
  'mensagens_clube_ocultos',
  'atividades',
  'planos_formativos',
  'atividades_alvos',
  'atividades_anexos',
  'atividades_respostas',
  'atividades_mensagens',
  'investidura_itens',
  'ranking_clubes_niveis',
  'ranking_clubes_requisitos',
  'ranking_clubes_pontuacoes',
  'whatsapp_config',
  'whatsapp_fila',
  'configuracoes_visuais_clube',
  'arquivos_registro',
  'auditoria_eventos',
  'clubes_onboarding_status',
  'importacoes_lote',
  'importacoes_lote_itens',
  'relatorios_modelo',
  'membros',
  'push_tokens',
];

const AUTH_DEPENDENT_TABLES = new Set([
  'usuarios',
  'usuario_clubes',
  'responsavel_membros',
  'lgpd_aceites',
  'mensagens_clube_lidos',
  'mensagens_clube_ocultos',
  'push_tokens',
]);

async function fetchAll(table) {
  const rows = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await prod.from(table).select('*').range(from, from + size - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return rows;
}

async function insertChunks(table, rows) {
  const size = 500;
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const { error } = await dev.from(table).insert(chunk);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function cloneTable(table) {
  if (AUTH_DEPENDENT_TABLES.has(table)) {
    console.log(`Pulando ${table} (depende de auth.users; recriado para dev quando necessario).`);
    return;
  }

  process.stdout.write(`Copiando ${table}... `);
  const rows = await fetchAll(table);
  if (rows.length > 0) await insertChunks(table, rows);
  console.log(`${rows.length} linha(s)`);
}

async function ensureDevAdmin() {
  if (!devAdminEmail || !devAdminPassword) {
    console.log('DEV_ADMIN_EMAIL/DEV_ADMIN_PASSWORD nao definidos; usuario admin de dev nao criado.');
    return;
  }

  const email = devAdminEmail.toLowerCase().trim();
  const { data: created, error } = await dev.auth.admin.createUser({
    email,
    password: devAdminPassword,
    email_confirm: true,
    user_metadata: { nome: 'Admin Dev', perfil: 'admin_ti' },
  });

  if (error && !String(error.message).toLowerCase().includes('already')) {
    throw new Error(`Auth admin dev: ${error.message}`);
  }

  let user = created?.user ?? null;
  if (!user) {
    const { data: users, error: listError } = await dev.auth.admin.listUsers();
    if (listError) throw new Error(`Listar usuarios dev: ${listError.message}`);
    user = users.users.find((u) => u.email?.toLowerCase() === email) ?? null;
  }
  if (!user) throw new Error('Nao foi possivel localizar/criar o admin de dev.');

  const { error: usuarioError } = await dev.from('usuarios').upsert({
    id: user.id,
    email,
    nome: 'Admin Dev',
    perfil: 'admin_ti',
  });
  if (usuarioError) throw new Error(`usuarios admin dev: ${usuarioError.message}`);

  const { data: vinculoExistente, error: buscaVinculoError } = await dev
    .from('usuario_clubes')
    .select('id')
    .eq('usuario_id', user.id)
    .eq('clube_id', 1)
    .eq('perfil', 'admin_ti')
    .maybeSingle();

  if (buscaVinculoError) throw new Error(`buscar usuario_clubes admin dev: ${buscaVinculoError.message}`);

  if (!vinculoExistente) {
    const { error: insertError } = await dev.from('usuario_clubes').insert({
      usuario_id: user.id,
      clube_id: 1,
      perfil: 'admin_ti',
      ativo: true,
    });
    if (insertError) throw new Error(`usuario_clubes admin dev: ${insertError.message}`);
  }

  console.log(`Admin dev pronto: ${email}`);
}

for (const table of TABLES) {
  try {
    await cloneTable(table);
  } catch (err) {
    console.warn(`Aviso: ${err.message}`);
  }
}

await ensureDevAdmin();

console.log('Clone de dados publicos concluido.');
