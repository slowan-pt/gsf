#!/usr/bin/env node
/**
 * Guarda de isolamento do modo demonstração: falha (exit 1) se qualquer
 * arquivo de app/demo/** ou src/demo/** importar Supabase, armazenamento
 * local/sessão ou notificações — a demo é 100% local e nunca pode tocar em
 * produção, mesmo por um import acidental adicionado depois.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const ALVOS = ['app/demo', 'src/demo'];

const PADROES_PROIBIDOS = [
  { nome: 'Supabase', regex: /['"](\.\.\/)*lib\/supabase['"]|@supabase\/supabase-js/ },
  { nome: 'AsyncStorage', regex: /@react-native-async-storage\/async-storage/ },
  { nome: 'expo-notifications', regex: /expo-notifications/ },
  { nome: 'authStore', regex: /stores\/authStore/ },
  { nome: 'sync.ts (fila\/sincronia com o servidor)', regex: /lib\/sync['"]/ },
  { nome: 'fetch/XMLHttpRequest direto', regex: /\bfetch\s*\(|XMLHttpRequest/ },
];

function listarArquivos(dir) {
  let resultado = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    const info = statSync(caminho);
    if (info.isDirectory()) resultado = resultado.concat(listarArquivos(caminho));
    else if (/\.(ts|tsx)$/.test(nome)) resultado.push(caminho);
  }
  return resultado;
}

let falhas = [];
let totalArquivos = 0;

for (const alvo of ALVOS) {
  const dirAbsoluto = join(ROOT, alvo);
  let arquivos;
  try {
    arquivos = listarArquivos(dirAbsoluto);
  } catch {
    console.error(`Diretório esperado não encontrado: ${alvo}`);
    process.exit(1);
  }
  for (const arquivo of arquivos) {
    totalArquivos += 1;
    const conteudo = readFileSync(arquivo, 'utf8');
    for (const padrao of PADROES_PROIBIDOS) {
      if (padrao.regex.test(conteudo)) {
        falhas.push(`${arquivo.replace(ROOT, '')} → referencia proibida: ${padrao.nome}`);
      }
    }
  }
}

if (falhas.length > 0) {
  console.error('FALHA no isolamento do modo demonstração:\n');
  falhas.forEach((f) => console.error(' - ' + f));
  process.exit(1);
}

console.log(`OK: ${totalArquivos} arquivo(s) em app/demo e src/demo sem nenhuma referência a Supabase, sessão, storage remoto ou notificações.`);
