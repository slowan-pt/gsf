import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const CLUBE_ID = 1;
const PROGRAMA_ID = 1;
const membrosPath = process.argv[2] ?? 'C:/Users/adm.sloannascimento/Downloads/mda/Membros do Clube_v0.xlsx';
const rankingPath = process.argv[3] ?? 'C:/Users/adm.sloannascimento/Downloads/mda/Ranking 2026.xlsx';
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRole) {
  console.error('Defina SUPABASE_SERVICE_ROLE_KEY antes de rodar.');
  process.exit(1);
}

const supabase = createClient('https://enoacjmlcznsrvynnamf.supabase.co', serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const UNIDADES = [
  { id: 1, nome: 'Amor Perfeito', cor: '#e91e63' },
  { id: 2, nome: 'Sempre Viva', cor: '#4caf50' },
  { id: 3, nome: 'Águia Dourada', cor: '#ff9800' },
  { id: 4, nome: 'Leões', cor: '#2196f3' },
];

const unidadeIdPorNome = new Map(UNIDADES.map((u) => [u.nome.toLowerCase(), u.id]));
const unidadeNomePorId = new Map(UNIDADES.map((u) => [u.id, u.nome]));

const DOC_MAP = {
  'RG': 'rg',
  'CPF': 'cpf',
  'RG RESP.': 'rg_resp',
  'CARTÃO SUS': 'cartao_sus',
  'CARTÃO PLANO': 'cartao_plano',
  'FICHA DE SAÚDE ASSINADA': 'ficha_saude',
  'CARTEIRA DE VACINAÇÃO': 'carteira_vacinacao',
  'LAUDO MÉDICO': 'laudo_medico',
  'FICHA DE REG. ATUALIZADA': 'ficha_reg',
  'COMP.RESID.': 'comp_residencia',
  'AUT. SAÍDA ASSINADA': 'aut_saida',
  'AUT.VIAGEM AUTENTICADA': 'aut_viagem',
  'RI ASSINADO': 'ri_assinado',
  'FOTO': 'foto',
  'ANT.CRIMINAIS': 'ant_criminais',
};

const CLASSE_MAP = {
  'AMIGO': 'amigo',
  'AMIGO NAT.': 'amigo_nat',
  'COMPANHEIRO': 'companheiro',
  'COMP. EXC.': 'comp_exc',
  'PESQUISADOR': 'pesquisador',
  'PESQUISADOR C.B': 'pesquisador_cb',
  'PIONEIRO': 'pioneiro',
  'PIONEIRO N.F.': 'pioneiro_nf',
  'EXCURSIONISTA': 'excursionista',
  'EXC. DA MATA': 'exc_mata',
  'GUIA': 'guia',
  'GUIA EXP.': 'guia_exp',
  'AGRUPADA': 'agrupada',
  'LÍDER': 'lider',
  'LÍDER MASTER': 'lider_master',
  'LÍDER MA': 'lider_ma',
};

const HEADER_ALIASES = {
  'DANIELA': 1,
  'ISABELLE': 2,
  'KALLYNE': 3,
  'KAUANE': 4,
  'LAURA': 5,
  'LUISY': 6,
  'POLIANA': 7,
  'VALENTINA': 8,
  'CESSIA': 9,
  'CASSIA': 10,
  'ALICE': 11,
  'ANA LUIZA': 12,
  'ESTHER': 13,
  'GABRIELA': 14,
  'JULIA': 15,
  'LAURA HELENA': 16,
  'MANUELA': 17,
  'NATHALY': 18,
  'TALITA': 19,
  'DUDA': 20,
  'LARISSA': 21,
  'BENJAMIN': 22,
  'BERNARDO': 23,
  'DANIEL': 24,
  'DAVI VICTOR': 25,
  'DAVI VITOR': 25,
  'ENZO': 26,
  'KHALED': 27,
  'MATEUS': 28,
  'PEDRO F.': 29,
  'THALES': 30,
  'WILLIAM': 31,
  'DENNIS': 32,
  'DIOGO': 33,
  'CAETANO': 34,
  'DAVI': 35,
  'JG': 36,
  'JOÃO GABRIEL': 36,
  'LUCAS': 37,
  'LUIS GUSTAVO': 38,
  'LUIZ MIGUEL': 39,
  'NICOLAS': 40,
  'PEDRO D.': 41,
  'MARCUS': 42,
  'GABRIEL': 43,
};

function norm(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function upper(value) {
  return norm(value).toUpperCase();
}

function dateSql(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    const d = XLSX.SSF.parse_date_code(value);
    if (!d) return null;
    return `${String(d.y).padStart(4, '0')}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = norm(value);
  const mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (mIso) return `${mIso[1]}-${mIso[2]}-${mIso[3]}`;
  const mBr = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (mBr) {
    const y = mBr[3].length === 2 ? `20${mBr[3]}` : mBr[3];
    return `${y}-${mBr[2].padStart(2, '0')}-${mBr[1].padStart(2, '0')}`;
  }
  return null;
}

function boolCampori(value) {
  return ['S', 'SIM', 'TRUE', '1', 'OK'].includes(upper(value));
}

function status(value) {
  const s = upper(value);
  if (!s) return null;
  if (s === 'OK') return 'OK';
  if (s === 'NOK') return 'NOK';
  if (s === 'NA' || s === 'N/A') return 'NA';
  if (s.includes('ANDAMENTO')) return 'Em Andamento';
  return norm(value);
}

function statusEspecialidade(value) {
  const s = upper(value);
  if (s === 'OK') return 'OK';
  if (s === 'NOK') return 'NOK';
  return null;
}

function numberPoints(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const s = norm(value);
  if (!s || s === '-' || s.toUpperCase() === 'NOK') return 0;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function readRows(file, sheetName) {
  const wb = XLSX.readFile(file, { cellDates: true });
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Aba não encontrada: ${sheetName}`);
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
}

function headerMap(row) {
  const map = new Map();
  row.forEach((h, idx) => {
    const key = upper(h);
    if (key) map.set(key, idx);
  });
  return map;
}

function cell(row, map, header) {
  const idx = map.get(upper(header));
  return idx === undefined ? null : row[idx];
}

async function upsert(table, rows, onConflict, size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    if (!chunk.length) continue;
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function insert(table, rows, size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    if (!chunk.length) continue;
    const { error } = await supabase.from(table).insert(chunk);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function deleteWhere(table, column = 'clube_id', value = CLUBE_ID) {
  const { error } = await supabase.from(table).delete().eq(column, value);
  if (error) throw new Error(`delete ${table}: ${error.message}`);
}

function parseMembros() {
  const rows = readRows(membrosPath, 'Dados DBVs');
  const headers = headerMap(rows[2]);
  const membros = [];
  for (const row of rows.slice(3)) {
    const idx = Number(cell(row, headers, 'IDX'));
    const nome = norm(cell(row, headers, 'NOME'));
    if (!idx || !nome) continue;
    const unidadeNome = norm(cell(row, headers, 'UNIDADE'));
    const unidadeId = unidadeIdPorNome.get(unidadeNome.toLowerCase()) ?? null;
    membros.push({
      id: idx,
      idx,
      id_sgc: norm(cell(row, headers, 'ID SGC')) || null,
      nome,
      data_nascimento: dateSql(cell(row, headers, 'DATA DE NASCIMENTO')),
      idade: Number(cell(row, headers, 'IDADE')) || null,
      genero: norm(cell(row, headers, 'GENERO')) || null,
      unidade_id: unidadeId,
      unidade_nome: unidadeId ? unidadeNomePorId.get(unidadeId) : (unidadeNome || (norm(cell(row, headers, 'CARGO')) === 'DIR' ? 'Diretoria' : null)),
      cargo: norm(cell(row, headers, 'CARGO')) || null,
      contato: norm(cell(row, headers, 'CONTATO')) || null,
      email: norm(cell(row, headers, 'EMAIL')) || null,
      camisa: norm(cell(row, headers, 'CAMISA')) || null,
      campori_dsa: boolCampori(cell(row, headers, 'CAMPORI DSA (S/N)')),
      nome_responsavel: norm(cell(row, headers, 'NOME DO RESPONSÁVEL')) || null,
      contato_responsavel: norm(cell(row, headers, 'CONTATO DO RESPONSÁVEL')) || null,
      clube_id: CLUBE_ID,
      updated_at: new Date().toISOString(),
    });
  }
  return membros;
}

function parseUnidades() {
  const rows = readRows(membrosPath, 'Unidades');
  const headers = headerMap(rows[0]);
  const porId = new Map();
  for (const row of rows.slice(1)) {
    const nome = norm(cell(row, headers, 'UNIDADE'));
    if (!nome || nome.startsWith('OBS')) continue;
    const base = UNIDADES.find((u) => u.nome.toLowerCase() === nome.toLowerCase());
    if (!base) continue;
    porId.set(base.id, {
      id: base.id,
      nome: base.nome,
      codigo_clube: Number(cell(row, headers, 'CÓDIGO DO CLUBE')) || 5659,
      senha_unidade: Number(cell(row, headers, 'SENHA DA UNIDADE')) || null,
      cor: base.cor,
      clube_id: CLUBE_ID,
    });
  }
  return Array.from(porId.values());
}

function parseDocumentos(membroIds) {
  const rows = readRows(membrosPath, 'Documentos');
  const headers = headerMap(rows[2]);
  const docs = [];
  for (const row of rows.slice(3)) {
    const dbv_id = Number(cell(row, headers, 'IDX'));
    if (!membroIds.has(dbv_id)) continue;
    const doc = { dbv_id, clube_id: CLUBE_ID, updated_at: new Date().toISOString() };
    for (const [header, col] of Object.entries(DOC_MAP)) {
      doc[col] = status(cell(row, headers, header));
    }
    docs.push(doc);
  }
  return docs;
}

function parseClasses(membroIds) {
  const rows = readRows(membrosPath, 'Classes');
  const headers = headerMap(rows[2]);
  const classes = [];
  for (const row of rows.slice(3)) {
    const dbv_id = Number(cell(row, headers, 'IDX'));
    if (!membroIds.has(dbv_id)) continue;
    const item = { dbv_id, clube_id: CLUBE_ID, updated_at: new Date().toISOString() };
    for (const [header, col] of Object.entries(CLASSE_MAP)) {
      item[col] = status(cell(row, headers, header));
    }
    classes.push(item);
  }
  return classes;
}

function parseEspecialidades(membroIds) {
  const rows = readRows(membrosPath, 'Especialidades');
  const headerRow = rows[2];
  const headers = headerMap(headerRow);
  const especialidades = [];
  const nomeIdx = headers.get('NOME') ?? 1;
  for (const row of rows.slice(3)) {
    const dbv_id = Number(cell(row, headers, 'IDX'));
    if (!membroIds.has(dbv_id)) continue;
    for (let ci = nomeIdx + 1; ci < headerRow.length; ci++) {
      const nome = norm(headerRow[ci]);
      if (!nome || nome.toUpperCase() === 'EXTRAS') continue;
      const st = statusEspecialidade(row[ci]);
      if (!st) continue;
      especialidades.push({ dbv_id, clube_id: CLUBE_ID, nome, status: st, updated_at: new Date().toISOString() });
    }
  }
  return especialidades;
}

function mapRankingHeaderToId(header) {
  const h = upper(header);
  return HEADER_ALIASES[h] ?? null;
}

function customSigla(desc) {
  return upper(desc)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 6) || 'ITEM';
}

function parseRanking(membroIds) {
  const rows = readRows(rankingPath, 'Geral');
  const header = rows[2];
  const memberCols = [];
  const dataIdx = header.findIndex((h) => upper(h) === 'DIA');
  const descIdx = header.findIndex((h) => upper(h) === 'DESCRIÇÃO');
  if (dataIdx < 0 || descIdx < 0) throw new Error('Cabeçalho do ranking não encontrado.');
  for (let ci = descIdx + 1; ci < header.length; ci++) {
    const dbv_id = mapRankingHeaderToId(header[ci]);
    if (dbv_id && membroIds.has(dbv_id)) memberCols.push({ ci, dbv_id, label: norm(header[ci]) });
  }

  const pontByKey = new Map();
  const customItems = new Map();
  const customRows = [];
  let currentDate = null;

  function pont(dbv_id, data) {
    const key = `${dbv_id}|${data}`;
    if (!pontByKey.has(key)) {
      pontByKey.set(key, {
        dbv_id,
        clube_id: CLUBE_ID,
        data,
        presenca: false,
        pontualidade: false,
        material: false,
        uniforme: false,
        bom_biblia: 0,
        pontos_extras: 0,
        classe_biblica: 0,
        especialidade: 0,
        pgm_especial: 0,
        atividade_unidade: 0,
        observacao: null,
        lancado_por: 'Importação Ranking 2026',
        updated_at: new Date().toISOString(),
      });
    }
    return pontByKey.get(key);
  }

  for (const row of rows.slice(3)) {
    const date = dateSql(row[dataIdx]);
    if (date) currentDate = date;
    if (!currentDate) continue;
    const desc = norm(row[descIdx]);
    if (!desc) continue;
    const descUpper = upper(desc);

    for (const { ci, dbv_id } of memberCols) {
      const pts = numberPoints(row[ci]);
      if (!pts) continue;
      const p = pont(dbv_id, currentDate);
      if (descUpper === 'PRESENÇA') p.presenca = true;
      else if (descUpper === 'PONTUALIDADE') p.pontualidade = true;
      else if (descUpper === 'MATERIAL') p.material = true;
      else if (descUpper === 'UNIFORME') p.uniforme = true;
      else if (descUpper === 'PONTOS EXTRAS') {
        p.pontos_extras += pts;
        p.observacao = [p.observacao, desc].filter(Boolean).join('; ') || desc;
      } else {
        if (!customItems.has(desc)) customItems.set(desc, { nome: desc, valor: pts, sigla: customSigla(desc) });
        customRows.push({ dbv_id, data: currentDate, nome: desc, pontos: pts });
      }
    }
  }
  return { pontuacoes: Array.from(pontByKey.values()), customItems: Array.from(customItems.values()), customRows };
}

async function main() {
  const membros = parseMembros();
  const membroIds = new Set(membros.map((m) => m.id));
  const unidades = parseUnidades();
  const docs = parseDocumentos(membroIds);
  const classes = parseClasses(membroIds);
  const especialidades = parseEspecialidades(membroIds);
  const ranking = parseRanking(membroIds);

  console.log({ membros: membros.length, unidades: unidades.length, docs: docs.length, classes: classes.length, especialidades: especialidades.length, pontuacoes: ranking.pontuacoes.length, customItems: ranking.customItems.length, customRows: ranking.customRows.length });

  // Limpa apenas dados derivados do Clube Fonseca. Usuários/Auth/acessos não são tocados.
  await deleteWhere('pontuacoes_custom');
  await deleteWhere('pontuacoes');
  await deleteWhere('especialidades');
  await deleteWhere('documentos');
  await deleteWhere('progresso_classes');
  await supabase.from('config_pontuacao_itens').delete().eq('clube_id', CLUBE_ID);

  await upsert('unidades', unidades, 'id', 100);
  await upsert('desbravadores', membros, 'id', 200);
  await insert('documentos', docs, 200);
  await insert('progresso_classes', classes, 200);
  await insert('especialidades', especialidades, 500);

  const { data: configExistente, error: configBuscaErro } = await supabase
    .from('config_pontuacao')
    .select('id')
    .eq('clube_id', CLUBE_ID)
    .maybeSingle();
  if (configBuscaErro) throw configBuscaErro;
  const configPayload = { clube_id: CLUBE_ID, presenca: 25, pontualidade: 100, material: 25, uniforme: 25, updated_at: new Date().toISOString() };
  const configResp = configExistente?.id
    ? await supabase.from('config_pontuacao').update(configPayload).eq('id', configExistente.id)
    : await supabase.from('config_pontuacao').insert(configPayload);
  if (configResp.error) throw configResp.error;

  const customConfigRows = ranking.customItems.map((item) => ({
    clube_id: CLUBE_ID,
    nome: item.nome,
    valor: item.valor,
    ativo: true,
    updated_at: new Date().toISOString(),
  }));
  await insert('config_pontuacao_itens', customConfigRows, 200);

  const { data: configItems, error: cfgErr } = await supabase
    .from('config_pontuacao_itens')
    .select('id,nome,valor')
    .eq('clube_id', CLUBE_ID);
  if (cfgErr) throw cfgErr;
  const itemByName = new Map((configItems ?? []).map((i) => [i.nome, i]));

  const customRows = ranking.customRows
    .map((r) => {
      const item = itemByName.get(r.nome);
      if (!item) return null;
      return {
        clube_id: CLUBE_ID,
        dbv_id: r.dbv_id,
        data: r.data,
        item_id: item.id,
        quantidade: 1,
        pontos: r.pontos,
        updated_at: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  await insert('pontuacoes', ranking.pontuacoes, 500);
  await insert('pontuacoes_custom', customRows, 500);

  const { error: inactiveErr } = await supabase
    .from('desbravadores')
    .update({ unidade_id: null })
    .eq('clube_id', CLUBE_ID)
    .not('id', 'in', `(${Array.from(membroIds).join(',')})`);
  if (inactiveErr) console.warn('Aviso ao ajustar membros fora da planilha:', inactiveErr.message);

  console.log('Importação Fonseca concluída.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
