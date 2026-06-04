import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF;

if (!accessToken || !projectRef) {
  console.error('Defina SUPABASE_ACCESS_TOKEN e SUPABASE_PROJECT_REF.');
  process.exit(1);
}

const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
const skipMigrations = new Set(
  (process.env.SKIP_MIGRATIONS ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
);
const migrations = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .filter((name) => !skipMigrations.has(name))
  .sort();

async function runSql(name, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${name}: HTTP ${res.status} ${text}`);
  }
}

for (const name of migrations) {
  const sql = readFileSync(join(migrationsDir, name), 'utf8').trim();
  if (!sql) continue;
  process.stdout.write(`Aplicando ${name}... `);
  await runSql(name, sql);
  console.log('ok');
}

console.log(`Migrations aplicadas no projeto ${projectRef}.`);
