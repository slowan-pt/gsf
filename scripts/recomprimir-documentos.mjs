// Comprime as fotos de documentos antigas do bucket privado `documentos_fotos`
// (enviadas antes da compressão automática de 20/09/2026, com 3–9 MB cada).
//
// Uso (PowerShell, na pasta do projeto):
//   npm i --no-save sharp
//   $env:SUPABASE_URL = "https://<projeto>.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY = "<chave service_role>"   # NÃO commitar nem colar em chat
//   node scripts/recomprimir-documentos.mjs            # simulação: só mostra o que faria
//   node scripts/recomprimir-documentos.mjs --aplicar  # comprime de verdade
//
// Segurança:
//  - simulação por padrão;
//  - antes de trocar um arquivo, salva o original em ./backup-documentos/<caminho>;
//  - só troca se o resultado for pelo menos 25% menor;
//  - mantém o mesmo caminho no Storage, então os links assinados já gravados no banco
//    continuam apontando para o mesmo arquivo;
//  - só imagens JPEG/PNG acima de 700 kB; PDFs não são tocados.
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const BUCKET = 'documentos_fotos';
const LIMITE_BYTES = 700 * 1024;
const MAX_LADO = 1600;
const QUALIDADE = 80;
const GANHO_MINIMO = 0.25;
const aplicar = process.argv.includes('--aplicar');

const url = process.env.SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  process.exit(1);
}
const supabase = createClient(url, chave, { auth: { persistSession: false } });

const kb = (n) => `${Math.round(n / 1024)} kB`;

async function listarArquivos(pasta = '') {
  const { data, error } = await supabase.storage.from(BUCKET).list(pasta, { limit: 1000 });
  if (error) throw error;
  const arquivos = [];
  for (const item of data ?? []) {
    const caminho = pasta ? `${pasta}/${item.name}` : item.name;
    if (item.id === null) arquivos.push(...(await listarArquivos(caminho))); // pasta
    else arquivos.push({ caminho, tamanho: Number(item.metadata?.size ?? 0), tipo: item.metadata?.mimetype ?? '' });
  }
  return arquivos;
}

const arquivos = await listarArquivos();
const candidatos = arquivos.filter((a) => a.tamanho > LIMITE_BYTES && /^image\/(jpeg|png)$/.test(a.tipo));
console.log(`${arquivos.length} arquivos no bucket; ${candidatos.length} imagens acima de ${kb(LIMITE_BYTES)}.`);
console.log(aplicar ? 'MODO: APLICAR (vai trocar os arquivos)\n' : 'MODO: SIMULAÇÃO (nada será alterado; use --aplicar)\n');

let antes = 0;
let depois = 0;
for (const arq of candidatos) {
  const { data: blob, error } = await supabase.storage.from(BUCKET).download(arq.caminho);
  if (error || !blob) { console.log(`! ${arq.caminho}: falha ao baixar (${error?.message})`); continue; }
  const original = Buffer.from(await blob.arrayBuffer());
  const novo = await sharp(original)
    .rotate() // respeita a orientação da câmera
    .resize({ width: MAX_LADO, height: MAX_LADO, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: QUALIDADE, mozjpeg: true })
    .toBuffer();

  if (novo.length > original.length * (1 - GANHO_MINIMO)) {
    console.log(`= ${arq.caminho}: ${kb(original.length)} → ${kb(novo.length)} (ganho pequeno, mantido)`);
    continue;
  }
  antes += original.length;
  depois += novo.length;
  console.log(`${aplicar ? '✔' : '~'} ${arq.caminho}: ${kb(original.length)} → ${kb(novo.length)}`);

  if (aplicar) {
    const destinoBackup = path.join('backup-documentos', ...arq.caminho.split('/'));
    await fs.mkdir(path.dirname(destinoBackup), { recursive: true });
    await fs.writeFile(destinoBackup, original);
    const { error: erroUp } = await supabase.storage.from(BUCKET).upload(arq.caminho, novo, {
      upsert: true,
      contentType: 'image/jpeg',
    });
    if (erroUp) console.log(`  ! falha ao gravar ${arq.caminho}: ${erroUp.message}`);
  }
}

console.log(`\nTotal: ${kb(antes)} → ${kb(depois)} (economia de ${kb(antes - depois)}).`);
if (!aplicar) console.log('Nada foi alterado. Rode com --aplicar para comprimir.');
