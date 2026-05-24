import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { createClient } from '@supabase/supabase-js';

const baseDir = process.argv[2] ?? 'C:/Users/adm.sloannascimento/Downloads/mda';
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://enoacjmlcznsrvynnamf.supabase.co';
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRole) {
  console.error('Defina SUPABASE_SERVICE_ROLE_KEY antes de rodar.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BUCKET = 'catalogo-mda';

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ';' && !quoted) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

async function readCsv(file) {
  const rows = [];
  const rl = createInterface({
    input: createReadStream(file, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  let headers = null;
  for await (const rawLine of rl) {
    const line = rawLine.replace(/^\uFEFF/, '');
    if (!headers) {
      headers = splitCsvLine(line);
      continue;
    }
    if (!line.trim()) continue;
    const cols = splitCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

function programaId(clube) {
  return clube?.toLowerCase().includes('aventureiro') ? 2 : 1;
}

function normalizeText(value) {
  return String(value ?? '')
    .replace(/Cięncia/g, 'Ciência')
    .replace(/Măos/g, 'Mãos')
    .replace(/Ajudadoras/g, 'Ajudadoras')
    .trim();
}

function nullable(value) {
  const s = normalizeText(value);
  return s ? s : null;
}

function numberOrNull(value) {
  const s = normalizeText(value);
  if (!s || s === '-') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function extMime(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  return 'application/octet-stream';
}

async function ensureBucket() {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;
  if (!buckets?.some((b) => b.name === BUCKET)) {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 2 * 1024 * 1024,
      allowedMimeTypes: ['image/png', 'image/jpeg'],
    });
    if (error) throw error;
  }
}

async function uploadImages(itemRows) {
  const refs = Array.from(new Set(itemRows.map((r) => r.imagem_arquivo).filter(Boolean)));
  const urls = new Map();
  let uploaded = 0;
  let skipped = 0;

  for (const ref of refs) {
    const normalizedRef = ref.replaceAll('\\', '/');
    const localPath = path.join(baseDir, ...normalizedRef.split('/'));
    try {
      const bytes = await fs.readFile(localPath);
      const storagePath = normalizedRef.replace(/^imagens_mda\//, '');
      const { error } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
        contentType: extMime(localPath),
        upsert: true,
      });
      if (error) throw error;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
      urls.set(normalizedRef, data.publicUrl);
      uploaded++;
    } catch (e) {
      skipped++;
      console.warn(`Imagem não enviada: ${normalizedRef} (${e.message})`);
    }
  }
  return { urls, uploaded, skipped };
}

async function upsertRows(table, rows, onConflict, chunkSize = 500) {
  let total = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) throw error;
    total += chunk.length;
  }
  return total;
}

function dedupeRows(rows, keyFn) {
  const map = new Map();
  for (const row of rows) map.set(keyFn(row), row);
  return Array.from(map.values());
}

async function fetchItemIds() {
  const classes = [];
  const especialidades = [];

  for (const programa_id of [1, 2]) {
    const [{ data: cls, error: clsError }, { data: esp, error: espError }] = await Promise.all([
      supabase.from('classes_modelo').select('id,programa_id,nome,fonte_oficial').eq('programa_id', programa_id),
      supabase.from('especialidades_modelo').select('id,programa_id,nome,item_url').eq('programa_id', programa_id),
    ]);
    if (clsError) throw clsError;
    if (espError) throw espError;
    classes.push(...(cls ?? []));
    especialidades.push(...(esp ?? []));
  }

  const classByKey = new Map(classes.map((c) => [`${c.programa_id}|${c.fonte_oficial || ''}|${c.nome}`, c.id]));
  const espByKey = new Map(especialidades.map((e) => [`${e.programa_id}|${e.item_url || ''}|${e.nome}`, e.id]));
  return { classByKey, espByKey };
}

async function main() {
  const itensCsv = path.join(baseDir, 'itens_mda.csv');
  const requisitosCsv = path.join(baseDir, 'requisitos_mda.csv');

  const [itens, requisitos] = await Promise.all([readCsv(itensCsv), readCsv(requisitosCsv)]);
  console.log(`Itens: ${itens.length}`);
  console.log(`Requisitos: ${requisitos.length}`);

  await ensureBucket();
  const { urls, uploaded, skipped } = await uploadImages(itens);
  console.log(`Imagens enviadas/atualizadas: ${uploaded}; falhas: ${skipped}`);

  const classes = [];
  const especialidades = [];

  for (const item of itens) {
    const programa_id = programaId(item.clube);
    const tipo = normalizeText(item.tipo);
    const imagemArquivo = nullable(item.imagem_arquivo)?.replaceAll('\\', '/') ?? null;
    const imagemUrl = imagemArquivo ? urls.get(imagemArquivo) ?? nullable(item.imagem_url) : nullable(item.imagem_url);

    if (tipo === 'Classe') {
      classes.push({
        programa_id,
        nome: normalizeText(item.nome),
        tipo: 'regular',
        idade_indicada: null,
        ordem: 100,
        ativo: true,
        codigo: nullable(item.codigo),
        nome_completo: nullable(item.nome_completo),
        categoria: nullable(item.categoria),
        fonte_oficial: nullable(item.url),
        imagem_url: imagemUrl,
        imagem_arquivo: imagemArquivo,
        updated_at: new Date().toISOString(),
      });
    } else if (tipo === 'Especialidade') {
      especialidades.push({
        programa_id,
        nome: normalizeText(item.nome),
        codigo: nullable(item.codigo),
        categoria: nullable(item.categoria),
        tipo_nivel: nullable(item.nivel),
        ano_criacao: numberOrNull(item.ano),
        ano_revisao: null,
        idade_indicada: null,
        pre_requisitos: null,
        requisitos: null,
        quantidade_requisitos: null,
        insignia_url: imagemUrl,
        mestrado_relacionado: null,
        materiais_necessarios: null,
        observacoes: null,
        fonte_oficial: nullable(item.url),
        status: 'Ativa',
        ativo: true,
        item_url: nullable(item.url),
        nome_completo: nullable(item.nome_completo),
        area: nullable(item.area),
        nivel: nullable(item.nivel),
        instituicao_origem: nullable(item.instituicao_origem),
        imagem_arquivo: imagemArquivo,
        updated_at: new Date().toISOString(),
      });
    }
  }

  const classesUnicas = dedupeRows(classes, (r) => `${r.programa_id}|${r.nome}`);
  const especialidadesUnicas = dedupeRows(especialidades, (r) => `${r.programa_id}|${r.nome}`);

  await upsertRows('classes_modelo', classesUnicas, 'programa_id,nome', 200);
  await upsertRows('especialidades_modelo', especialidadesUnicas, 'programa_id,nome', 200);

  const { classByKey, espByKey } = await fetchItemIds();
  const reqRows = dedupeRows(requisitos
    .map((r) => {
      const programa_id = programaId(r.clube);
      const itemTipo = normalizeText(r.tipo);
      const itemUrl = normalizeText(r.item_url);
      const itemNome = normalizeText(r.nome);
      const classe_id = itemTipo === 'Classe'
        ? classByKey.get(`${programa_id}|${itemUrl}|${itemNome}`) ?? null
        : null;
      const especialidade_id = itemTipo === 'Especialidade'
        ? espByKey.get(`${programa_id}|${itemUrl}|${itemNome}`) ?? null
        : null;
      return {
        programa_id,
        item_tipo: itemTipo,
        item_nome: itemNome,
        item_codigo: nullable(r.codigo),
        item_url: itemUrl,
        classe_id,
        especialidade_id,
        secao: nullable(r.secao),
        ordem: numberOrNull(r.ordem) ?? 100,
        texto: normalizeText(r.texto),
        updated_at: new Date().toISOString(),
      };
    })
    .filter((r) => r.item_url && r.item_nome && r.texto), (r) =>
      `${r.programa_id}|${r.item_tipo}|${r.item_url}|${r.ordem}|${r.texto}`
    );

  await upsertRows('mda_requisitos_modelo', reqRows, 'programa_id,item_tipo,item_url,ordem,texto', 500);

  const qtdByItem = new Map();
  for (const r of reqRows) {
    if (r.item_tipo !== 'Especialidade' || !r.especialidade_id) continue;
    qtdByItem.set(r.especialidade_id, (qtdByItem.get(r.especialidade_id) ?? 0) + 1);
  }
  const updateQtd = Array.from(qtdByItem.entries()).map(([id, quantidade_requisitos]) => ({ id, quantidade_requisitos }));
  for (const row of updateQtd) {
    const { error } = await supabase
      .from('especialidades_modelo')
      .update({ quantidade_requisitos: row.quantidade_requisitos, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    if (error) throw error;
  }

  console.log(JSON.stringify({
    classes: classesUnicas.length,
    especialidades: especialidadesUnicas.length,
    requisitos: reqRows.length,
    imagens: uploaded,
    imagens_falha: skipped,
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
