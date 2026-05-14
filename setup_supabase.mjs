/**
 * setup_supabase.mjs
 * Cria os buckets de storage e configura RLS automaticamente.
 *
 * Uso:
 *   node setup_supabase.mjs <SERVICE_ROLE_KEY>
 *
 * A chave está em: Supabase Dashboard → Settings → API → service_role (secret)
 */

import { createClient } from '@supabase/supabase-js';

const PROJECT_URL = 'https://enoacjmlcznsrvynnamf.supabase.co';
const SERVICE_KEY = process.argv[2];

if (!SERVICE_KEY) {
  console.error('❌  Passe a service_role key como argumento:');
  console.error('    node setup_supabase.mjs eyJhbGci...');
  process.exit(1);
}

const supabase = createClient(PROJECT_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ─── Helpers ────────────────────────────────────────────────
async function sql(query) {
  const res = await fetch(`${PROJECT_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  // Fallback: usa Management API se rpc não existir
  if (!res.ok) return execViaManagementAPI(query);
  return { ok: true };
}

async function execViaManagementAPI(query) {
  // Extrai project ref da URL
  const ref = PROJECT_URL.replace('https://', '').split('.')[0];
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

async function criarBucket(id, isPublic, fileSizeLimit, allowedMimes) {
  const { data, error } = await supabase.storage.createBucket(id, {
    public: isPublic,
    fileSizeLimit,
    allowedMimeTypes: allowedMimes,
  });
  if (error && !error.message?.includes('already exists')) throw error;
  return data;
}

// ─── Script principal ────────────────────────────────────────
async function main() {
  console.log('🚀  Iniciando configuração do Supabase Storage...\n');

  // 1. Buckets
  console.log('📦  Criando bucket fotos_membros (público)...');
  await criarBucket('fotos_membros', true, 5 * 1024 * 1024, ['image/jpeg', 'image/png', 'image/webp']);
  console.log('    ✅  fotos_membros criado');

  console.log('📦  Criando bucket documentos_fotos (privado)...');
  await criarBucket('documentos_fotos', false, 10 * 1024 * 1024, ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
  console.log('    ✅  documentos_fotos criado\n');

  // 2. Políticas de RLS via SQL direto (requer service_role ou PAT)
  console.log('🔒  Aplicando políticas de segurança (RLS)...');

  const policies = [
    // fotos_membros
    {
      name: 'leitura_publica_foto',
      sql: `CREATE POLICY IF NOT EXISTS "leitura_publica_foto"
            ON storage.objects FOR SELECT
            USING (bucket_id = 'fotos_membros');`,
    },
    {
      name: 'membro_envia_propria_foto',
      sql: `CREATE POLICY IF NOT EXISTS "membro_envia_propria_foto"
            ON storage.objects FOR INSERT TO authenticated
            WITH CHECK (
              bucket_id = 'fotos_membros' AND (
                EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND perfil IN ('admin_geral','admin_diretoria'))
                OR (storage.foldername(name))[1] = (SELECT dbv_id::text FROM public.usuarios WHERE id = auth.uid())
              )
            );`,
    },
    {
      name: 'membro_atualiza_propria_foto',
      sql: `CREATE POLICY IF NOT EXISTS "membro_atualiza_propria_foto"
            ON storage.objects FOR UPDATE TO authenticated
            USING (
              bucket_id = 'fotos_membros' AND (
                EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND perfil IN ('admin_geral','admin_diretoria'))
                OR (storage.foldername(name))[1] = (SELECT dbv_id::text FROM public.usuarios WHERE id = auth.uid())
              )
            );`,
    },
    // documentos_fotos
    {
      name: 'doc_leitura_admin_ou_dono',
      sql: `CREATE POLICY IF NOT EXISTS "doc_leitura_admin_ou_dono"
            ON storage.objects FOR SELECT TO authenticated
            USING (
              bucket_id = 'documentos_fotos' AND (
                EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND perfil IN ('admin_geral','admin_diretoria'))
                OR (storage.foldername(name))[1] = (SELECT dbv_id::text FROM public.usuarios WHERE id = auth.uid())
              )
            );`,
    },
    {
      name: 'doc_upload_admin_ou_dono',
      sql: `CREATE POLICY IF NOT EXISTS "doc_upload_admin_ou_dono"
            ON storage.objects FOR INSERT TO authenticated
            WITH CHECK (
              bucket_id = 'documentos_fotos' AND (
                EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND perfil IN ('admin_geral','admin_diretoria'))
                OR (storage.foldername(name))[1] = (SELECT dbv_id::text FROM public.usuarios WHERE id = auth.uid())
              )
            );`,
    },
    {
      name: 'doc_update_admin_ou_dono',
      sql: `CREATE POLICY IF NOT EXISTS "doc_update_admin_ou_dono"
            ON storage.objects FOR UPDATE TO authenticated
            USING (
              bucket_id = 'documentos_fotos' AND (
                EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND perfil IN ('admin_geral','admin_diretoria'))
                OR (storage.foldername(name))[1] = (SELECT dbv_id::text FROM public.usuarios WHERE id = auth.uid())
              )
            );`,
    },
    {
      name: 'doc_delete_somente_admin',
      sql: `CREATE POLICY IF NOT EXISTS "doc_delete_somente_admin"
            ON storage.objects FOR DELETE TO authenticated
            USING (
              bucket_id = 'documentos_fotos' AND
              EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND perfil IN ('admin_geral','admin_diretoria'))
            );`,
    },
  ];

  for (const p of policies) {
    try {
      const result = await execViaManagementAPI(p.sql);
      if (result.ok) {
        console.log(`    ✅  Policy: ${p.name}`);
      } else {
        console.log(`    ⚠️   Policy "${p.name}": ${JSON.stringify(result.json)}`);
      }
    } catch (e) {
      console.log(`    ⚠️   Policy "${p.name}": ${e.message}`);
    }
  }

  console.log('\n✅  Configuração concluída!');
  console.log('\n📝  Próximo passo: vincule cada usuário ao seu desbravador:');
  console.log('    Supabase Dashboard → Table Editor → usuarios → edite a coluna dbv_id\n');
}

main().catch((e) => {
  console.error('\n❌  Erro fatal:', e.message);
  process.exit(1);
});
