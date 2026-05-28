import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
  Linking,
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
    await supabase
      .from('whatsapp_fila')
      .update({ status: 'enviado', sent_at: new Date().toISOString() })
      .eq('id', id)
      .catch(() => {});
    setFila((prev) => prev.filter((item) => item.id !== id));
    setMarcandoEnviado(null);
  }

  async function marcarTodosEnviados() {
    const ids = fila.map((item) => item.id);
    if (ids.length === 0) return;
    const confirmar = async () => {
      await supabase
        .from('whatsapp_fila')
        .update({ status: 'enviado', sent_at: new Date().toISOString() })
        .in('id', ids)
        .catch(() => {});
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

  async function enviar() {
    if (!titulo.trim()) { Alert.alert('Atenção', 'Informe um título.'); return; }
    if (!corpo.trim())  { Alert.alert('Atenção', 'Escreva a mensagem.'); return; }

    Alert.alert(
      'Enviar mensagem',
      `Enviar "${titulo}" para TODOS os membros do clube?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar', onPress: async () => {
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
                mensagemId = result.lastInsertRowId;
                await adicionarFilaSync('mensagens_clube', 'INSERT', { id: result.lastInsertRowId, ...payload });
                supabase.from('mensagens_clube').insert(payload).then(() => {}, () => {});
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
              Alert.alert('✅ Salvo!', 'Mensagem salva e será sincronizada automaticamente.');
            } catch (e: any) {
              Alert.alert('Erro', e.message ?? 'Não foi possível salvar a mensagem.');
            } finally {
              setEnviando(false);
            }
          },
        },
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
      <View style={s.semAcesso}>
        <Ionicons name="lock-closed" size={48} color="#ccc" />
        <Text style={s.semAcessoText}>Acesso restrito à diretoria</Text>
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
                  Cria uma fila com os telefones. O envio automático depende da API oficial do WhatsApp Business.
                </Text>
              </View>
              <Ionicons name={prepararWhatsapp ? 'checkbox' : 'square-outline'} size={22} color={prepararWhatsapp ? '#fff' : '#789'} />
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
});
