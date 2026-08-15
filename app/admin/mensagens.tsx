import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
  Linking, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { supabase } from '../../src/lib/supabase';
import { getDB } from '../../src/lib/database';
import { adicionarFilaSync } from '../../src/lib/sync';
import { enviarParaTodos } from '../../src/lib/notifications';
import { getClubeAtivoId } from '../../src/lib/contextoAtual';
import { usePermissoes } from '../../src/lib/permissoes';
import { BottomNav } from '../../src/components/BottomNav';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Mensagem {
  id: number | string;
  titulo: string;
  corpo: string;
  enviado_por: string | null;
  created_at: string;
}

interface FilaItem {
  id: string;
  destino_nome: string | null;
  destino_telefone: string;
  texto: string;
  created_at: string;
}

interface RelatorioMembro {
  id: number;
  nome: string;
  telefones: string[];        // números válidos que receberão
  motivo?: string;            // razão de não receber (para os sem número)
}

export default function MensagensScreen() {
  const usuario  = useAuthStore((s) => s.usuario);
  const permissoes = usePermissoes();
  const isAdmin = permissoes.pode('enviar_mensagens');

  const [titulo,    setTitulo]    = useState('');
  const [corpo,     setCorpo]     = useState('');
  const [enviando,  setEnviando]  = useState(false);
  const [historico, setHistorico] = useState<Mensagem[]>([]);
  const [prepararWhatsapp, setPrepararWhatsapp] = useState(false);
  const [fila, setFila] = useState<FilaItem[]>([]);
  const [marcandoEnviado, setMarcandoEnviado] = useState<string | null>(null);
  const [modalRelatorio, setModalRelatorio] = useState(false);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);
  const [receberao, setReceberao] = useState<RelatorioMembro[]>([]);
  const [naoReceberao, setNaoReceberao] = useState<RelatorioMembro[]>([]);
  const [abaRelatorio, setAbaRelatorio] = useState<'receberao' | 'nao'>('nao');

  useFocusEffect(useCallback(() => { carregarHistorico(); carregarFila(); }, []));

  async function carregarHistorico() {
    if (Platform.OS === 'web') {
      const { data } = await supabase
        .from('mensagens_clube')
        .select('*')
        .eq('clube_id', getClubeAtivoId())
        .order('created_at', { ascending: false })
        .limit(50);
      setHistorico((data ?? []) as Mensagem[]);
      return;
    }
    const db = await getDB();
    const lista = await db.getAllAsync<Mensagem>(
      'SELECT * FROM mensagens_clube ORDER BY created_at DESC LIMIT 50'
    );
    setHistorico(lista);
  }

  async function carregarFila() {
    const { data } = await supabase
      .from('whatsapp_fila')
      .select('id,destino_nome,destino_telefone,texto,created_at')
      .eq('clube_id', getClubeAtivoId())
      .eq('status', 'pendente')
      .order('created_at', { ascending: false })
      .limit(200);
    setFila((data ?? []) as FilaItem[]);
  }

  async function marcarEnviado(id: string) {
    setMarcandoEnviado(id);
    try {
      await supabase
        .from('whatsapp_fila')
        .update({ status: 'enviado', sent_at: new Date().toISOString() })
        .eq('id', id);
    } catch { /* best-effort */ }
    setFila((prev) => prev.filter((item) => item.id !== id));
    setMarcandoEnviado(null);
  }

  async function marcarTodosEnviados() {
    const ids = fila.map((item) => item.id);
    if (ids.length === 0) return;
    const confirmar = async () => {
      try {
        await supabase
          .from('whatsapp_fila')
          .update({ status: 'enviado', sent_at: new Date().toISOString() })
          .in('id', ids);
      } catch { /* best-effort */ }
      setFila([]);
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Marcar todos os ${ids.length} itens como enviados?`)) await confirmar();
      return;
    }
    Alert.alert('Marcar todos', `Marcar ${ids.length} itens como enviados?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Marcar', onPress: () => void confirmar() },
    ]);
  }

  async function abrirWhatsApp(item: FilaItem) {
    const url = `https://wa.me/${item.destino_telefone}?text=${encodeURIComponent(item.texto)}`;
    const pode = await Linking.canOpenURL(url).catch(() => false);
    if (pode || Platform.OS === 'web') {
      await Linking.openURL(url);
      await marcarEnviado(item.id);
    } else {
      Alert.alert('WhatsApp não encontrado', 'Instale o WhatsApp para abrir este link.');
    }
  }

  async function abrirRelatorio() {
    setLoadingRelatorio(true);
    setModalRelatorio(true);
    setAbaRelatorio('nao');
    try {
      const { data, error } = await supabase
        .from('desbravadores')
        .select('id, nome, contato, contato_responsavel')
        .eq('clube_id', getClubeAtivoId())
        .order('nome');
      if (error) throw error;

      const sim: RelatorioMembro[] = [];
      const nao: RelatorioMembro[] = [];

      for (const d of data ?? []) {
        const tels = [d.contato, d.contato_responsavel]
          .map((t) => telefoneLimpo(t))
          .filter((t) => t.length >= 12);
        const unicos = Array.from(new Set(tels));

        if (unicos.length > 0) {
          sim.push({ id: d.id, nome: d.nome, telefones: unicos });
        } else {
          const temContato = !!(d.contato?.trim() || d.contato_responsavel?.trim());
          nao.push({
            id: d.id,
            nome: d.nome,
            telefones: [],
            motivo: temContato ? 'Número inválido ou incompleto' : 'Sem número cadastrado',
          });
        }
      }

      setReceberao(sim);
      setNaoReceberao(nao);
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Não foi possível carregar o relatório.');
      setModalRelatorio(false);
    } finally {
      setLoadingRelatorio(false);
    }
  }

  async function enviar() {
    if (!titulo.trim()) { Alert.alert('Atenção', 'Informe um título.'); return; }
    if (!corpo.trim())  { Alert.alert('Atenção', 'Escreva a mensagem.'); return; }

    async function confirmarEnviar() {
      setEnviando(true);
      try {
        const payload = {
          clube_id: getClubeAtivoId(),
          titulo: titulo.trim(),
          corpo: corpo.trim(),
          enviado_por: usuario?.nome ?? 'Diretoria',
        };

        let mensagemId: string | number | null = null;
        if (Platform.OS === 'web') {
          const { data, error } = await supabase.from('mensagens_clube').insert(payload).select('id').single();
          if (error) throw error;
          mensagemId = data?.id ?? null;
        } else {
          const db = await getDB();
          const result = await db.runAsync(
            'INSERT INTO mensagens_clube (titulo, corpo, enviado_por) VALUES (?,?,?)',
            [payload.titulo, payload.corpo, payload.enviado_por]
          );
          const localId = result.lastInsertRowId;
          mensagemId = localId;
          try {
            // Insere direto no Supabase e reconcilia o id local com o UUID
            // real — sem isso, o registro local fica com um id numérico que
            // nunca bate com o UUID do Postgres (e "excluir para todos" falha).
            const { data, error } = await supabase.from('mensagens_clube').insert(payload).select('id').single();
            if (error) throw error;
            if (data?.id) {
              await db.runAsync('UPDATE mensagens_clube SET id = ? WHERE id = ?', [data.id, localId]);
              mensagemId = data.id;
            }
          } catch {
            // Sem internet agora — fica na fila de sincronização e será reconciliado depois.
            await adicionarFilaSync('mensagens_clube', 'INSERT', { id: localId, ...payload });
          }
        }
        enviarParaTodos(
          `📢 ${payload.titulo}`,
          payload.corpo,
          { tela: 'mensagens' }
        ).catch(() => {});
        if (prepararWhatsapp) {
          await prepararFilaWhatsApp(String(mensagemId ?? ''), payload.corpo);
        }

        setTitulo('');
        setCorpo('');
        await carregarHistorico();
        if (Platform.OS === 'web') window.alert('Mensagem salva e enviada!');
        else Alert.alert('✅ Salvo!', 'Mensagem salva e será sincronizada automaticamente.');
      } catch (e: any) {
        const msg = e.message ?? 'Não foi possível salvar a mensagem.';
        if (Platform.OS === 'web') window.alert(`Erro: ${msg}`);
        else Alert.alert('Erro', msg);
      } finally {
        setEnviando(false);
      }
    }

    // Alert.alert com múltiplos botões não funciona no React Native Web —
    // o callback do botão "Enviar" nunca dispara, então o envio na versão
    // web ficava travado na confirmação.
    if (Platform.OS === 'web') {
      if (window.confirm(`Enviar "${titulo}" para TODOS os membros do clube?`)) void confirmarEnviar();
      return;
    }
    Alert.alert(
      'Enviar mensagem',
      `Enviar "${titulo}" para TODOS os membros do clube?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Enviar', onPress: () => void confirmarEnviar() },
      ]
    );
  }

  function telefoneLimpo(v?: string | null) {
    const n = String(v ?? '').replace(/\D/g, '');
    if (!n) return '';
    if (n.startsWith('55')) return n;
    return `55${n}`;
  }

  async function prepararFilaWhatsApp(mensagemId: string, texto: string) {
    const clubeId = getClubeAtivoId();
    const mensagemUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mensagemId)
      ? mensagemId
      : null;
    const { data, error } = await supabase
      .from('desbravadores')
      .select('nome, contato, contato_responsavel')
      .eq('clube_id', clubeId);
    if (error) throw error;
    const vistos = new Set<string>();
    const linhas = [];
    for (const d of data ?? []) {
      for (const tel of [telefoneLimpo(d.contato), telefoneLimpo(d.contato_responsavel)]) {
        if (!tel || vistos.has(tel) || tel.length < 12) continue;
        vistos.add(tel);
        linhas.push({
          clube_id: clubeId,
          mensagem_id: mensagemUuid,
          destino_nome: d.nome,
          destino_telefone: tel,
          texto,
          status: 'pendente',
        });
      }
    }
    if (linhas.length === 0) return;
    const { error: filaErro } = await supabase.from('whatsapp_fila').insert(linhas);
    if (filaErro) throw filaErro;
  }

  function formatarData(d: string) {
    try { return format(new Date(d), "dd/MM HH:mm", { locale: ptBR }); } catch { return d; }
  }

  if (!isAdmin) {
    return (
      <View style={s.container}>
        <View style={s.semAcesso}>
          <Ionicons name="lock-closed" size={48} color="#ccc" />
          <Text style={s.semAcessoText}>Acesso restrito à diretoria</Text>
        </View>
        <BottomNav />
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.titulo}>📢 Mensagens para o Clube</Text>
      </View>

      {/* Modal Relatório WhatsApp */}
      <Modal visible={modalRelatorio} animationType="slide" onRequestClose={() => setModalRelatorio(false)}>
        <View style={s.relModal}>
          <View style={s.relHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.relTitulo}>Relatório de alcance</Text>
              <Text style={s.relSub}>Cobertura de WhatsApp dos membros</Text>
            </View>
            <TouchableOpacity onPress={() => setModalRelatorio(false)} style={s.relFechar}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {loadingRelatorio ? (
            <View style={s.relLoading}>
              <ActivityIndicator size="large" color="#1a3a5c" />
              <Text style={s.relLoadingText}>Carregando membros...</Text>
            </View>
          ) : (
            <>
              {/* Resumo */}
              <View style={s.relResumo}>
                <View style={[s.relResumoItem, { borderColor: '#a5d6a7' }]}>
                  <Text style={[s.relResumoNum, { color: '#2e7d32' }]}>{receberao.length}</Text>
                  <Text style={[s.relResumoLabel, { color: '#2e7d32' }]}>Receberão</Text>
                </View>
                <View style={[s.relResumoItem, { borderColor: '#ef9a9a' }]}>
                  <Text style={[s.relResumoNum, { color: '#c62828' }]}>{naoReceberao.length}</Text>
                  <Text style={[s.relResumoLabel, { color: '#c62828' }]}>Não receberão</Text>
                </View>
                <View style={[s.relResumoItem, { borderColor: '#b0bec5' }]}>
                  <Text style={[s.relResumoNum, { color: '#455a64' }]}>{receberao.length + naoReceberao.length}</Text>
                  <Text style={[s.relResumoLabel, { color: '#455a64' }]}>Total</Text>
                </View>
              </View>

              {/* Abas */}
              <View style={s.relAbas}>
                <TouchableOpacity
                  style={[s.relAba, abaRelatorio === 'nao' && s.relAbaAtiva]}
                  onPress={() => setAbaRelatorio('nao')}
                >
                  <Ionicons name="close-circle-outline" size={15} color={abaRelatorio === 'nao' ? '#c62828' : '#999'} />
                  <Text style={[s.relAbaText, abaRelatorio === 'nao' && { color: '#c62828' }]}>
                    Sem cobertura ({naoReceberao.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.relAba, abaRelatorio === 'receberao' && s.relAbaAtiva]}
                  onPress={() => setAbaRelatorio('receberao')}
                >
                  <Ionicons name="checkmark-circle-outline" size={15} color={abaRelatorio === 'receberao' ? '#2e7d32' : '#999'} />
                  <Text style={[s.relAbaText, abaRelatorio === 'receberao' && { color: '#2e7d32' }]}>
                    Com cobertura ({receberao.length})
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }}>
                {abaRelatorio === 'nao' ? (
                  naoReceberao.length === 0 ? (
                    <View style={s.relVazioBox}>
                      <Ionicons name="checkmark-circle" size={40} color="#a5d6a7" />
                      <Text style={s.relVazioText}>Todos os membros têm número cadastrado!</Text>
                    </View>
                  ) : (
                    naoReceberao.map((m) => (
                      <View key={m.id} style={s.relItemNao}>
                        <View style={s.relItemIconNao}>
                          <Ionicons name="person-outline" size={18} color="#c62828" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.relItemNome}>{m.nome}</Text>
                          <View style={s.relMotivoTag}>
                            <Ionicons name="warning-outline" size={11} color="#c62828" />
                            <Text style={s.relMotivoText}>{m.motivo}</Text>
                          </View>
                        </View>
                      </View>
                    ))
                  )
                ) : (
                  receberao.length === 0 ? (
                    <View style={s.relVazioBox}>
                      <Ionicons name="alert-circle-outline" size={40} color="#ef9a9a" />
                      <Text style={s.relVazioText}>Nenhum membro com número válido cadastrado.</Text>
                    </View>
                  ) : (
                    receberao.map((m) => (
                      <View key={m.id} style={s.relItemSim}>
                        <View style={s.relItemIconSim}>
                          <Ionicons name="person-outline" size={18} color="#2e7d32" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.relItemNome}>{m.nome}</Text>
                          {m.telefones.map((t, i) => (
                            <Text key={i} style={s.relItemTel}>
                              {t.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, '+55 ($1) $2-$3')}
                            </Text>
                          ))}
                        </View>
                        <Ionicons name="checkmark-circle" size={18} color="#a5d6a7" />
                      </View>
                    ))
                  )
                )}
              </ScrollView>
            </>
          )}
        </View>
      </Modal>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled">
          {/* Formulário de envio */}
          <View style={s.card}>
            <Text style={s.secaoTitulo}>Nova mensagem</Text>

            <Text style={s.label}>Título</Text>
            <TextInput
              style={s.input}
              value={titulo}
              onChangeText={setTitulo}
              placeholder="Ex: Reunião cancelada, Aviso importante..."
              placeholderTextColor="#aaa"
              maxLength={80}
            />

            <Text style={s.label}>Mensagem</Text>
            <TextInput
              style={[s.input, s.inputMulti]}
              value={corpo}
              onChangeText={setCorpo}
              placeholder="Escreva a mensagem completa aqui..."
              placeholderTextColor="#aaa"
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            <Text style={s.contador}>{corpo.length}/500</Text>

            <TouchableOpacity
              style={[s.whatsOpt, prepararWhatsapp && s.whatsOptAtiva]}
              onPress={() => setPrepararWhatsapp((v) => !v)}
            >
              <Ionicons name={prepararWhatsapp ? 'logo-whatsapp' : 'logo-whatsapp'} size={19} color={prepararWhatsapp ? '#fff' : '#1f7a3f'} />
              <View style={{ flex: 1 }}>
                <Text style={[s.whatsTitle, prepararWhatsapp && s.whatsTitleAtiva]}>Preparar envio por WhatsApp</Text>
                <Text style={[s.whatsSub, prepararWhatsapp && s.whatsSubAtiva]}>
                  Cria uma fila com os telefones cadastrados dos membros.
                </Text>
              </View>
              <Ionicons name={prepararWhatsapp ? 'checkbox' : 'square-outline'} size={22} color={prepararWhatsapp ? '#fff' : '#789'} />
            </TouchableOpacity>

            <TouchableOpacity style={s.relatorioBtn} onPress={abrirRelatorio}>
              <Ionicons name="bar-chart-outline" size={16} color="#1a3a5c" />
              <Text style={s.relatorioBtnText}>Relatório de alcance por WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.enviarBtn, (!titulo || !corpo || enviando) && s.enviarBtnDisabled]}
              onPress={enviar}
              disabled={!titulo || !corpo || enviando}
            >
              {enviando
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="send" size={18} color="#fff" />}
              <Text style={s.enviarText}>{enviando ? 'Enviando...' : 'Enviar para todos'}</Text>
            </TouchableOpacity>
          </View>

          {/* Fila WhatsApp */}
          {fila.length > 0 && (
            <View style={s.filaCard}>
              <View style={s.filaHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="logo-whatsapp" size={20} color="#1f7a3f" />
                  <Text style={s.filaTitulo}>Fila WhatsApp</Text>
                  <View style={s.filaBadge}><Text style={s.filaBadgeText}>{fila.length}</Text></View>
                </View>
                <TouchableOpacity onPress={marcarTodosEnviados} style={s.filaMarcarTodosBtn}>
                  <Ionicons name="checkmark-done-outline" size={16} color="#1f7a3f" />
                  <Text style={s.filaMarcarTodosText}>Marcar todos</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.filaAjuda}>
                Toque em "Enviar" para abrir o WhatsApp com a mensagem pré-preenchida. O item sai da fila automaticamente.
              </Text>
              {fila.map((item) => (
                <View key={item.id} style={s.filaItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.filaItemNome}>{item.destino_nome ?? 'Sem nome'}</Text>
                    <Text style={s.filaItemTel}>{item.destino_telefone}</Text>
                    <Text style={s.filaItemTexto} numberOfLines={2}>{item.texto}</Text>
                  </View>
                  <TouchableOpacity
                    style={s.filaEnviarBtn}
                    onPress={() => void abrirWhatsApp(item)}
                    disabled={marcandoEnviado === item.id}
                  >
                    {marcandoEnviado === item.id
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Ionicons name="logo-whatsapp" size={18} color="#fff" />}
                    <Text style={s.filaEnviarText}>Enviar</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Histórico */}
          <Text style={s.secaoTitulo2}>Histórico</Text>
          {historico.length === 0 && (
            <Text style={s.vazio}>Nenhuma mensagem enviada ainda.</Text>
          )}
          {historico.map((m) => (
            <View key={m.id} style={s.histItem}>
              <View style={s.histHeader}>
                <Text style={s.histTitulo}>{m.titulo}</Text>
                <Text style={s.histData}>{formatarData(m.created_at)}</Text>
              </View>
              <Text style={s.histCorpo}>{m.corpo}</Text>
              {m.enviado_por && (
                <Text style={s.histPor}>Enviado por: {m.enviado_por}</Text>
              )}
            </View>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#f0f4f8' },
  semAcesso:       { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  semAcessoText:   { color: '#aaa', fontSize: 15 },

  header:          { backgroundColor: '#1a3a5c', padding: 20, paddingTop: 52, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn:         { padding: 4 },
  titulo:          { color: '#fff', fontSize: 18, fontWeight: '800', flex: 1 },

  scroll:          { flex: 1 },
  card:            { backgroundColor: '#fff', margin: 16, borderRadius: 16, padding: 16, elevation: 2 },
  secaoTitulo:     { fontSize: 15, fontWeight: '800', color: '#1a3a5c', marginBottom: 14 },
  secaoTitulo2:    { fontSize: 14, fontWeight: '700', color: '#555', marginHorizontal: 16, marginBottom: 8, marginTop: 4 },

  label:           { fontSize: 11, fontWeight: '700', color: '#888', textTransform: 'uppercase', marginBottom: 6, marginTop: 10 },
  input:           { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 14, color: '#333', backgroundColor: '#fafafa' },
  inputMulti:      { minHeight: 100, textAlignVertical: 'top' },
  contador:        { fontSize: 11, color: '#bbb', textAlign: 'right', marginTop: 4 },
  whatsOpt:        { marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: '#cfe8d6', backgroundColor: '#f4fbf6', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  whatsOptAtiva:   { backgroundColor: '#1f7a3f', borderColor: '#1f7a3f' },
  whatsTitle:      { color: '#1f7a3f', fontWeight: '900', fontSize: 13 },
  whatsTitleAtiva: { color: '#fff' },
  whatsSub:        { color: '#667', fontSize: 11, marginTop: 2 },
  whatsSubAtiva:   { color: 'rgba(255,255,255,0.82)' },

  enviarBtn:       { backgroundColor: '#1a3a5c', borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 },
  enviarBtnDisabled: { backgroundColor: '#ccc' },
  enviarText:      { color: '#fff', fontWeight: '800', fontSize: 15 },

  histItem:        { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 14, elevation: 1 },
  histHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  histTitulo:      { fontSize: 14, fontWeight: '800', color: '#1a3a5c', flex: 1, marginRight: 8 },
  histData:        { fontSize: 11, color: '#aaa' },
  histCorpo:       { fontSize: 13, color: '#444', lineHeight: 20 },
  histPor:         { fontSize: 11, color: '#bbb', marginTop: 6, fontStyle: 'italic' },

  vazio:           { textAlign: 'center', color: '#aaa', marginTop: 24, fontSize: 14 },

  filaCard:           { backgroundColor: '#fff', margin: 16, marginTop: 4, borderRadius: 16, padding: 16, elevation: 2, borderWidth: 1.5, borderColor: '#cfe8d6' },
  filaHeader:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  filaTitulo:         { fontSize: 15, fontWeight: '800', color: '#1f7a3f' },
  filaBadge:          { backgroundColor: '#1f7a3f', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  filaBadgeText:      { color: '#fff', fontSize: 11, fontWeight: '800' },
  filaMarcarTodosBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6, borderRadius: 8, backgroundColor: '#f4fbf6' },
  filaMarcarTodosText:{ color: '#1f7a3f', fontSize: 12, fontWeight: '700' },
  filaAjuda:          { fontSize: 11, color: '#667', backgroundColor: '#f4fbf6', borderRadius: 8, padding: 8, marginBottom: 10, lineHeight: 16 },
  filaItem:           { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f0f4f8' },
  filaItemNome:       { fontSize: 13, fontWeight: '800', color: '#1a3a5c' },
  filaItemTel:        { fontSize: 12, color: '#667', marginTop: 1 },
  filaItemTexto:      { fontSize: 11, color: '#999', marginTop: 3, lineHeight: 15 },
  filaEnviarBtn:      { backgroundColor: '#1f7a3f', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 80, justifyContent: 'center' },
  filaEnviarText:     { color: '#fff', fontWeight: '800', fontSize: 13 },

  relatorioBtn:       { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: 10, backgroundColor: '#f0f4f8', borderWidth: 1, borderColor: '#d9e2ec' },
  relatorioBtnText:   { color: '#1a3a5c', fontSize: 13, fontWeight: '700' },

  relModal:           { flex: 1, backgroundColor: '#f0f4f8' },
  relHeader:          { backgroundColor: '#1a3a5c', paddingTop: 52, paddingHorizontal: 20, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  relTitulo:          { color: '#fff', fontSize: 20, fontWeight: '900' },
  relSub:             { color: '#a8c8e8', fontSize: 12, marginTop: 2 },
  relFechar:          { padding: 6 },
  relLoading:         { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  relLoadingText:     { color: '#667', fontSize: 14 },

  relResumo:          { flexDirection: 'row', margin: 16, gap: 10 },
  relResumoItem:      { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1.5, elevation: 1 },
  relResumoNum:       { fontSize: 28, fontWeight: '900' },
  relResumoLabel:     { fontSize: 11, fontWeight: '700', marginTop: 2 },

  relAbas:            { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, backgroundColor: '#fff', borderRadius: 12, padding: 4, elevation: 1 },
  relAba:             { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 9 },
  relAbaAtiva:        { backgroundColor: '#f0f4f8' },
  relAbaText:         { fontSize: 12, fontWeight: '700', color: '#999' },

  relVazioBox:        { alignItems: 'center', marginTop: 60, gap: 12, paddingHorizontal: 32 },
  relVazioText:       { color: '#555', fontSize: 14, textAlign: 'center', lineHeight: 20 },

  relItemNao:         { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 12, elevation: 1, borderLeftWidth: 3, borderLeftColor: '#ef9a9a' },
  relItemIconNao:     { width: 36, height: 36, borderRadius: 10, backgroundColor: '#ffebee', alignItems: 'center', justifyContent: 'center' },
  relItemSim:         { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 12, elevation: 1, borderLeftWidth: 3, borderLeftColor: '#a5d6a7' },
  relItemIconSim:     { width: 36, height: 36, borderRadius: 10, backgroundColor: '#e8f5e9', alignItems: 'center', justifyContent: 'center' },
  relItemNome:        { fontSize: 14, fontWeight: '800', color: '#1a3a5c' },
  relItemTel:         { fontSize: 12, color: '#555', marginTop: 2 },
  relMotivoTag:       { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  relMotivoText:      { fontSize: 11, color: '#c62828', fontWeight: '600' },
});
