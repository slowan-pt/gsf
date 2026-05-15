import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { getDB } from '../../src/lib/database';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { enviarParaTodos } from '../../src/lib/notifications';
import { DateField } from '../../src/components/DateField';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Evento } from '../../src/types';

interface FormEvento {
  atividade: string; data: string; horario: string;
  local: string; responsavel: string; observacoes: string;
}

const FORM_VAZIO: FormEvento = {
  atividade: '', data: '', horario: '', local: '', responsavel: '', observacoes: '',
};

function normalizarDataEvento(data?: string | null) {
  const s = String(data ?? '').trim();
  if (!s) return '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  return s;
}

function mesDaData(data?: string | null) {
  const normalizada = normalizarDataEvento(data);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(normalizada);
  return match ? Number(match[2]) : null;
}

function dataParaOrdenacao(data?: string | null) {
  const normalizada = normalizarDataEvento(data);
  return normalizada || String(data ?? '');
}

export default function CalendarioScreen() {
  const usuario  = useAuthStore((s) => s.usuario);
  const isAdmin  = usuario?.perfil === 'admin_geral' || usuario?.perfil === 'admin_diretoria';

  const [eventos,   setEventos]   = useState<Evento[]>([]);
  const [mesAtual,  setMesAtual]  = useState(new Date().getMonth() + 1);
  const [modal,     setModal]     = useState(false);
  const [editId,    setEditId]    = useState<number | null>(null);
  const [form,      setForm]      = useState<FormEvento>(FORM_VAZIO);
  const [salvando,  setSalvando]  = useState(false);

  useFocusEffect(useCallback(() => { carregarEventos(); }, [mesAtual]));

  useEffect(() => { carregarEventos(); }, [mesAtual]);

  async function sincronizarEventosSupabase() {
    const { data } = await supabase.from('eventos').select('*').order('data');
    if (!data) return;

    const db = await getDB();
    for (const e of data) {
      await db.runAsync(
        `INSERT OR REPLACE INTO eventos (id, data, horario, local, atividade, responsavel, apoio, material, observacoes, semestre)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          e.id,
          normalizarDataEvento(e.data),
          e.horario ?? null,
          e.local ?? null,
          e.atividade,
          e.responsavel ?? null,
          e.apoio ?? null,
          e.material ?? null,
          e.observacoes ?? null,
          e.semestre ?? 1,
        ]
      );
    }
  }

  async function carregarEventos() {
    await sincronizarEventosSupabase().catch(() => null);
    const db = await getDB();
    const todos = await db.getAllAsync<Evento>('SELECT * FROM eventos ORDER BY data ASC, horario ASC');
    const lista = todos
      .map((e) => ({ ...e, data: normalizarDataEvento(e.data) }))
      .filter((e) => mesDaData(e.data) === mesAtual)
      .sort((a, b) => `${dataParaOrdenacao(a.data)} ${a.horario ?? ''}`.localeCompare(`${dataParaOrdenacao(b.data)} ${b.horario ?? ''}`));
    setEventos(lista);
  }

  function abrirCriar() {
    setEditId(null);
    setForm(FORM_VAZIO);
    setModal(true);
  }

  function abrirEditar(e: Evento) {
    setEditId(e.id);
    setForm({
      atividade:   e.atividade ?? '',
      data:        e.data ?? '',
      horario:     e.horario ?? '',
      local:       e.local ?? '',
      responsavel: e.responsavel ?? '',
      observacoes: e.observacoes ?? '',
    });
    setModal(true);
  }

  async function salvar() {
    if (!form.atividade.trim()) { Alert.alert('Atenção', 'Informe a atividade.'); return; }
    if (!form.data.trim())      { Alert.alert('Atenção', 'Informe a data (AAAA-MM-DD).'); return; }
    setSalvando(true);
    try {
      const db = await getDB();
      const ehNovo = !editId;

      if (editId) {
        await db.runAsync(
          `UPDATE eventos SET atividade=?, data=?, horario=?, local=?, responsavel=?, observacoes=? WHERE id=?`,
          [form.atividade, form.data, form.horario || null, form.local || null,
           form.responsavel || null, form.observacoes || null, editId]
        );
      } else {
        await db.runAsync(
          `INSERT INTO eventos (atividade, data, horario, local, responsavel, observacoes) VALUES (?,?,?,?,?,?)`,
          [form.atividade, form.data, form.horario || null, form.local || null,
           form.responsavel || null, form.observacoes || null]
        );
      }

      // Notificação push
      const dataFmt = form.data.length === 10
        ? format(new Date(form.data + 'T12:00:00'), "dd/MM", { locale: ptBR })
        : form.data;
      await enviarParaTodos(
        ehNovo ? '📅 Novo evento na agenda' : '📅 Evento atualizado',
        `${form.atividade}${form.data ? ` — ${dataFmt}` : ''}${form.local ? ` · ${form.local}` : ''}`,
        { tela: 'calendario' }
      );

      setModal(false);
      await carregarEventos();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setSalvando(false);
    }
  }

  function confirmarExcluir(e: Evento) {
    Alert.alert(
      'Excluir evento',
      `Remover "${e.atividade}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir', style: 'destructive',
          onPress: async () => {
            const db = await getDB();
            await db.runAsync('DELETE FROM eventos WHERE id = ?', [e.id]);
            await carregarEventos();
          },
        },
      ]
    );
  }

  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.titulo}>📅 Agenda 2026</Text>
          {isAdmin && (
            <TouchableOpacity style={styles.addBtn} onPress={abrirCriar}>
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {meses.map((m, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.mesChip, mesAtual === i + 1 && styles.mesChipAtivo]}
              onPress={() => setMesAtual(i + 1)}
            >
              <Text style={[styles.mesText, mesAtual === i + 1 && styles.mesTextAtivo]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.lista}>
        {eventos.length === 0 && (
          <Text style={styles.vazio}>Nenhum evento neste mês.</Text>
        )}
        {eventos.map((e) => (
          <EventoCard
            key={e.id}
            evento={e}
            isAdmin={isAdmin}
            onEditar={() => abrirEditar(e)}
            onExcluir={() => confirmarExcluir(e)}
          />
        ))}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Modal CRUD */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModal(false)}>
                <Ionicons name="close" size={26} color="#333" />
              </TouchableOpacity>
              <Text style={styles.modalTitulo}>{editId ? 'Editar evento' : 'Novo evento'}</Text>
              <TouchableOpacity onPress={salvar} disabled={salvando}>
                {salvando
                  ? <ActivityIndicator size="small" color="#1a3a5c" />
                  : <Text style={styles.modalSalvar}>Salvar</Text>}
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <Campo label="Atividade *">
                <TextInput style={styles.input} value={form.atividade} onChangeText={(v) => setForm((f) => ({ ...f, atividade: v }))} placeholder="Ex: Reunião de unidade, Campori..." autoFocus />
              </Campo>
              <Campo label="Data *">
                <DateField
                  value={form.data}
                  onChange={(v) => setForm((f) => ({ ...f, data: v }))}
                  placeholder="Selecionar data"
                  minimumDate={new Date(2026, 0, 1)}
                  maximumDate={new Date(2035, 11, 31)}
                />
              </Campo>
              <Campo label="Horário">
                <TextInput style={styles.input} value={form.horario} onChangeText={(v) => setForm((f) => ({ ...f, horario: v }))} placeholder="14:00" keyboardType="numbers-and-punctuation" />
              </Campo>
              <Campo label="Local">
                <TextInput style={styles.input} value={form.local} onChangeText={(v) => setForm((f) => ({ ...f, local: v }))} placeholder="Igreja, Parque..." />
              </Campo>
              <Campo label="Responsável">
                <TextInput style={styles.input} value={form.responsavel} onChangeText={(v) => setForm((f) => ({ ...f, responsavel: v }))} placeholder="Nome do responsável" />
              </Campo>
              <Campo label="Observações">
                <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} value={form.observacoes} onChangeText={(v) => setForm((f) => ({ ...f, observacoes: v }))} placeholder="Informações adicionais..." multiline />
              </Campo>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.campoLabel}>{label}</Text>
      {children}
    </View>
  );
}

function EventoCard({
  evento, isAdmin, onEditar, onExcluir,
}: {
  evento: Evento; isAdmin: boolean;
  onEditar: () => void; onExcluir: () => void;
}) {
  let dataFmt = evento.data ?? '';
  try {
    if (evento.data?.includes('-') && evento.data.length === 10) {
      dataFmt = format(new Date(`${normalizarDataEvento(evento.data)}T12:00:00`), "EEE, d MMM", { locale: ptBR });
    }
  } catch {}

  return (
    <View style={styles.card}>
      <View style={styles.cardMain}>
        <View style={styles.dataBox}>
          <Text style={styles.dataBoxText}>{dataFmt}</Text>
          {evento.horario && <Text style={styles.horario}>{String(evento.horario).slice(0, 5)}</Text>}
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.atividade}>{evento.atividade}</Text>
          {evento.local       && <Text style={styles.detalhe}>📍 {evento.local}</Text>}
          {evento.responsavel && <Text style={styles.detalhe}>👤 {evento.responsavel}</Text>}
          {evento.observacoes && <Text style={styles.obs} numberOfLines={2}>{evento.observacoes}</Text>}
        </View>
      </View>
      {isAdmin && (
        <View style={styles.acoes}>
          <TouchableOpacity style={styles.acaoBtn} onPress={onEditar}>
            <Ionicons name="pencil" size={14} color="#1a3a5c" />
            <Text style={styles.acaoBtnText}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.acaoBtn, { borderLeftWidth: 1, borderLeftColor: '#f0f0f0' }]} onPress={onExcluir}>
            <Ionicons name="trash-outline" size={14} color="#c62828" />
            <Text style={[styles.acaoBtnText, { color: '#c62828' }]}>Excluir</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f0f4f8' },
  header:         { backgroundColor: '#1a3a5c', padding: 20, paddingTop: 52 },
  headerRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  titulo:         { color: '#fff', fontSize: 22, fontWeight: '800', flex: 1 },
  addBtn:         { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: 6 },
  mesChip:        { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, marginRight: 8 },
  mesChipAtivo:   { backgroundColor: '#fff' },
  mesText:        { color: '#a8c8e8', fontWeight: '600' },
  mesTextAtivo:   { color: '#1a3a5c' },

  lista:          { flex: 1, padding: 16 },
  vazio:          { textAlign: 'center', color: '#999', marginTop: 40 },

  card:           { backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, elevation: 2, overflow: 'hidden' },
  cardMain:       { flexDirection: 'row', padding: 14 },
  dataBox:        { width: 68, alignItems: 'center', borderRightWidth: 1, borderRightColor: '#eee', paddingRight: 12, marginRight: 12 },
  dataBoxText:    { fontSize: 12, fontWeight: '700', color: '#1a3a5c', textAlign: 'center', textTransform: 'capitalize' },
  horario:        { fontSize: 13, fontWeight: '800', color: '#333', marginTop: 4 },
  cardContent:    { flex: 1 },
  atividade:      { fontSize: 14, fontWeight: '700', color: '#222' },
  detalhe:        { fontSize: 12, color: '#666', marginTop: 3 },
  obs:            { fontSize: 11, color: '#aaa', marginTop: 4, fontStyle: 'italic' },
  acoes:          { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f5f5f5' },
  acaoBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, gap: 5 },
  acaoBtnText:    { fontSize: 12, fontWeight: '600', color: '#1a3a5c' },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitulo:    { flex: 1, fontSize: 17, fontWeight: '800', color: '#1a3a5c', textAlign: 'center' },
  modalSalvar:    { fontSize: 16, fontWeight: '700', color: '#1a3a5c' },
  modalScroll:    { padding: 16 },
  campoLabel:     { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', marginBottom: 6 },
  input:          { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 15, color: '#333', backgroundColor: '#fafafa' },
});
