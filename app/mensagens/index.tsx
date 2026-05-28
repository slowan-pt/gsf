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
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null);
  const [menuAberto, setMenuAberto] = useState<string | null>(null);

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

  async function excluirAviso(id: string) {
    const { error } = await supabase.from('mensagens_clube').delete().eq('id', id);
    if (error) { Alert.alert('Erro', error.message); return; }
    setMensagens((prev) => prev.filter((x) => x.id !== id));
    setLidos((prev) => { const s = new Set(prev); s.delete(id); return s; });
    setConfirmandoExclusao(null);
  }

  function abrirMenu(m: Mensagem) {
    const ehLido = lidos.has(m.id);
    // Web: inline menu via state
    if (Platform.OS === 'web') {
      setMenuAberto((prev) => prev === m.id ? null : m.id);
      setConfirmandoExclusao(null);
      return;
    }
    // Native: Alert apenas para lido/não lido (delete é pelo botão direto)
    Alert.alert(m.titulo, 'O que deseja fazer?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: ehLido ? 'Marcar como não lido' : 'Marcar como lido',
        onPress: () => { if (ehLido) void marcarNaoLido(m.id); else void marcarLido(m.id); },
      },
    ]);
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

          const confirmando = confirmandoExclusao === m.id;
          const menuEsteAberto = menuAberto === m.id;

          return (
            <TouchableOpacity
              key={m.id}
              style={[styles.card, ehLido && styles.cardLido, confirmando && styles.cardConfirmando]}
              activeOpacity={0.85}
              onPress={() => {
                if (!ehLido) void marcarLido(m.id);
                setMenuAberto(null);
                setConfirmandoExclusao(null);
              }}
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

                {/* Menu inline lido/não lido (web) */}
                {menuEsteAberto && (
                  <View style={styles.menuInline}>
                    <TouchableOpacity
                      style={styles.menuInlineBtn}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        if (ehLido) void marcarNaoLido(m.id); else void marcarLido(m.id);
                        setMenuAberto(null);
                      }}
                    >
                      <Ionicons name={ehLido ? 'eye-off-outline' : 'eye-outline'} size={13} color="#1a3a5c" />
                      <Text style={styles.menuInlineText}>
                        {ehLido ? 'Marcar como não lido' : 'Marcar como lido'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); setMenuAberto(null); }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      <Ionicons name="close" size={14} color="#aaa" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Confirmação de exclusão inline */}
                {confirmando && (
                  <View style={styles.confirmBox}>
                    <Text style={styles.confirmTexto}>Excluir para todos os usuários?</Text>
                    <View style={styles.confirmBtns}>
                      <TouchableOpacity
                        style={styles.confirmCancelar}
                        onPress={(e) => { e.stopPropagation?.(); setConfirmandoExclusao(null); }}
                      >
                        <Text style={styles.confirmCancelarText}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.confirmExcluir}
                        onPress={(e) => { e.stopPropagation?.(); void excluirAviso(m.id); }}
                      >
                        <Ionicons name="trash" size={13} color="#fff" />
                        <Text style={styles.confirmExcluirText}>Excluir</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              {/* Coluna direita: ⋮ + lixeira (admin) */}
              <View style={styles.cardAcoes}>
                <TouchableOpacity
                  style={styles.menuBtn}
                  onPress={(e) => { e.stopPropagation?.(); setConfirmandoExclusao(null); abrirMenu(m); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="ellipsis-vertical" size={16} color="#aaa" />
                </TouchableOpacity>
                {isAdmin && (
                  <TouchableOpacity
                    style={styles.trashBtn}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      setMenuAberto(null);
                      setConfirmandoExclusao(confirmando ? null : m.id);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={15} color={confirmando ? '#c62828' : '#ccc'} />
                  </TouchableOpacity>
                )}
              </View>
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
  menuBtn:          { paddingTop: 2 },
  cardAcoes:        { alignItems: 'center', gap: 8, paddingLeft: 4 },
  trashBtn:         { padding: 2 },
  cardConfirmando:  { borderWidth: 1.5, borderColor: '#ef9a9a' },

  menuInline:       { flexDirection: 'row', alignItems: 'center', marginTop: 10, backgroundColor: '#f0f4f8', borderRadius: 8, padding: 8, gap: 8 },
  menuInlineBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  menuInlineText:   { fontSize: 12, color: '#1a3a5c', fontWeight: '600' },

  confirmBox:       { marginTop: 10, backgroundColor: '#fff3f3', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#ef9a9a' },
  confirmTexto:     { fontSize: 12, color: '#c62828', fontWeight: '700', marginBottom: 8 },
  confirmBtns:      { flexDirection: 'row', gap: 8 },
  confirmCancelar:  { flex: 1, padding: 8, borderRadius: 8, backgroundColor: '#f0f4f8', alignItems: 'center' },
  confirmCancelarText: { fontSize: 13, color: '#555', fontWeight: '700' },
  confirmExcluir:   { flex: 1, padding: 8, borderRadius: 8, backgroundColor: '#c62828', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  confirmExcluirText: { fontSize: 13, color: '#fff', fontWeight: '800' },
});
