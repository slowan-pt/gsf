import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import { getDB } from '../../src/lib/database';
import { useAuthStore } from '../../src/stores/authStore';
import { useDBVStore } from '../../src/stores/dbvStore';
import { supabase } from '../../src/lib/supabase';
import { getClubeAtivoId, getProgramaAtivoId } from '../../src/lib/contextoAtual';
import { usePermissoes } from '../../src/lib/permissoes';
import { registrarAuditoria } from '../../src/lib/auditoria';
import { BottomNav } from '../../src/components/BottomNav';
import { useAparenciaStore } from '../../src/stores/aparenciaStore';

interface LogEntry { tipo: 'ok' | 'erro' | 'info'; msg: string }
type TipoImportacao = 'membros' | 'agenda' | 'pontuacao' | 'documentos' | 'especialidades';

/* ─── Parsers de campos ─────────────────────────────────────────── */
function simNao(v: unknown): number {
  const s = String(v ?? '').toLowerCase().trim();
  return s === 'sim' || s === '1' || s === 'true' ? 1 : 0;
}
function strOrNull(v: unknown): string | null {
  const s = String(v ?? '').trim();
  return s === '' ? null : s;
}
function numOrZero(v: unknown): number {
  return Number(v) || 0;
}
function dataISO(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
    const parsed = XLSX.SSF.parse_date_code(v);
    if (!parsed) return null;
    return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
}
function idadePorNascimento(data: string | null): number | null {
  if (!data) return null;
  const nasc = new Date(`${data}T12:00:00`);
  if (Number.isNaN(nasc.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const fezAniversario = hoje.getMonth() > nasc.getMonth() || (hoje.getMonth() === nasc.getMonth() && hoje.getDate() >= nasc.getDate());
  if (!fezAniversario) idade--;
  return idade;
}

/* ─── Importadores ─────────────────────────────────────────────── */
async function importarMembros(rows: any[][]): Promise<LogEntry[]> {
  if (Platform.OS === 'web') return importarMembrosSupabase(rows);

  const db  = await getDB();
  const log: LogEntry[] = [];
  // Cabeçalho: id_sgc | nome | data_nascimento | genero | unidade_nome | cargo | contato | email | camisa | calca | (coluna ignorada) | nome_responsavel | contato_responsavel
  // A 11ª coluna era o "vai ao Campori"; o recurso saiu do app, mas a posição
  // continua sendo pulada para as planilhas já existentes seguirem funcionando.
  const [, ...dados] = rows; // pula cabeçalho
  for (const row of dados) {
    if (!row[1]) continue; // sem nome, pula
    const [id_sgc, nome, data_nascimento, genero, unidade_nome, cargo, contato, email, camisa] = row;
    const temCalca = row.length >= 13;
    const calca = temCalca ? row[9] : null;
    const nome_responsavel = temCalca ? row[11] : row[10];
    const contato_responsavel = temCalca ? row[12] : row[11];
    try {
      // Descobre unidade_id pelo nome
      const unid = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM unidades WHERE nome = ? AND (clube_id = ? OR clube_id IS NULL)',
        [strOrNull(unidade_nome), getClubeAtivoId()]
      );
      // Calcula idade
      const nascStr = dataISO(data_nascimento);
      const idade = idadePorNascimento(nascStr) ?? 0;

      // Verifica se já existe pelo id_sgc
      const existente = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM desbravadores WHERE id_sgc = ?', [strOrNull(id_sgc)]
      );

      if (existente) {
        await db.runAsync(
          `UPDATE desbravadores SET nome=?, data_nascimento=?, idade=?, genero=?, unidade_id=?, unidade_nome=?,
           cargo=?, contato=?, email=?, camisa=?, calca=?, nome_responsavel=?, contato_responsavel=?,
           updated_at=datetime('now'), sincronizado=0 WHERE id=?`,
          [strOrNull(nome), nascStr, idade, strOrNull(genero), unid?.id ?? null, strOrNull(unidade_nome),
           strOrNull(cargo), strOrNull(contato), strOrNull(email), strOrNull(camisa), strOrNull(calca),
           strOrNull(nome_responsavel), strOrNull(contato_responsavel),
           existente.id]
        );
        log.push({ tipo: 'ok', msg: `✏️ Atualizado: ${nome}` });
      } else {
        await db.runAsync(
          `INSERT INTO desbravadores
           (id_sgc, nome, data_nascimento, idade, genero, unidade_id, unidade_nome,
            cargo, contato, email, camisa, calca, nome_responsavel, contato_responsavel)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [strOrNull(id_sgc), strOrNull(nome), nascStr, idade, strOrNull(genero), unid?.id ?? null,
           strOrNull(unidade_nome), strOrNull(cargo), strOrNull(contato), strOrNull(email),
           strOrNull(camisa), strOrNull(calca), strOrNull(nome_responsavel), strOrNull(contato_responsavel)]
        );
        log.push({ tipo: 'ok', msg: `➕ Inserido: ${nome}` });
      }
    } catch (e: any) {
      log.push({ tipo: 'erro', msg: `❌ Erro em ${nome}: ${e.message}` });
    }
  }
  return log;
}

async function importarMembrosSupabase(rows: any[][]): Promise<LogEntry[]> {
  const clubeId = getClubeAtivoId();
  const log: LogEntry[] = [];
  const [, ...dados] = rows;
  for (const row of dados) {
    if (!row[1]) continue;
    const [id_sgc, nome, data_nascimento, genero, unidade_nome, cargo, contato, email, camisa] = row;
    const temCalca = row.length >= 13;
    const calca = temCalca ? row[9] : null;
    const nome_responsavel = temCalca ? row[11] : row[10];
    const contato_responsavel = temCalca ? row[12] : row[11];
    try {
      const unidadeNome = strOrNull(unidade_nome);
      let unidadeId: number | null = null;
      if (unidadeNome && unidadeNome !== 'Diretoria') {
        const { data: unid } = await supabase
          .from('unidades')
          .select('id')
          .eq('clube_id', clubeId)
          .eq('nome', unidadeNome)
          .maybeSingle();
        unidadeId = unid?.id ?? null;
      }
      const nascStr = dataISO(data_nascimento);
      const payload = {
        id_sgc: strOrNull(id_sgc),
        clube_id: clubeId,
        nome: String(nome).trim(),
        data_nascimento: nascStr,
        idade: idadePorNascimento(nascStr),
        genero: strOrNull(genero),
        unidade_id: unidadeId,
        unidade_nome: unidadeNome,
        cargo: strOrNull(cargo),
        contato: strOrNull(contato),
        email: strOrNull(email),
        camisa: strOrNull(camisa),
        calca: strOrNull(calca),
        nome_responsavel: strOrNull(nome_responsavel),
        contato_responsavel: strOrNull(contato_responsavel),
        updated_at: new Date().toISOString(),
      };

      const idSgc = strOrNull(id_sgc);
      const existente = idSgc
        ? await supabase.from('desbravadores').select('id').eq('clube_id', clubeId).eq('id_sgc', idSgc).maybeSingle()
        : { data: null, error: null };
      if (existente.error) throw existente.error;

      if (existente.data?.id) {
        const { error } = await supabase.from('desbravadores').update(payload).eq('clube_id', clubeId).eq('id', existente.data.id);
        if (error) throw error;
        log.push({ tipo: 'ok', msg: `✏️ Atualizado: ${nome}` });
      } else {
        const { data, error } = await supabase.from('desbravadores').insert(payload).select('id').single();
        if (error) throw error;
        await supabase.from('documentos').insert({ clube_id: clubeId, dbv_id: data.id });
        await supabase.from('progresso_classes').insert({ clube_id: clubeId, dbv_id: data.id });
        log.push({ tipo: 'ok', msg: `➕ Inserido: ${nome}` });
      }
    } catch (e: any) {
      log.push({ tipo: 'erro', msg: `❌ Erro em ${nome}: ${e.message ?? e}` });
    }
  }
  return log;
}

async function importarAgenda(rows: any[][]): Promise<LogEntry[]> {
  if (Platform.OS === 'web') return importarAgendaSupabase(rows);

  const db  = await getDB();
  const log: LogEntry[] = [];
  const [, ...dados] = rows;
  for (const row of dados) {
    if (!row[3]) continue; // sem atividade, pula
    const [data, horario, local, atividade, responsavel, apoio, material, observacoes, semestre] = row;
    try {
      await db.runAsync(
        `INSERT INTO eventos (data, horario, local, atividade, responsavel, apoio, material, observacoes, semestre)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [dataISO(data) ?? strOrNull(data), strOrNull(horario), strOrNull(local), String(atividade).trim(),
         strOrNull(responsavel), strOrNull(apoio), strOrNull(material), strOrNull(observacoes),
         numOrZero(semestre) || 1]
      );
      log.push({ tipo: 'ok', msg: `📅 Evento: ${atividade} em ${data}` });
    } catch (e: any) {
      log.push({ tipo: 'erro', msg: `❌ Erro no evento ${atividade}: ${e.message}` });
    }
  }
  return log;
}

async function importarAgendaSupabase(rows: any[][]): Promise<LogEntry[]> {
  const clubeId = getClubeAtivoId();
  const log: LogEntry[] = [];
  const [, ...dados] = rows;
  for (const row of dados) {
    if (!row[3]) continue;
    const [data, horario, local, atividade, responsavel, apoio, material, observacoes, semestre] = row;
    try {
      const { error } = await supabase.from('eventos').insert({
        clube_id: clubeId,
        data: dataISO(data) ?? strOrNull(data),
        horario: strOrNull(horario),
        local: strOrNull(local),
        atividade: String(atividade).trim(),
        responsavel: strOrNull(responsavel),
        apoio: strOrNull(apoio),
        material: strOrNull(material),
        observacoes: strOrNull(observacoes),
        semestre: numOrZero(semestre) || 1,
      });
      if (error) throw error;
      log.push({ tipo: 'ok', msg: `📅 Evento: ${atividade} em ${data}` });
    } catch (e: any) {
      log.push({ tipo: 'erro', msg: `❌ Erro no evento ${atividade}: ${e.message ?? e}` });
    }
  }
  return log;
}

async function importarPontuacoes(rows: any[][], lancadoPor?: string): Promise<LogEntry[]> {
  if (Platform.OS === 'web') return importarPontuacoesSupabase(rows, lancadoPor);

  const db  = await getDB();
  const log: LogEntry[] = [];
  const [, ...dados] = rows;
  for (const row of dados) {
    if (!row[0] || !row[2]) continue; // sem id_sgc ou data
    const [id_sgc, , data, presenca, pontualidade, material, uniforme, bom_biblia, pontos_extras, observacao] = row;
    try {
      const dbv = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM desbravadores WHERE id_sgc = ?', [strOrNull(id_sgc)]
      );
      if (!dbv) {
        log.push({ tipo: 'erro', msg: `❌ SGC não encontrado: ${id_sgc}` });
        continue;
      }
      const existente = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM pontuacoes WHERE dbv_id = ? AND data = ?', [dbv.id, dataISO(data) ?? strOrNull(data)]
      );
      const vals = [simNao(presenca), simNao(pontualidade), simNao(material), simNao(uniforme),
                    numOrZero(bom_biblia), numOrZero(pontos_extras),
                    strOrNull(observacao), lancadoPor ?? null];
      if (existente) {
        await db.runAsync(
          `UPDATE pontuacoes SET presenca=?,pontualidade=?,material=?,uniforme=?,bom_biblia=?,pontos_extras=?,
           observacao=?,lancado_por=?,updated_at=datetime('now'),sincronizado=0 WHERE id=?`,
          [...vals, existente.id]
        );
      } else {
        await db.runAsync(
          `INSERT INTO pontuacoes (dbv_id,data,presenca,pontualidade,material,uniforme,bom_biblia,pontos_extras,
           classe_biblica,especialidade,pgm_especial,atividade_unidade,observacao,lancado_por)
           VALUES (?,?,?,?,?,?,?,?,0,0,0,0,?,?)`,
          [dbv.id, dataISO(data) ?? strOrNull(data), ...vals]
        );
      }
      log.push({ tipo: 'ok', msg: `✅ Pontuação: ${id_sgc} em ${data}` });
    } catch (e: any) {
      log.push({ tipo: 'erro', msg: `❌ Pontuação ${id_sgc}: ${e.message}` });
    }
  }
  return log;
}

async function importarPontuacoesSupabase(rows: any[][], lancadoPor?: string): Promise<LogEntry[]> {
  const clubeId = getClubeAtivoId();
  const log: LogEntry[] = [];
  const [, ...dados] = rows;
  for (const row of dados) {
    if (!row[0] || !row[2]) continue;
    const [id_sgc, , data, presenca, pontualidade, material, uniforme, bom_biblia, pontos_extras, observacao] = row;
    try {
      const { data: dbv, error: dbvError } = await supabase
        .from('desbravadores')
        .select('id')
        .eq('clube_id', clubeId)
        .eq('id_sgc', strOrNull(id_sgc))
        .maybeSingle();
      if (dbvError) throw dbvError;
      if (!dbv?.id) {
        log.push({ tipo: 'erro', msg: `❌ SGC não encontrado: ${id_sgc}` });
        continue;
      }
      const dataPontuacao = dataISO(data) ?? strOrNull(data);
      const payload = {
        dbv_id: dbv.id,
        clube_id: clubeId,
        data: dataPontuacao,
        presenca: !!simNao(presenca),
        pontualidade: !!simNao(pontualidade),
        material: !!simNao(material),
        uniforme: !!simNao(uniforme),
        bom_biblia: numOrZero(bom_biblia),
        pontos_extras: numOrZero(pontos_extras),
        classe_biblica: 0,
        especialidade: 0,
        pgm_especial: 0,
        atividade_unidade: 0,
        observacao: strOrNull(observacao),
        lancado_por: lancadoPor ?? null,
        updated_at: new Date().toISOString(),
      };
      const { data: existente, error: existeError } = await supabase
        .from('pontuacoes')
        .select('id')
        .eq('clube_id', clubeId)
        .eq('dbv_id', dbv.id)
        .eq('data', dataPontuacao)
        .maybeSingle();
      if (existeError) throw existeError;
      const result = existente?.id
        ? await supabase.from('pontuacoes').update(payload).eq('clube_id', clubeId).eq('id', existente.id)
        : await supabase.from('pontuacoes').insert(payload);
      if (result.error) throw result.error;
      log.push({ tipo: 'ok', msg: `✅ Pontuação: ${id_sgc} em ${dataPontuacao}` });
    } catch (e: any) {
      log.push({ tipo: 'erro', msg: `❌ Pontuação ${id_sgc}: ${e.message ?? e}` });
    }
  }
  return log;
}

async function lerWorkbook(asset: DocumentPicker.DocumentPickerAsset) {
  if (Platform.OS === 'web' && (asset as any).file) {
    const buffer = await (asset as any).file.arrayBuffer();
    return XLSX.read(buffer, { type: 'array' });
  }
  const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' as any });
  return XLSX.read(base64, { type: 'base64' });
}

function tipoPorAba(nome: string): TipoImportacao | null {
  const n = nome.toLowerCase();
  if (n.includes('membro')) return 'membros';
  if (n.includes('agenda') || n.includes('evento')) return 'agenda';
  if (n.includes('pontua')) return 'pontuacao';
  if (n.includes('document')) return 'documentos';
  if (n.includes('especial')) return 'especialidades';
  return null;
}

async function criarLoteImportacao(tipo: TipoImportacao, nomeArquivo: string | null, totalLinhas: number) {
  try {
    const { data, error } = await supabase
      .from('importacoes_lote')
      .insert({
        clube_id: getClubeAtivoId(),
        programa_id: getProgramaAtivoId(),
        tipo,
        nome_arquivo: nomeArquivo,
        status: 'processando',
        total_linhas: Math.max(totalLinhas, 0),
      })
      .select('id')
      .single();
    if (error) throw error;
    return data?.id as string | null;
  } catch (e) {
    console.warn('Nao foi possivel criar lote de importacao:', e);
    return null;
  }
}

async function finalizarLoteImportacao(loteId: string | null, logs: LogEntry[]) {
  if (!loteId) return;
  const ok = logs.filter((l) => l.tipo === 'ok').length;
  const erro = logs.filter((l) => l.tipo === 'erro').length;
  try {
    await supabase
      .from('importacoes_lote')
      .update({
        status: erro > 0 ? 'erro' : 'concluido',
        linhas_ok: ok,
        linhas_erro: erro,
        resumo: { ok, erro },
        updated_at: new Date().toISOString(),
      })
      .eq('id', loteId);
  } catch (e) {
    console.warn('Nao foi possivel finalizar lote de importacao:', e);
  }
}

async function registrarItensImportacao(loteId: string | null, rows: any[][], logs: LogEntry[]) {
  if (!loteId || rows.length <= 1) return;
  const erroPorLinha = logs.filter((l) => l.tipo === 'erro').map((l) => l.msg);
  const itens = rows.slice(1).map((row, i) => ({
    lote_id: loteId,
    linha: i + 2,
    status: 'pendente',
    dados: { valores: row },
    erros: i < erroPorLinha.length ? [erroPorLinha[i]] : [],
  }));
  try {
    await supabase.from('importacoes_lote_itens').insert(itens.slice(0, 500));
  } catch (e) {
    console.warn('Nao foi possivel registrar itens do lote:', e);
  }
}

/* ─── Tela ─────────────────────────────────────────────────────── */
export default function ImportarScreen() {
  const corCabecalho = useAparenciaStore((s) => s.corCabecalho);
  const usuario  = useAuthStore((s) => s.usuario);
  const permissoes = usePermissoes();
  const isAdmin = permissoes.podeAlguma(['gerenciar_membros', 'gerenciar_agenda', 'gerenciar_pontuacao']);
  const [carregando, setCarregando] = useState(false);
  const [log,        setLog]        = useState<LogEntry[]>([]);
  const [resumo,     setResumo]     = useState<{ ok: number; erro: number } | null>(null);
  const carregarMembros = useDBVStore((s) => s.carregar);

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <View style={styles.semAcesso}>
          <Ionicons name="lock-closed" size={48} color="#ccc" />
          <Text style={styles.semAcessoText}>Acesso restrito a administradores</Text>
        </View>
        <BottomNav />
      </View>
    );
  }

  async function escolherArquivo() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets[0]) return;

      setCarregando(true);
      setLog([]);
      setResumo(null);

      const wb = await lerWorkbook(result.assets[0]);

      const todosLogs: LogEntry[] = [];

      for (const sheetName of wb.SheetNames) {
        const ws   = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
        const tipo = tipoPorAba(sheetName);

        todosLogs.push({ tipo: 'info', msg: `📄 Aba: ${sheetName} (${rows.length - 1} linha(s))` });
        const loteId = tipo ? await criarLoteImportacao(tipo, result.assets[0].name ?? null, rows.length - 1) : null;
        let logsDaAba: LogEntry[] = [];

        if (tipo === 'membros') {
          logsDaAba = await importarMembros(rows);
        } else if (tipo === 'agenda') {
          logsDaAba = await importarAgenda(rows);
        } else if (tipo === 'pontuacao') {
          logsDaAba = await importarPontuacoes(rows, usuario?.nome);
        } else {
          logsDaAba = [{ tipo: 'info', msg: `⚠️ Aba "${sheetName}" ignorada (nome não reconhecido)` }];
        }
        todosLogs.push(...logsDaAba);
        await registrarItensImportacao(loteId, rows, logsDaAba);
        await finalizarLoteImportacao(loteId, logsDaAba);
      }

      setLog(todosLogs);
      const ok   = todosLogs.filter((l) => l.tipo === 'ok').length;
      const erro = todosLogs.filter((l) => l.tipo === 'erro').length;
      setResumo({ ok, erro });
      await carregarMembros();
      await registrarAuditoria({
        acao: 'importar_excel',
        entidade: 'importacoes_lote',
        metadata: { arquivo: result.assets[0].name, ok, erro },
      });
      Alert.alert('Importação concluída', `✅ ${ok} registros importados\n${erro > 0 ? `❌ ${erro} erro(s)` : ''}`);
    } catch (e: any) {
      Alert.alert('Erro', `Não foi possível processar o arquivo.\n${e.message}`);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: corCabecalho }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.titulo}>📥 Importar do Excel</Text>
        <Text style={styles.subtitulo}>Use o template para importar membros, agenda e pontuações em lote</Text>
      </View>

      <ScrollView style={styles.corpo} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Info abas */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitulo}>Abas reconhecidas no arquivo:</Text>
          {[
            { aba: 'Membros',     desc: 'Insere ou atualiza desbravadores pelo id_sgc' },
            { aba: 'Agenda',      desc: 'Adiciona eventos ao calendário' },
            { aba: 'Pontuações',  desc: 'Lança presença e pontos por data e id_sgc' },
          ].map(({ aba, desc }) => (
            <View key={aba} style={styles.infoRow}>
              <Ionicons name="document-text-outline" size={16} color="#1a3a5c" />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoAba}>{aba}</Text>
                <Text style={styles.infoDesc}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Botão importar */}
        <TouchableOpacity style={styles.importBtn} onPress={escolherArquivo} disabled={carregando}>
          {carregando
            ? <ActivityIndicator color="#fff" />
            : <Ionicons name="cloud-upload-outline" size={24} color="#fff" />}
          <Text style={styles.importBtnText}>
            {carregando ? 'Importando...' : 'Escolher arquivo .xlsx'}
          </Text>
        </TouchableOpacity>

        {/* Resumo */}
        {resumo && (
          <View style={styles.resumoRow}>
            <View style={[styles.resumoBadge, { backgroundColor: '#e8f5e9' }]}>
              <Text style={[styles.resumoNum, { color: '#2e7d32' }]}>{resumo.ok}</Text>
              <Text style={styles.resumoLabel}>importados</Text>
            </View>
            <View style={[styles.resumoBadge, { backgroundColor: '#fce4ec' }]}>
              <Text style={[styles.resumoNum, { color: '#c62828' }]}>{resumo.erro}</Text>
              <Text style={styles.resumoLabel}>erros</Text>
            </View>
          </View>
        )}

        {/* Log */}
        {log.length > 0 && (
          <View style={styles.logCard}>
            <Text style={styles.logTitulo}>Log de importação</Text>
            {log.map((l, i) => (
              <Text
                key={i}
                style={[
                  styles.logLinha,
                  l.tipo === 'erro' && { color: '#c62828' },
                  l.tipo === 'info' && { color: '#1a3a5c', fontWeight: '700', marginTop: 8 },
                ]}
              >
                {l.msg}
              </Text>
            ))}
          </View>
        )}
      </ScrollView>
      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f0f4f8' },
  semAcesso:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  semAcessoText:{ color: '#aaa', fontSize: 15 },

  header:       { backgroundColor: '#1a3a5c', padding: 20, paddingTop: 52 },
  backBtn:      { marginBottom: 10 },
  titulo:       { color: '#fff', fontSize: 22, fontWeight: '800' },
  subtitulo:    { color: '#a8c8e8', fontSize: 13, marginTop: 4 },

  corpo:        { flex: 1 },

  infoCard:     { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, elevation: 2 },
  infoTitulo:   { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 12 },
  infoRow:      { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  infoAba:      { fontSize: 13, fontWeight: '700', color: '#1a3a5c' },
  infoDesc:     { fontSize: 12, color: '#888' },

  importBtn:    { backgroundColor: '#1a3a5c', borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 16 },
  importBtnText:{ color: '#fff', fontWeight: '800', fontSize: 16 },

  resumoRow:    { flexDirection: 'row', gap: 12, marginBottom: 16 },
  resumoBadge:  { flex: 1, borderRadius: 12, padding: 16, alignItems: 'center' },
  resumoNum:    { fontSize: 28, fontWeight: '900' },
  resumoLabel:  { fontSize: 13, color: '#555', marginTop: 2 },

  logCard:      { backgroundColor: '#fff', borderRadius: 14, padding: 14, elevation: 2 },
  logTitulo:    { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 10 },
  logLinha:     { fontSize: 12, color: '#555', marginBottom: 4, lineHeight: 18 },
});
