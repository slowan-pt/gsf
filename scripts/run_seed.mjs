import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKEN = process.argv[2];
const PROJECT = 'enoacjmlcznsrvynnamf';

if (!TOKEN) {
  console.error('Usage: node run_seed.mjs <access_token>');
  process.exit(1);
}

const sql = readFileSync(join(__dirname, '..', 'supabase', 'migrations', '002_seed.sql'), 'utf8');

async function run(query, label) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  const body = await r.text();
  if (r.ok) {
    console.log(`✅ ${label}: OK`);
  } else {
    console.error(`❌ ${label}: ${body.substring(0, 200)}`);
    process.exit(1);
  }
}

const lines = sql.split('\n');

function getSection(fromComment, toComment) {
  let inSection = false;
  const result = [];
  for (const line of lines) {
    if (line.trim() === fromComment) { inSection = true; continue; }
    if (toComment && line.trim() === toComment) break;
    if (inSection && line.trim()) result.push(line);
  }
  return result.join('\n');
}

const dbvSQL = getSection('-- Desbravadores', '-- Documentos');
const docSQL = getSection('-- Documentos', '-- Progresso Classes');
const classSQL = getSection('-- Progresso Classes', '-- Especialidades');
const especSQL = getSection('-- Especialidades', '-- Eventos');
const eventoSQL = getSection('-- Eventos', null);

await run(dbvSQL, 'Desbravadores (57)');
await run(docSQL, 'Documentos (57)');
await run(classSQL, 'Progresso Classes (57)');
await run(especSQL, 'Especialidades (187)');
await run(eventoSQL, 'Eventos (109)');

const counts = await Promise.all([
  fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method:'POST', headers:{'Authorization':`Bearer ${TOKEN}`,'Content-Type':'application/json'},
    body: JSON.stringify({query:'SELECT (SELECT COUNT(*) FROM desbravadores) dbv, (SELECT COUNT(*) FROM documentos) doc, (SELECT COUNT(*) FROM especialidades) esp, (SELECT COUNT(*) FROM eventos) evt'})
  }).then(r=>r.json())
]);
console.log('\n📊 Contagens finais:', JSON.stringify(counts[0][0]));
