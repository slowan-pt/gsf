import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getDB } from '../../src/lib/database';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { usePermissoes } from '../../src/lib/permissoes';

interface Mensagem {
  id: string;
  titulo: string;
  corpo: string;
  enviado_por: string | null;
  created_at: string | null;
}

export default function MensagensScreen() {
  const usuario = useAuthStore((s) => s.usuario);
  const permissoes = usePermissoes();
  const isAdmin = permissoes.pode('gerenciar_membros');
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [lidos, setLidos] = useState<Set<string>>(new Set());

  useFocusEffect(useCallback(() => { carregar(); }, []));

  async function carregar() {
    const userId = usuario?.id ?? null;

    if (Platform.OS === 'web') {
      const [msgsRes, lidosRes] = await Promise.all([
        supabase.from('mensagens_clube').select('id,titulo,corpo,enviado_por,created_at').order('created_at', { ascending: false }).limit(80),
        userId
          ? supabase.from('mensagens_clube_lidos').select('mensagem_id').eq('usuario_id', userId)
          : Promise.resolve({ data: [] as { mensagem_id: string }[] }),
      ]);
      setMensagens((msgsRes.data ?? []) as Mensagem[]);
      setLidos(new Set(((lidosRes as any).data ?? []).map((r: any) => String(r.mensagem_id))));
      return;
    }

    // Native: SQLite para as mensagens, Supabase para os lidos
    const db = await getDB();
    const rows = await db.getAllAsync<Mensagem>(
      'SELECT id, titulo, corpo, enviado_por, created_at FROM mensagens_clube ORDER BY created_at DESC LIMIT 80'
    );
    setMensagens(rows);

    if (userId) {
      try {
        const { data: l } = await supabase
          .from('mensagens_clube_lidos')
          .select('mensagem_id')
          .eq('usuario_id', userId);
        setLidos(new Set((l ?? []).map((r: any) => String(r.mensagem_id))));
      } catch { /* silently ignore — lidos is best-effort */ }
    }
  }

  async function marcarLido(id: string) {
    if (!usuario?.id) return;
    setLidos((prev) => { const s = new Set(prev); s.add(id); return s; });
    await supabase
      .from('mensagens_clube_lidos')
      .upsert({ mensagem_id: id, usuario_id: usuario.id }, { onConflict: 'mensagem_id,usuario_id' })
      .catch(() => {});
  }

  async function marcarNaoLido(id: string) {
    if (!usuario?.id) return;
    setLidos((prev) => { const s = new Set(prev); s.delete(id); return s; });
    await supabase
      .from('mensagens_clube_lidos')
      .delete()
      .eq('mensagem_id', id)
      .eq('usuario_id', usuario.id)
      .catch(() => {});
  }

  async function marcarTodosLidos() {
    for (const m of mensagens) {
      if (!lidos.has(m.id)) await marcarLido(m.id);
    }
  }

  async function excluirAviso(m: Mensagem) {
    const executar = async () => {
      const { error } = await supabase.from('mensagens_clube').delete().eq('id', m.id);
      if (error) { Alert.alert('Erro', error.message); return; }
      setMensagens((prev) => prev.filter((x) => x.id !== m.id));
      setLidos((prev) => { const s = new Set(prev); s.delete(m.id); return s; });
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Excluir o aviso "${m.titulo}"?\n\nEsta ação remove o aviso para todos os usuários.`)) {
        await executar();
      }
      return;
    }

    Alert.alert(
      'Excluir aviso',
      `"${m.titulo}" será removido para todos os usuários. Deseja continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => void executar() },
      ]
    );
  }

  function abrirMenu(m: Mensagem) {
    const ehLido = lidos.has(m.id);

    if (Platform.OS === 'web') {
      const linhas = [
        `${m.titulo}`,
        '',
        `1 - ${ehLido ? 'Marcar como não lido' : 'Marcar como lido'}`,
        ...(isAdmin ? ['2 - Excluir aviso'] : []),
        '',
        'Cancele para fechar',
      ];
      const opcao = window.prompt(linhas.join('\n'));
      if (opcao === '1') {
        if (ehLido) void marcarNaoLido(m.id); else void marcarLido(m.id);
      }
      if (opcao === '2' && isAdmin) void excluirAviso(m);
      return;
    }

    const botoes: Array<{ text: string; style?: 'destructive' | 'cancel' | 'default'; onPress?: () => void }> = [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: ehLido ? 'Marcar como não lido' : 'Marcar como lido',
        onPress: () => { if (ehLido) void marcarNaoLido(m.id); else void marcarLido(m.id); },
      },
    ];
    if (isAdmin) {
      botoes.push({
        text: 'Excluir aviso',
        style: 'destructive',
        onPress: () => void excluirAviso(m),
      });
    }

    Alert.alert(m.titulo, 'O que deseja fazer?', botoes);
  }

  if (!usuario) return null;

  const temNaoLidos = mensagens.some((m) => !lidos.has(m.id));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>🔔 Avisos</Text>
          <Text style={styles.subtitulo}>Mensagens enviadas pela diretoria</Text>
        </View>
        {temNaoLidos && (
          <TouchableOpacity style={styles.marcarTodosBtn} onPress={marcarTodosLidos}>
            <Ionicons name="checkmark-done-outline" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.lista} contentContainerStyle={{ paddingBottom: 28 }}>
        {mensagens.length === 0 && (
          <View style={styles.vazioBox}>
            <Ionicons name="notifications-off-outline" size={46} color="#b0bec5" />
            <Text style={styles.vazio}>Nenhum aviso recebido ainda.</Text>
          </View>
        )}

        {mensagens.map((m) => {
          const ehLido = lidos.has(m.id);
          let data = '';
          try {
            data = m.created_at ? format(new Date(m.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '';
          } catch {}

          return (
            <TouchableOpacity
              key={m.id}
              style={[styles.card, ehLido && styles.cardLido]}
              activeOpacity={0.85}
              onPress={() => { if (!ehLido) void marcarLido(m.id); }}
              onLongPress={() => abrirMenu(m)}
            >
              <View style={[styles.iconBox, ehLido && styles.iconBoxLido]}>
                <Ionicons name="megaphone" size={22} color={ehLido ? '#90a4ae' : '#1a3a5c'} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.tituloRow}>
                  {!ehLido && <View style={styles.dotNaoLido} />}
                  <Text style={[styles.cardTitulo, ehLido && styles.cardTituloLido]} numberOfLines={2}>
                    {m.titulo}
                  </Text>
                </View>
                {data ? <Text style={styles.data}>{data}</Text> : null}
                <Text style={styles.corpo}>{m.corpo}</Text>
                {m.enviado_por ? <Text style={styles.enviado}>Enviado por {m.enviado_por}</Text> : null}
              </View>
              <TouchableOpacity style={styles.menuBtn} onPress={() => abrirMenu(m)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="ellipsis-vertical" size={16} color="#aaa" />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#f0f4f8' },
  header:           { backgroundColor: '#1a3a5c', paddingTop: 52, paddingHorizontal: 20, paddingBottom: 22, flexDirection: 'row', alignItems: 'center', gap: 14 },
  backBtn:          { padding: 6, marginLeft: -6 },
  titulo:           { color: '#fff', fontSize: 24, fontWeight: '900' },
  subtitulo:        { color: '#a8c8e8', fontSize: 13, marginTop: 4 },
  marcarTodosBtn:   { padding: 8, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20 },
  lista:            { flex: 1, padding: 16 },
  vazioBox:         { alignItems: 'center', marginTop: 80, gap: 10 },
  vazio:            { color: '#78909c', fontSize: 14 },
  card:             { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, flexDirection: 'row', gap: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  cardLido:         { backgroundColor: '#f5f7fa', elevation: 1 },
  iconBox:          { width: 42, height: 42, borderRadius: 12, backgroundColor: '#e8f0fe', alignItems: 'center', justifyContent: 'center' },
  iconBoxLido:      { backgroundColor: '#f0f0f0' },
  tituloRow:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dotNaoLido:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1a3a5c', flexShrink: 0 },
  cardTitulo:       { color: '#1a3a5c', fontSize: 15, fontWeight: '900', flex: 1 },
  cardTituloLido:   { color: '#90a4ae', fontWeight: '600' },
  data:             { color: '#78909c', fontSize: 11, marginTop: 3 },
  corpo:            { color: '#333', fontSize: 14, lineHeight: 20, marginTop: 8 },
  enviado:          { color: '#777', fontSize: 11, marginTop: 10, fontStyle: 'italic' },
  menuBtn:          { alignSelf: 'flex-start', paddingTop: 2 },
});
