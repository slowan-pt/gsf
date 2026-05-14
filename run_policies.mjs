import pg from 'pg';
import { readFileSync } from 'fs';

const { Client } = pg;

const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error('Informe SUPABASE_DB_URL antes de executar este script.');
  console.error('Exemplo: $env:SUPABASE_DB_URL="postgresql://..." ; node run_policies.mjs');
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const sql = readFileSync('./supabase/migrations/003_storage_policies.sql', 'utf8');

async function main() {
  console.log('🔌  Conectando ao banco...');
  await client.connect();
  console.log('✅  Conectado!\n');

  // Executa cada statement separadamente
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  let ok = 0, erros = 0;
  for (const stmt of statements) {
    try {
      await client.query(stmt);
      const nome = stmt.match(/POLICY\s+"([^"]+)"/)?.[1] ?? stmt.split('\n')[0].slice(0, 50);
      console.log(`  ✅  ${nome}`);
      ok++;
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log(`  ℹ️   Já existe: ${stmt.match(/POLICY\s+"([^"]+)"/)?.[1] ?? ''}`);
      } else {
        console.log(`  ❌  ${e.message}`);
        erros++;
      }
    }
  }

  await client.end();
  console.log(`\n🏁  Concluído: ${ok} ok, ${erros} erro(s)`);
}

main().catch(e => { console.error('Erro fatal:', e.message); process.exit(1); });
