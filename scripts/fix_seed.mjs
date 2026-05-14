import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = 'C:/Users/adm.sloannascimento/Downloads/DBV-Fonseca-3.0';

const wb = xlsx.readFile(join(BASE, 'Membros do Clube_v0.xlsx'));

const UNIDADE_MAP = {
  'Amor Perfeito': 1,
  'Sempre Viva': 2,
  'Águia Dourada': 3,
  'Leões': 4,
};

function getRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) { console.warn('Sheet not found:', sheetName); return []; }
  const raw = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  let headerRow = -1;
  for (let i = 0; i < Math.min(raw.length, 10); i++) {
    if (raw[i].some(c => String(c).toUpperCase().includes('NOME') || String(c).toUpperCase().includes('IDX'))) {
      headerRow = i;
      break;
    }
  }
  if (headerRow < 0) { console.warn('No header in', sheetName); return []; }
  const headers = raw[headerRow].map(h => String(h).trim());
  return raw.slice(headerRow + 1)
    .filter(row => row.some(c => c !== ''))
    .map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ''])));
}

function esc(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  return "'" + String(v).trim().replace(/'/g, "''") + "'";
}

function dateVal(v) {
  if (!v && v !== 0) return 'NULL';
  if (typeof v === 'number' && v > 0) {
    const d = xlsx.SSF.parse_date_code(v);
    if (!d) return 'NULL';
    return `'${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}'`;
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `'${s}'`;
  return 'NULL';
}

function timeVal(v) {
  if (!v && v !== 0) return 'NULL';
  if (typeof v === 'number') {
    const totalMin = Math.round(v * 24 * 60);
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    return `'${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}'`;
  }
  const s = String(v).trim();
  if (/^\d{1,2}:\d{2}/.test(s)) return `'${s.slice(0,5)}'`;
  return 'NULL';
}

function boolVal(v) {
  const s = String(v).toUpperCase().trim();
  return (s === 'S' || s === 'SIM' || s === '1' || s === 'OK' || s === 'X' || s === 'TRUE') ? 1 : 0;
}

const lines = ['-- 002_seed.sql (corrigido - gerado automaticamente)', ''];

// ---- DBVs ----
const dbvRows = getRows(wb, 'Dados DBVs');
const dbvIds = new Set();

lines.push('-- Desbravadores');
for (const r of dbvRows) {
  const idx = parseInt(r['IDX']);
  if (isNaN(idx) || idx <= 0) continue;
  dbvIds.add(idx);

  const idSgc = r['ID SGC'] || '';
  const nome = r['NOME'] || '';
  const dn = dateVal(r['DATA DE NASCIMENTO']);
  const idade = parseInt(r['IDADE']) || 0;
  const genero = String(r['GENERO'] || r['GÊNERO'] || '').trim();
  const unidadeNome = String(r['UNIDADE'] || '').trim();
  const unidadeId = UNIDADE_MAP[unidadeNome] || null;
  const cargo = String(r['CARGO'] || 'DBV').trim();
  const campori = boolVal(r['CAMPORI DSA (S/N)'] || r['CAMPORI DSA'] || r['CAMPORI'] || 0);
  const resp = r['NOME DO RESPONSÁVEL'] || r['NOME RESPONSÁVEL'] || '';
  const contato = r['CONTATO DO RESPONSÁVEL'] || r['CONTATO RESPONSÁVEL'] || '';

  const unidadeIdSql = unidadeId === null ? 'NULL' : unidadeId;
  const camporiSql = campori ? 'TRUE' : 'FALSE';
  lines.push(`INSERT INTO desbravadores (id, idx, id_sgc, nome, data_nascimento, idade, genero, unidade_id, unidade_nome, cargo, campori_dsa, nome_responsavel, contato_responsavel) VALUES (${idx}, ${idx}, ${esc(idSgc)}, ${esc(nome)}, ${dn}, ${idade}, ${esc(genero)}, ${unidadeIdSql}, ${esc(unidadeNome)}, ${esc(cargo)}, ${camporiSql}, ${esc(resp)}, ${esc(contato)}) ON CONFLICT (id) DO NOTHING;`);
}
console.log(`DBVs: ${dbvIds.size}`);

// ---- Documentos ----
// Schema: rg, cpf, rg_resp, cartao_sus, cartao_plano, ficha_saude, carteira_vacinacao,
//         laudo_medico, ficha_reg, comp_residencia, aut_saida, aut_viagem, ri_assinado, foto, ant_criminais
// Spreadsheet tracks presence (OK/NOK), not actual document numbers — insert skeleton rows only
lines.push('', '-- Documentos (linhas base)');
let docCount = 0;
for (const idx of dbvIds) {
  docCount++;
  lines.push(`INSERT INTO documentos (dbv_id) VALUES (${idx}) ON CONFLICT DO NOTHING;`);
}
console.log(`Docs: ${docCount}`);

// ---- Progresso Classes ----
// Schema columns: amigo, amigo_nat, companheiro, comp_exc, pesquisador, pesquisador_cb,
//                 pioneiro, pioneiro_nf, excursionista, exc_mata, guia, guia_exp, agrupada,
//                 lider, lider_master, lider_ma
// Spreadsheet columns (positional): AMIGO, COMPANHEIRO, PESQUISADOR, PIONEIRO, EXCURSIONISTA,
//   LÍDER, AMIGO M, COMPANHEIRO M, PESQUISADOR M, PIONEIRO M, EXCURSIONISTA M, LÍDER M,
//   LÍDER A, LÍDER MA, LÍDER S, LÍDER MAX
lines.push('', '-- Progresso Classes');
const classRows = getRows(wb, 'Classes');
const schemaClassCols = [
  'amigo','amigo_nat','companheiro','comp_exc','pesquisador','pesquisador_cb',
  'pioneiro','pioneiro_nf','excursionista','exc_mata','guia','guia_exp',
  'agrupada','lider','lider_master','lider_ma'
];

function textVal(v) {
  const s = String(v).toUpperCase().trim();
  if (s === 'OK' || s === 'S' || s === 'SIM' || s === '1' || s === 'X' || s === 'TRUE') return "'OK'";
  if (s === 'NOK' || s === 'N' || s === 'NÃO' || s === 'NAO' || s === '0' || s === 'FALSE') return "'NOK'";
  if (s === 'EM ANDAMENTO' || s === 'ANDAMENTO' || s === 'A') return "'Em Andamento'";
  if (s === '' || s === 'NULL') return 'NULL';
  return esc(String(v).trim());
}

let classCount = 0;
for (const r of classRows) {
  const idx = parseInt(r['IDX']);
  if (isNaN(idx) || !dbvIds.has(idx)) continue;
  classCount++;

  const allKeys = Object.keys(r).filter(k => k !== 'IDX' && k !== 'NOME' && k !== '');
  const vals = schemaClassCols.map((_, i) => {
    const key = allKeys[i];
    return key ? textVal(r[key]) : 'NULL';
  });

  lines.push(`INSERT INTO progresso_classes (dbv_id, ${schemaClassCols.join(', ')}) VALUES (${idx}, ${vals.join(', ')}) ON CONFLICT (dbv_id) DO NOTHING;`);
}
// Fill in missing IDX entries (55-57) if not in sheet
for (const idx of dbvIds) {
  if (!classRows.find(r => parseInt(r['IDX']) === idx)) {
    lines.push(`INSERT INTO progresso_classes (dbv_id) VALUES (${idx}) ON CONFLICT (dbv_id) DO NOTHING;`);
  }
}
console.log(`Classes: ${classCount}`);

// ---- Especialidades (matriz: colunas=especialidades, linhas=DBVs, valor OK=concluída) ----
lines.push('', '-- Especialidades');
const especSheet = wb.Sheets['Especialidades'];
let especCount = 0;

if (especSheet) {
  const raw = xlsx.utils.sheet_to_json(especSheet, { header: 1, defval: '' });
  // Find header row
  let hi = -1;
  for (let i = 0; i < Math.min(raw.length, 10); i++) {
    if (raw[i].some(c => String(c).toUpperCase() === 'IDX')) { hi = i; break; }
  }
  if (hi >= 0) {
    const headers = raw[hi].map(h => String(h).trim());
    // Column 0=IDX, 1=NOME, 2..N = specialty names
    const especCols = headers.slice(2).filter(h => h !== '');

    for (const row of raw.slice(hi + 1)) {
      const idx = parseInt(row[0]);
      if (isNaN(idx) || !dbvIds.has(idx)) continue;

      for (let ci = 0; ci < especCols.length; ci++) {
        const val = String(row[ci + 2] || '').toUpperCase().trim();
        if (val === 'OK') {
          especCount++;
          lines.push(`INSERT INTO especialidades (dbv_id, nome, status) VALUES (${idx}, ${esc(especCols[ci])}, 'OK') ON CONFLICT (dbv_id, nome) DO NOTHING;`);
        }
      }
    }
  }
}
console.log(`Especialidades: ${especCount}`);

// ---- Eventos (Calendário) ----
// Colunas: DATA(0), HORÁRIO(1), LOCAL(2), ATIVIDADE(3), RESPONSÁVEL(4), APOIO(5), DIVERSOS(6), OBSERVAÇÕES(7)
lines.push('', '-- Eventos');
const calWb = xlsx.readFile(join(BASE, 'Calendário FONSECA 2026.xlsx'));
const calSheet = calWb.Sheets[calWb.SheetNames[0]];
let eventoCount = 0;

if (calSheet) {
  const calRaw = xlsx.utils.sheet_to_json(calSheet, { header: 1, defval: '' });
  // Find the header row (DATA, HORÁRIO, LOCAL, ATIVIDADE...)
  let hi = -1;
  for (let i = 0; i < Math.min(calRaw.length, 10); i++) {
    if (String(calRaw[i][0]).toUpperCase().trim() === 'DATA') { hi = i; break; }
  }
  if (hi >= 0) {
    for (const row of calRaw.slice(hi + 1)) {
      if (!row.some(c => c !== '')) continue;
      const rawData = row[0];
      // Only process rows where DATA is a numeric date code
      if (typeof rawData !== 'number' || rawData < 40000) continue;
      const data = dateVal(rawData);
      if (data === 'NULL') continue;

      // ATIVIDADE is col 3; take only first line if multiline
      const atividade = String(row[3] || '').split('\n')[0].split('\r')[0].trim();
      if (!atividade || atividade === '-') continue;

      const local = String(row[2] || '').trim();
      const responsavel = String(row[4] || '').split('\n')[0].split('\r')[0].trim();
      const horario = timeVal(row[1]);

      eventoCount++;
      lines.push(`INSERT INTO eventos (data, horario, local, atividade, responsavel) VALUES (${data}, ${horario}, ${esc(local)}, ${esc(atividade)}, ${esc(responsavel)}) ON CONFLICT DO NOTHING;`);
    }
  }
}
console.log(`Eventos: ${eventoCount}`);

const outPath = join(__dirname, '..', 'supabase', 'migrations', '002_seed.sql');
writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`\n✅ Seed gerado: ${outPath}`);
