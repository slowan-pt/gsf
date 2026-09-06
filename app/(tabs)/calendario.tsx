import { useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { getDB } from '../../src/lib/database';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { enviarParaTodos } from '../../src/lib/notifications';
import { DateField } from '../../src/components/DateField';
import { getClubeAtivoId } from '../../src/lib/contextoAtual';
import { useContextoStore } from '../../src/stores/contextoStore';
import { usePermissoes } from '../../src/lib/permissoes';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Evento } from '../../src/types';
import { useAparenciaStore } from '../../src/stores/aparenciaStore';
import { avisar, confirmar } from '../../src/stores/avisoStore';

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

function anoDaData(data?: string | null) {
  const normalizada = normalizarDataEvento(data);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(normalizada);
  return match ? Number(match[1]) : null;
}

function diaDaData(data?: string | null) {
  const normalizada = normalizarDataEvento(data);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(normalizada);
  return match ? Number(match[3]) : null;
}

function dataParaOrdenacao(data?: string | null) {
  const normalizada = normalizarDataEvento(data);
  return normalizada || String(data ?? '');
}

function ehFolga(evento: Evento) {
  return String(evento.atividade ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .includes('folga');
}

const ANO_AGENDA = 2026;
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function dataDoDia(mes: number, dia: number) {
  return `${ANO_AGENDA}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export default function CalendarioScreen() {
  const corCabecalho = useAparenciaStore((s) => s.corCabecalho);
  const usuario  = useAuthStore((s) => s.usuario);
  const contextoAtivo = useContextoStore((s) => s.contextoAtivo);
  const permissoes = usePermissoes();
  const isAdmin = permissoes.pode('gerenciar_agenda');

  const [eventos,   setEventos]   = useState<Evento[]>([]);
  const [eventosAno, setEventosAno] = useState<Evento[]>([]);
  const [mesAtual,  setMesAtual]  = useState(new Date().getMonth() + 1);
  // A faixa de meses sempre abria rolada em Jan, escondendo o mês atual lá no
  // fim — rola pra ele assim que o layout dos chips é medido, uma vez só.
  const mesesScrollRef = useRef<ScrollView>(null);
  const scrollParaMesFeitoRef = useRef(false);
  const [modal,     setModal]     = useState(false);
  const [editId,    setEditId]    = useState<number | null>(null);
  const [form,      setForm]      = useState<FormEvento>(FORM_VAZIO);
  const [salvando,  setSalvando]  = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erroAgenda, setErroAgenda] = useState('');
  const [detalhe,   setDetalhe]   = useState<Evento | null>(null);
  const hojeISO = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  useFocusEffect(useCallback(() => { carregarEventos(); }, [mesAtual]));

  const contagemPorMes = useMemo(() => {
    return eventosAno.reduce<Record<number, number>>((acc, evento) => {
      const mes = mesDaData(evento.data);
      const ano = anoDaData(evento.data);
      if (mes && ano === ANO_AGENDA) acc[mes] = (acc[mes] ?? 0) + 1;
      return acc;
    }, {});
  }, [eventosAno]);

  const eventosPorDia = useMemo(() => {
    return eventos.reduce<Record<number, Evento[]>>((acc, evento) => {
      const dia = diaDaData(evento.data);
      if (!dia) return acc;
      if (!acc[dia]) acc[dia] = [];
      acc[dia].push(evento);
      return acc;
    }, {});
  }, [eventos]);

  const diasCalendario = useMemo(() => {
    const primeiroDiaSemana = new Date(ANO_AGENDA, mesAtual - 1, 1).getDay();
    const totalDias = new Date(ANO_AGENDA, mesAtual, 0).getDate();
    const dias: Array<number | null> = [];
    for (let i = 0; i < primeiroDiaSemana; i++) dias.push(null);
    for (let d = 1; d <= totalDias; d++) dias.push(d);
    while (dias.length % 7 !== 0) dias.push(null);
    return dias;
  }, [mesAtual]);

  async function salvarEventosNoCacheLocal(eventosParaCache: Evento[]) {
    if (Platform.OS === 'web') return;

    const db = await getDB();
    for (const e of eventosParaCache) {
      try {
        await db.runAsync(
          `INSERT OR REPLACE INTO eventos (id, data, horario, local, atividade, responsavel, apoio, material, observacoes, semestre)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [
            e.id,
            e.data,
            e.horario ?? null,
            e.local ?? null,
            e.atividade,
            e.responsavel ?? null,
            (e as any).apoio ?? null,
            (e as any).material ?? null,
            e.observacoes ?? null,
            (e as any).semestre ?? 1,
          ]
        );
      } catch {
        // Cache local é melhor-esforço. A agenda já foi carregada direto do Supabase.
      }
    }
  }

  async function sincronizarEventosSupabase(): Promise<Evento[]> {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Tempo limite ao buscar agenda no Supabase.')), 10000);
    });
    const { data, error } = await Promise.race([
      supabase.from('eventos').select('*').eq('clube_id', getClubeAtivoId()).order('data'),
      timeout,
    ]) as any;

    if (error) throw error;
    if (!data) return [];

    const normalizados = data.map((e: any) => ({ ...e, data: normalizarDataEvento(e.data) })) as Evento[];
    void salvarEventosNoCacheLocal(normalizados);
    return normalizados;
  }

  async function carregarEventos() {
    setCarregando(true);
    setErroAgenda('');

    try {
      const locais = Platform.OS === 'web'
        ? []
        : await getDB()
            .then((db) => db.getAllAsync<Evento>('SELECT * FROM eventos ORDER BY data ASC, horario ASC'))
            .catch(() => []);
      const remotos = await sincronizarEventosSupabase().catch((e) => {
        if (locais.length > 0) return [];
        throw e;
      });
      const fonte = remotos.length > 0 ? remotos : locais;
      const normalizados = fonte
        .map((e) => ({ ...e, data: normalizarDataEvento(e.data) }))
        .sort((a, b) => `${dataParaOrdenacao(a.data)} ${a.horario ?? ''}`.localeCompare(`${dataParaOrdenacao(b.data)} ${b.horario ?? ''}`));
      const lista = normalizados.filter((e) => mesDaData(e.data) === mesAtual && anoDaData(e.data) === ANO_AGENDA);

      setEventosAno(normalizados);
      setEventos(lista);
      if (remotos.length === 0 && locais.length > 0) {
        setErroAgenda('');
      }
    } catch (e: any) {
      setErroAgenda(e?.message ?? 'Não foi possível carregar a agenda.');
      setEventos([]);
    } finally {
      setCarregando(false);
    }
  }

  function abrirCriar(dataSelecionada = '') {
    setEditId(null);
    setForm({ ...FORM_VAZIO, data: dataSelecionada });
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
    if (!form.atividade.trim()) { avisar('Informe a atividade.', 'info', 'Atenção'); return; }
    if (!form.data.trim())      { avisar('Informe a data (AAAA-MM-DD).', 'info', 'Atenção'); return; }
    setSalvando(true);
    try {
      const ehNovo = !editId;
      const payload = {
        clube_id: getClubeAtivoId(),
        atividade: form.atividade.trim(),
        data: normalizarDataEvento(form.data),
        horario: form.horario.trim() || null,
        local: form.local.trim() || null,
        responsavel: form.responsavel.trim() || null,
        observacoes: form.observacoes.trim() || null,
      };

      if (Platform.OS === 'web') {
        const resp = editId
          ? await supabase.from('eventos').update(payload).eq('clube_id', getClubeAtivoId()).eq('id', editId)
          : await supabase.from('eventos').insert(payload);
        if (resp.error) throw resp.error;
      } else {
        const db = await getDB();
        if (editId) {
          await db.runAsync(
            `UPDATE eventos SET atividade=?, data=?, horario=?, local=?, responsavel=?, observacoes=? WHERE id=?`,
            [payload.atividade, payload.data, payload.horario, payload.local,
             payload.responsavel, payload.observacoes, editId]
          );
        } else {
          await db.runAsync(
            `INSERT INTO eventos (atividade, data, horario, local, responsavel, observacoes) VALUES (?,?,?,?,?,?)`,
            [payload.atividade, payload.data, payload.horario, payload.local,
             payload.responsavel, payload.observacoes]
          );
        }
      }

      // Notificação push
      const dataFmt = payload.data.length === 10
        ? format(new Date(payload.data + 'T12:00:00'), "dd/MM", { locale: ptBR })
        : payload.data;
      enviarParaTodos(
        ehNovo ? '📅 Novo evento na agenda' : '📅 Evento atualizado',
        `${payload.atividade}${payload.data ? ` — ${dataFmt}` : ''}${payload.local ? ` · ${payload.local}` : ''}`,
        { tela: 'calendario' }
      ).catch(() => {});

      setModal(false);
      await carregarEventos();
    } catch (e: any) {
      avisar(e.message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExcluir(e: Evento) {
    const ok = await confirmar('Excluir evento', `Remover "${e.atividade}"?`, 'Excluir');
    if (!ok) return;
    if (Platform.OS === 'web') {
      const { error } = await supabase
        .from('eventos')
        .delete()
        .eq('clube_id', getClubeAtivoId())
        .eq('id', e.id);
      if (error) {
        avisar(error.message, 'erro');
        return;
      }
    } else {
      const db = await getDB();
      await db.runAsync('DELETE FROM eventos WHERE id = ?', [e.id]);
    }
    await carregarEventos();
  }

  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: corCabecalho, paddingTop: 48, paddingBottom: 18 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.titulo}>📅 Agenda {ANO_AGENDA}</Text>
          {isAdmin && (
            <TouchableOpacity style={styles.addBtn} onPress={() => abrirCriar()}>
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
        <ScrollView ref={mesesScrollRef} horizontal showsHorizontalScrollIndicator={false}>
          {meses.map((m, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.mesChip, mesAtual === i + 1 && styles.mesChipAtivo]}
              onPress={() => setMesAtual(i + 1)}
              onLayout={(ev) => {
                if (i + 1 === mesAtual && !scrollParaMesFeitoRef.current) {
                  scrollParaMesFeitoRef.current = true;
                  const x = ev.nativeEvent.layout.x;
                  mesesScrollRef.current?.scrollTo({ x: Math.max(0, x - 12), animated: false });
                }
              }}
            >
              <Text style={[styles.mesText, mesAtual === i + 1 && styles.mesTextAtivo]}>
                {m}{contagemPorMes[i + 1] ? ` (${contagemPorMes[i + 1]})` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.lista}>
        <View style={styles.calendarioCard}>
          <View style={styles.semanaHeader}>
            {DIAS_SEMANA.map((dia) => (
              <Text key={dia} style={styles.semanaText}>{dia}</Text>
            ))}
          </View>
          <View style={styles.grade}>
            {diasCalendario.map((dia, index) => {
              const eventosDoDia = dia ? eventosPorDia[dia] ?? [] : [];
              const temFolga = eventosDoDia.some(ehFolga);
              const dataSelecionada = dia ? dataDoDia(mesAtual, dia) : '';
              const ehHoje = dataSelecionada === hojeISO;
              return (
                <TouchableOpacity
                  key={`${dia ?? 'vazio'}-${index}`}
                  style={[styles.diaCelula, ehHoje && styles.diaHoje, !dia && styles.diaVazio]}
                  activeOpacity={dia && isAdmin ? 0.78 : 1}
                  disabled={!dia || !isAdmin}
                  onPress={() => abrirCriar(dataSelecionada)}
                >
                  {dia ? (
                    <>
                      <View style={styles.diaTopo}>
                        <Text style={[
                          styles.diaNumero,
                          eventosDoDia.length > 0 && styles.diaNumeroComEvento,
                          ehHoje && styles.diaNumeroHoje,
                        ]}>{dia}</Text>
                        {temFolga ? (
                          <Ionicons name="close-circle" size={15} color="#c62828" />
                        ) : eventosDoDia.length > 0 ? (
                          <Ionicons name="checkmark-circle" size={15} color="#2e7d32" />
                        ) : null}
                      </View>
                      {eventosDoDia.slice(0, 2).map((evento) => (
                        <TouchableOpacity
                          key={evento.id}
                          style={[styles.eventoPill, ehFolga(evento) && styles.eventoPillFolga]}
                          onPress={() => isAdmin ? abrirEditar(evento) : setDetalhe(evento)}
                          activeOpacity={0.75}
                        >
                          <Text style={[styles.eventoPillText, ehFolga(evento) && styles.eventoPillFolgaText]} numberOfLines={1}>
                            {evento.horario ? `${String(evento.horario).slice(0, 5)} ` : ''}{evento.atividade}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      {eventosDoDia.length > 2 && (
                        <Text style={styles.maisEventos}>+{eventosDoDia.length - 2}</Text>
                      )}
                    </>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {carregando && (
          <View style={styles.estadoCard}>
            <ActivityIndicator size="small" color="#1a3a5c" />
            <Text style={styles.estadoTexto}>Carregando agenda...</Text>
          </View>
        )}

        {!carregando && erroAgenda ? (
          <View style={styles.estadoCard}>
            <Ionicons name="warning-outline" size={22} color="#c62828" />
            <Text style={styles.estadoTexto}>Erro ao carregar agenda: {erroAgenda}</Text>
          </View>
        ) : null}

        {!carregando && !erroAgenda && eventos.length === 0 && (
          <View style={styles.estadoCard}>
            <Ionicons name="calendar-outline" size={22} color="#78909c" />
            <Text style={styles.estadoTexto}>
              {eventosAno.length > 0
                ? `Nenhum evento em ${meses[mesAtual - 1]}/${ANO_AGENDA}. Existem eventos cadastrados em outros meses.`
                : 'Nenhum evento cadastrado na agenda.'}
            </Text>
          </View>
        )}

        {eventos.length > 0 && (
          <Text style={styles.secaoTitulo}>Eventos do mês</Text>
        )}

        {eventos.map((e) => (
          <EventoCard
            key={e.id}
            evento={e}
            isAdmin={isAdmin}
            onEditar={() => abrirEditar(e)}
            onExcluir={() => confirmarExcluir(e)}
            onVerDetalhes={() => setDetalhe(e)}
          />
        ))}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Modal Detalhe (somente leitura) */}
      <Modal visible={!!detalhe} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetalhe(null)}>
        {detalhe && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setDetalhe(null)}>
                <Ionicons name="close" size={26} color="#333" />
              </TouchableOpacity>
              <Text style={styles.modalTitulo}>Detalhes do evento</Text>
              <View style={{ width: 26 }} />
            </View>
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <View style={styles.detalheCard}>
                <Text style={styles.detalheTitulo}>{detalhe.atividade}</Text>
                {detalhe.data ? (
                  <View style={styles.detalheRow}>
                    <Ionicons name="calendar-outline" size={16} color="#1a3a5c" />
                    <Text style={styles.detalheTexto}>
                      {(() => { try { return format(new Date(`${normalizarDataEvento(detalhe.data)}T12:00:00`), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR }); } catch { return detalhe.data; } })()}
                    </Text>
                  </View>
                ) : null}
                {detalhe.horario ? (
                  <View style={styles.detalheRow}>
                    <Ionicons name="time-outline" size={16} color="#1a3a5c" />
                    <Text style={styles.detalheTexto}>{String(detalhe.horario).slice(0, 5)}</Text>
                  </View>
                ) : null}
                {detalhe.local ? (
                  <View style={styles.detalheRow}>
                    <Ionicons name="location-outline" size={16} color="#1a3a5c" />
                    <Text style={styles.detalheTexto}>{detalhe.local}</Text>
                  </View>
                ) : null}
                {detalhe.responsavel ? (
                  <View style={styles.detalheRow}>
                    <Ionicons name="person-outline" size={16} color="#1a3a5c" />
                    <Text style={styles.detalheTexto}>{detalhe.responsavel}</Text>
                  </View>
                ) : null}
                {detalhe.observacoes ? (
                  <View style={[styles.detalheRow, { alignItems: 'flex-start', marginTop: 12 }]}>
                    <Ionicons name="document-text-outline" size={16} color="#1a3a5c" style={{ marginTop: 2 }} />
                    <Text style={[styles.detalheTexto, { flex: 1, lineHeight: 20 }]}>{detalhe.observacoes}</Text>
                  </View>
                ) : null}
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>

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
                  : (
                    <View style={styles.modalSalvarRow}>
                      <Ionicons name="save-outline" size={18} color="#1a3a5c" />
                      <Text style={styles.modalSalvar}>Salvar</Text>
                    </View>
                  )}
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <Campo label="Atividade *">
                <TextInput style={styles.input} value={form.atividade} onChangeText={(v) => setForm((f) => ({ ...f, atividade: v }))} placeholder="Ex: Reunião de unidade, acampamento..." autoFocus />
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
  evento, isAdmin, onEditar, onExcluir, onVerDetalhes,
}: {
  evento: Evento; isAdmin: boolean;
  onEditar: () => void; onExcluir: () => void; onVerDetalhes: () => void;
}) {
  let dataFmt = evento.data ?? '';
  try {
    if (evento.data?.includes('-') && evento.data.length === 10) {
      dataFmt = format(new Date(`${normalizarDataEvento(evento.data)}T12:00:00`), "EEE, d MMM", { locale: ptBR });
    }
  } catch {}

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={isAdmin ? 1 : 0.82}
      onPress={isAdmin ? undefined : onVerDetalhes}
    >
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
      {!isAdmin && (
        <View style={styles.acoes}>
          <View style={[styles.acaoBtn, { justifyContent: 'center' }]}>
            <Ionicons name="eye-outline" size={14} color="#607d8b" />
            <Text style={[styles.acaoBtnText, { color: '#607d8b' }]}>Ver detalhes</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f0f4f8' },
  header:         { backgroundColor: '#1a3a5c', padding: 20, paddingTop: 52 },
  headerRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 14, paddingRight: 76 },
  titulo:         { color: '#fff', fontSize: 22, fontWeight: '800', flex: 1 },
  addBtn:         { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: 6 },
  mesChip:        { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, marginRight: 8 },
  mesChipAtivo:   { backgroundColor: '#fff' },
  mesText:        { color: '#a8c8e8', fontWeight: '600' },
  mesTextAtivo:   { color: '#1a3a5c' },

  lista:          { flex: 1, padding: 16 },
  vazio:          { textAlign: 'center', color: '#999', marginTop: 40 },
  estadoCard:     { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 12, alignItems: 'center', gap: 8, elevation: 1 },
  estadoTexto:    { color: '#666', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  calendarioCard: { backgroundColor: '#fff', borderRadius: 14, padding: 10, marginBottom: 14, elevation: 2 },
  semanaHeader:   { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eef2f6', paddingBottom: 8, marginBottom: 6 },
  semanaText:     { flex: 1, textAlign: 'center', color: '#607d8b', fontSize: 11, fontWeight: '800' },
  grade:          { flexDirection: 'row', flexWrap: 'wrap' },
  diaCelula:      { width: '14.2857%', minHeight: 82, borderWidth: 0.5, borderColor: '#eef2f6', padding: 4, backgroundColor: '#fff' },
  diaHoje:        { backgroundColor: '#fff8e1', borderColor: '#f9a825', borderWidth: 1.5 },
  diaVazio:       { backgroundColor: '#f8fafc' },
  diaTopo:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  diaNumero:      { alignSelf: 'flex-start', minWidth: 22, height: 22, borderRadius: 11, textAlign: 'center', textAlignVertical: 'center', color: '#455a64', fontSize: 12, fontWeight: '800', marginBottom: 4 },
  diaNumeroComEvento: { backgroundColor: '#1a3a5c', color: '#fff' },
  diaNumeroHoje:  { backgroundColor: '#f9a825', color: '#fff' },
  eventoPill:     { backgroundColor: '#e8f0fe', borderRadius: 5, paddingHorizontal: 4, paddingVertical: 3, marginBottom: 3 },
  eventoPillText: { color: '#1a3a5c', fontSize: 9, fontWeight: '700' },
  eventoPillFolga: { backgroundColor: '#fdecea' },
  eventoPillFolgaText: { color: '#c62828' },
  maisEventos:    { color: '#f57c00', fontSize: 9, fontWeight: '800', marginTop: 1 },
  secaoTitulo:    { color: '#1a3a5c', fontSize: 15, fontWeight: '800', marginBottom: 10, marginTop: 2 },

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

  // Modal detalhe (read-only)
  detalheCard:    { backgroundColor: '#f8fafc', borderRadius: 16, padding: 20, marginBottom: 12 },
  detalheTitulo:  { fontSize: 20, fontWeight: '900', color: '#1a3a5c', marginBottom: 16, lineHeight: 26 },
  detalheRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  detalheTexto:   { fontSize: 15, color: '#333', flexShrink: 1, textTransform: 'capitalize' },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitulo:    { flex: 1, fontSize: 17, fontWeight: '800', color: '#1a3a5c', textAlign: 'center' },
  modalSalvar:    { fontSize: 16, fontWeight: '700', color: '#1a3a5c' },
  modalSalvarRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  modalScroll:    { padding: 16 },
  campoLabel:     { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', marginBottom: 6 },
  input:          { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 15, color: '#333', backgroundColor: '#fafafa' },
});
