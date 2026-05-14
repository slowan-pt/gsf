import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { supabase } from '../../src/lib/supabase';
import { getDB } from '../../src/lib/database';
import { adicionarFilaSync } from '../../src/lib/sync';
import { enviarParaTodos } from '../../src/lib/notifications';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Mensagem {
  id: number;
  titulo: string;
  corpo: string;
  enviado_por: string | null;
  created_at: string;
}

export default function MensagensScreen() {
  const usuario  = useAuthStore((s) => s.usuario);
  const isAdmin  = usuario?.perfil === 'admin_geral' || usuario?.perfil === 'admin_diretoria';

  const [titulo,    setTitulo]    = useState('');
  const [corpo,     setCorpo]     = useState('');
  const [enviando,  setEnviando]  = useState(false);
  const [historico, setHistorico] = useState<Mensagem[]>([]);

  useFocusEffect(useCallback(() => { carregarHistorico(); }, []));

  async function carregarHistorico() {
    const db = await getDB();
    const lista = await db.getAllAsync<Mensagem>(
      'SELECT * FROM mensagens_clube ORDER BY created_at DESC LIMIT 50'
    );
    setHistorico(lista);
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
                titulo: titulo.trim(),
                corpo: corpo.trim(),
                enviado_por: usuario?.nome ?? 'Diretoria',
              };

              const db = await getDB();
              const result = await db.runAsync(
                'INSERT INTO mensagens_clube (titulo, corpo, enviado_por) VALUES (?,?,?)',
                [payload.titulo, payload.corpo, payload.enviado_por]
              );
              await adicionarFilaSync('mensagens_clube', 'INSERT', { id: result.lastInsertRowId, ...payload });

              supabase.from('mensagens_clube').insert(payload).then(() => {}, () => {});
              enviarParaTodos(
                `📢 ${payload.titulo}`,
                payload.corpo,
                { tela: 'mensagens' }
              ).catch(() => {});

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
});
