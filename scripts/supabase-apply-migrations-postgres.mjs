import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Defina DATABASE_URL com a string Postgres do Supabase dev.');
  process.exit(1);
}

const { Client } = pg;
const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
const migrations = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort();

const client = new Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

try {
  for (const name of migrations) {
    const sql = readFileSync(join(migrationsDir, name), 'utf8').trim();
    if (!sql) continue;
    process.stdout.write(`Aplicando ${name}... `);
    await client.query(sql);
    console.log('ok');
  }
} finally {
  await client.end();
}

console.log('Migrations aplicadas via Postgres.');
