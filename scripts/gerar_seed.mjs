import XLSX from 'xlsx';
import { writeFileSync } from 'fs';

const ARQUIVO_MEMBROS = 'C:/Users/adm.sloannascimento/Downloads/DBV-Fonseca-3.0/Membros do Clube_v0.xlsx';
const ARQUIVO_RANKING = 'C:/Users/adm.sloannascimento/Downloads/DBV-Fonseca-3.0/Ranking 2026.xlsx';
const ARQUIVO_CALENDARIO = 'C:/Users/adm.sloannascimento/Downloads/DBV-Fonseca-3.0/Calendário FONSECA 2026.xlsx';

function esc(v) {
  if (v == null || v === '' || v === 'NaN') return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function boolSql(v) {
  if (!v || v === 'N' || v === 'NOK' || v === 'NaN') return 'FALSE';
  return 'TRUE';
}

function getSheet(arquivo, aba, headerRow = 2) {
  const wb = XLSX.readFile(arquivo, { cellDates: true });
  const ws = wb.Sheets[aba];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const headers = raw[headerRow].map(h => h ? String(h).trim() : null);
  const rows = [];
  for (let i = headerRow + 1; i < raw.length; i++) {
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      if (headers[j]) row[headers[j]] = raw[i][j];
    }
    if (Object.values(row).some(v => v != null)) rows.push(row);
  }
  return rows;
}

const sql = [];
sql.push('-- SEED: Dados importados das planilhas Fonseca 2026');
sql.push('-- Gerado automaticamente em ' + new Date().toISOString());
sql.push('');

// UNIDADES
sql.push('-- Unidades');
sql.push(`INSERT INTO unidades (id, nome, codigo_clube, senha_unidade) VALUES
  (1, 'Amor Perfeito', 5659, 2509),
  (2, 'Sempre Viva', 5659, 2510),
  (3, 'Águia Dourada', 5659, 2511),
  (4, 'Leões', 5659, 2512)
ON CONFLICT (id) DO NOTHING;`);
sql.push('');

const mapaUnidade = {
  'Amor Perfeito': 1, 'Sempre Viva': 2, 'Águia Dourada': 3, 'Leões': 4,
  'aguia dourada': 3, 'leoes': 4, 'sempre viva': 2, 'amor perfeito': 1,
};

// DESBRAVADORES
const dbvRows = getSheet(ARQUIVO_MEMBROS, 'Dados DBVs');
console.log('Colunas DBVs:', Object.keys(dbvRows[0] || {}));

const dbvValidos = dbvRows.filter(r => r['NOME'] || r['IDX']);
sql.push('-- Desbravadores');
sql.push('INSERT INTO desbravadores (id, idx, id_sgc, nome, data_nascimento, idade, genero, unidade_id, unidade_nome, cargo, camisa, campori_dsa, nome_responsavel, contato_responsavel) VALUES');

const dbvInserts = dbvValidos.map((r, i) => {
  const nome = r['NOME'] || r['Nome'] || '';
  if (!nome) return null;
  const idx = parseInt(r['IDX'] || r['Idx'] || r['IDX '] || i + 1) || i + 1;
  const idSgc = r['ID SGC'] || '';
  const dtNasc = r['DATA DE NASCIMENTO'] || r['Data de Nascimento'] || null;
  let dtStr = 'NULL';
  if (dtNasc instanceof Date) {
    dtStr = `'${dtNasc.toISOString().split('T')[0]}'`;
  } else if (dtNasc) {
    dtStr = esc(dtNasc);
  }
  const idade = parseInt(r['IDADE'] || r['Idade'] || 0) || 0;
  const genero = r['GENERO'] || r['Gênero'] || r['GÊNERO'] || 'F';
  const generoVal = String(genero).trim().toUpperCase().startsWith('M') ? 'M' : 'F';
  const unidadeNome = r['UNIDADE'] || r['Unidade'] || '';
  const unidadeId = mapaUnidade[unidadeNome] || mapaUnidade[String(unidadeNome).toLowerCase()] || 1;
  const cargo = r['CARGO'] || r['Cargo'] || 'DBV';
  const camisa = r['CAMISA'] || r['Camisa'] || null;
  const campori = r['CAMPORI DSA (S/N)'] || r['Campori DSA (S/N)'] || 'N';
  const camporiVal = String(campori).trim().toUpperCase() === 'S' ? 'TRUE' : 'FALSE';
  const nomeResp = r['NOME DO RESPONSÁVEL'] || r['Nome do Responsável'] || null;
  const contResp = r['CONTATO DO RESPONSÁVEL'] || r['Contato do Responsável'] || null;

  return `  (${idx}, ${idx}, ${esc(idSgc)}, ${esc(nome)}, ${dtStr}, ${idade}, '${generoVal}', ${unidadeId}, ${esc(unidadeNome)}, ${esc(cargo)}, ${esc(camisa)}, ${camporiVal}, ${esc(nomeResp)}, ${esc(contResp)})`;
}).filter(Boolean);

sql.push(dbvInserts.join(',\n'));
sql.push('ON CONFLICT DO NOTHING;');
sql.push('');

// DOCUMENTOS
const docRows = getSheet(ARQUIVO_MEMBROS, 'Documentos');
console.log('Colunas Docs:', Object.keys(docRows[0] || {}));
sql.push('-- Documentos');
sql.push('INSERT INTO documentos (dbv_id, rg, cpf, rg_resp, cartao_sus, cartao_plano, ficha_saude, carteira_vacinacao, laudo_medico, ficha_reg, comp_residencia, aut_saida, aut_viagem, ri_assinado, foto, ant_criminais) VALUES');

const docInserts = docRows.filter(r => r['IDX'] || r['Idx']).map(r => {
  const idx = parseInt(r['IDX'] || r['Idx'] || 0);
  if (!idx) return null;
  const g = k => {
    const v = r[k];
    if (!v || String(v).trim() === '' || v === null) return 'NULL';
    return `'${String(v).trim()}'`;
  };
  return `  (${idx}, ${g('RG')}, ${g('CPF')}, ${g('RG RESP.')}, ${g('CARTÃO SUS')}, ${g('CARTÃO PLANO')}, ${g('FICHA DE SAÚDE ASSINADA')}, ${g('CARTEIRA DE VACINAÇÃO')}, ${g('LAUDO MÉDICO')}, ${g('FICHA DE REG. ATUALIZADA')}, ${g('COMP.RESID.')}, ${g('AUT. SAÍDA ASSINADA')}, ${g('AUT.VIAGEM AUTENTICADA')}, ${g('RI ASSINADO')}, ${g('FOTO')}, ${g('ANT.CRIMINAIS')})`;
}).filter(Boolean);

if (docInserts.length > 0) {
  sql.push(docInserts.join(',\n'));
  sql.push('ON CONFLICT DO NOTHING;');
}
sql.push('');

// CLASSES
const classRows = getSheet(ARQUIVO_MEMBROS, 'Classes');
console.log('Colunas Classes:', Object.keys(classRows[0] || {}));
sql.push('-- Progresso Classes');
sql.push('INSERT INTO progresso_classes (dbv_id, amigo, amigo_nat, companheiro, comp_exc, pesquisador, pesquisador_cb, pioneiro, pioneiro_nf, excursionista, exc_mata, guia, guia_exp, agrupada, lider, lider_master, lider_ma) VALUES');

const classInserts = classRows.filter(r => r['IDX'] || r['Idx']).map(r => {
  const idx = parseInt(r['IDX'] || r['Idx'] || 0);
  if (!idx) return null;
  const g = k => {
    const v = r[k];
    if (!v || String(v).trim() === '') return 'NULL';
    return `'${String(v).trim()}'`;
  };
  return `  (${idx}, ${g('AMIGO')}, ${g('AMIGO NAT.')}, ${g('COMPANHEIRO')}, ${g('COMP. EXC.')}, ${g('PESQUISADOR')}, ${g('PESQUISADOR C.B')}, ${g('PIONEIRO')}, ${g('PIONEIRO N.F.')}, ${g('EXCURSIONISTA')}, ${g('EXC. DA MATA')}, ${g('GUIA')}, ${g('GUIA EXP.')}, ${g('AGRUPADA')}, ${g('LÍDER')}, ${g('LÍDER MASTER')}, ${g('LÍDER MA')})`;
}).filter(Boolean);

if (classInserts.length > 0) {
  sql.push(classInserts.join(',\n'));
  sql.push('ON CONFLICT (dbv_id) DO NOTHING;');
}
sql.push('');

// ESPECIALIDADES
const espRows = getSheet(ARQUIVO_MEMBROS, 'Especialidades');
const espColunas = Object.keys(espRows[0] || {}).filter(k => !['IDX', 'Idx', 'NOME', 'Nome'].includes(k));
console.log('Especialidades:', espColunas);

sql.push('-- Especialidades');
const espInserts = [];
espRows.filter(r => r['IDX'] || r['Idx']).forEach(r => {
  const idx = parseInt(r['IDX'] || r['Idx'] || 0);
  if (!idx) return;
  espColunas.forEach(esp => {
    const v = r[esp];
    if (!v || String(v).trim() === '') return;
    espInserts.push(`  (${idx}, ${esc(esp)}, '${String(v).trim()}')`);
  });
});

if (espInserts.length > 0) {
  sql.push('INSERT INTO especialidades (dbv_id, nome, status) VALUES');
  sql.push(espInserts.join(',\n'));
  sql.push('ON CONFLICT (dbv_id, nome) DO NOTHING;');
}
sql.push('');

// EVENTOS DO CALENDÁRIO
const calRows = getSheet(ARQUIVO_CALENDARIO, 'Calendário Geral');
console.log('Colunas Cal:', Object.keys(calRows[0] || {}));
sql.push('-- Eventos Calendário');
sql.push('INSERT INTO eventos (data, horario, local, atividade, responsavel, apoio, material, observacoes, semestre) VALUES');

const evInserts = calRows.filter(r => r['ATIVIDADE'] && r['ATIVIDADE'] !== 'FOLGA').slice(0, 80).map(r => {
  let dataStr = 'NULL';
  const d = r['DATA'];
  if (d instanceof Date) dataStr = `'${d.toISOString().split('T')[0]}'`;
  else if (d) dataStr = esc(String(d).split(' ')[0]);
  const horario = r['HORÁRIO'] || r['HORARIO'] || null;
  let horStr = 'NULL';
  if (horario instanceof Date) horStr = `'${horario.toTimeString().slice(0,5)}'`;
  else if (horario) horStr = esc(String(horario).slice(0,5));
  return `  (${dataStr}, ${horStr}, ${esc(r['LOCAL'])}, ${esc(r['ATIVIDADE'])}, ${esc(r['RESPONSÁVEL'] || r['RESPONSAVEL'])}, ${esc(r['APOIO'])}, ${esc(r['DIVERSOS'] || r['MATERIAL NECESSÁRIO'])}, ${esc(r['OBSERVAÇÕES'] || r['OBSERVACOES'])}, 1)`;
});

if (evInserts.length > 0) {
  sql.push(evInserts.join(',\n'));
  sql.push('ON CONFLICT DO NOTHING;');
}

// 2º semestre
const calRows2 = getSheet(ARQUIVO_CALENDARIO, 'Cronograma 2º Semestre');
const evInserts2 = calRows2.filter(r => r['ATIVIDADE'] && r['ATIVIDADE'] !== 'FOLGA').slice(0, 60).map(r => {
  let dataStr = 'NULL';
  const d = r['DATA'];
  if (d instanceof Date) dataStr = `'${d.toISOString().split('T')[0]}'`;
  else if (d) dataStr = esc(String(d).split(' ')[0]);
  const horario = r['HORÁRIO'] || r['HORARIO'] || null;
  let horStr = 'NULL';
  if (horario instanceof Date) horStr = `'${horario.toTimeString().slice(0,5)}'`;
  else if (horario) horStr = esc(String(horario).slice(0,5));
  return `  (${dataStr}, ${horStr}, ${esc(r['LOCAL'])}, ${esc(r['ATIVIDADE'])}, ${esc(r['RESPONSÁVEL'] || r['RESPONSAVEL'])}, ${esc(r['APOIO'])}, ${esc(r['MATERIAL NECESSÁRIO'])}, ${esc(r['OBSERVAÇÕES'] || r['OBSERVACOES'])}, 2)`;
});
if (evInserts2.length > 0) {
  sql.push('\nINSERT INTO eventos (data, horario, local, atividade, responsavel, apoio, material, observacoes, semestre) VALUES');
  sql.push(evInserts2.join(',\n'));
  sql.push('ON CONFLICT DO NOTHING;');
}

const saida = sql.join('\n');
writeFileSync('supabase/migrations/002_seed.sql', saida, 'utf8');
console.log('\n✅ Seed gerado! Linhas:', saida.split('\n').length);
console.log('✅ Desbravadores:', dbvInserts.length);
console.log('✅ Documentos:', docInserts.length);
console.log('✅ Classes:', classInserts.length);
console.log('✅ Especialidades:', espInserts.length);
console.log('✅ Eventos:', evInserts.length + evInserts2.length);
