#!/usr/bin/env node
/**
 * Guarda de consistência da soma de pontos.
 *
 * A mesma soma existe em três lugares, por motivos legítimos:
 *   1. src/lib/categoriasPontuacao.ts  → JS, usado no app (e offline)
 *   2. gerarExpressaoSomaSQL()          → SQL do cache local (SQLite)
 *   3. supabase/migrations/111_*.sql    → view ranking_totais, soma no servidor
 *
 * (1) e (2) já saem da mesma lista, então não podem divergir. (3) vive no
 * banco e não tem como ser gerada em tempo de execução — este script fecha o
 * ciclo: se alguém adicionar uma categoria de pontos no TypeScript e esquecer
 * a view, o build falha aqui em vez de o ranking voltar a somar menos que o
 * extrato meses depois, em silêncio.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const ARQUIVO_CATEGORIAS = join(ROOT, 'src/lib/categoriasPontuacao.ts');
const DIR_MIGRATIONS = join(ROOT, 'supabase/migrations');
const NOME_VIEW = 'ranking_totais';

const ts = readFileSync(ARQUIVO_CATEGORIAS, 'utf8');

/** Lê os `campo: 'x'` declarados nas listas de categorias do TypeScript. */
function camposDeclarados(nomeConstante) {
  const inicio = ts.indexOf(`export const ${nomeConstante}`);
  if (inicio === -1) {
    console.error(`FALHA: não encontrei ${nomeConstante} em src/lib/categoriasPontuacao.ts.`);
    process.exit(1);
  }
  const fim = ts.indexOf('];', inicio);
  const bloco = ts.slice(inicio, fim);
  return [...bloco.matchAll(/campo:\s*'([a-z_]+)'/g)].map((m) => m[1]);
}

const configuraveis = camposDeclarados('CATEGORIAS_CONFIGURAVEIS');
const diretas = camposDeclarados('CATEGORIAS_DIRETAS');

// Localiza a migration que cria a view (o número pode mudar num rebase).
const migrations = readdirSync(DIR_MIGRATIONS).filter((f) => f.endsWith('.sql'));
const arquivoView = migrations.find((f) =>
  readFileSync(join(DIR_MIGRATIONS, f), 'utf8').includes(`CREATE VIEW public.${NOME_VIEW}`)
);

if (!arquivoView) {
  console.error(`FALHA: nenhuma migration cria a view ${NOME_VIEW}.`);
  console.error('       O ranking depende dela pra somar no banco. Ela foi removida por engano?');
  process.exit(1);
}

const sql = readFileSync(join(DIR_MIGRATIONS, arquivoView), 'utf8');

const faltando = [];
for (const campo of configuraveis) {
  // Nas configuráveis o que soma é a coluna *_pts (com fallback pro config).
  if (!sql.includes(`p.${campo}_pts`)) faltando.push({ campo: `${campo}_pts`, lista: 'CATEGORIAS_CONFIGURAVEIS' });
}
for (const campo of diretas) {
  if (!sql.includes(`p.${campo}`)) faltando.push({ campo, lista: 'CATEGORIAS_DIRETAS' });
}

// Pontos extras não estão nas listas (não é categoria configurável), mas a
// soma do app inclui — a view tem que incluir também.
if (!sql.includes('p.pontos_extras')) faltando.push({ campo: 'pontos_extras', lista: 'soma base' });

if (faltando.length) {
  console.error(`FALHA: a view ${NOME_VIEW} (${arquivoView}) não soma ${faltando.length} categoria(s) que o app soma:\n`);
  for (const f of faltando) console.error(`  ${f.campo}  (declarada em ${f.lista})`);
  console.error(`
O app somaria essa categoria e o banco não, então o Ranking voltaria a mostrar
menos pontos que o Extrato — o mesmo bug de antes, em silêncio.

Corrija: acrescente a coluna na soma dentro de supabase/migrations/${arquivoView}
(e rode a migration no Supabase, já que a view existente precisa ser recriada).
`);
  process.exit(1);
}

console.log(`OK: a view ${NOME_VIEW} soma as mesmas ${configuraveis.length + diretas.length + 1} categorias que o app.`);
