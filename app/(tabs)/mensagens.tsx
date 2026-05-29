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

  const [mensagens, setMensagens]               = useState<Mensagem[]>([]);
  const [lidos, setLidos]                       = useState<Set<string>>(new Set());
  const [ocultos, setOcultos]                   = useState<Set<string>>(new Set());
  const [expandidos, setExpandidos]             = useState<Set<string>>(new Set());
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null);

  useFocusEffect(useCallback(() => { carregar(); }, []));

  async function carregar() {
    const userId = usuario?.id ?? null;

    if (Platform.OS === 'web') {
      const [msgsRes, lidosRes, ocultosRes] = await Promise.all([
        supabase
          .from('mensagens_clube')
          .select('id,titulo,corpo,enviado_por,created_at')
          .order('created_at', { ascending: false })
          .limit(80),
        userId
          ? supabase.from('mensagens_clube_lidos').select('mensagem_id').eq('usuario_id', userId)
          : Promise.resolve({ data: [] as { mensagem_id: string }[] }),
        userId
          ? supabase.from('mensagens_clube_ocultos').select('mensagem_id').eq('usuario_id', userId)
          : Promise.resolve({ data: [] as { mensagem_id: string }[] }),
      ]);
      setMensagens((msgsRes.data ?? []) as Mensagem[]);
      setLidos(new Set(((lidosRes as any).data ?? []).map((r: any) => String(r.mensagem_id))));
      setOcultos(new Set(((ocultosRes as any).data ?? []).map((r: any) => String(r.mensagem_id))));
      return;
    }

    // Native: SQLite para as mensagens, Supabase para lidos e ocultos
    const db = await getDB();
    const rows = await db.getAllAsync<Mensagem>(
      'SELECT id, titulo, corpo, enviado_por, created_at FROM mensagens_clube ORDER BY created_at DESC LIMIT 80'
    );
    setMensagens(rows);

    if (userId) {
      try {
        const [lidosData, ocultosData] = await Promise.all([
          supabase.from('mensagens_clube_lidos').select('mensagem_id').eq('usuario_id', userId),
          supabase.from('mensagens_clube_ocultos').select('mensagem_id').eq('usuario_id', userId),
        ]);
        setLidos(new Set((lidosData.data ?? []).map((r: any) => String(r.mensagem_id))));
        setOcultos(new Set((ocultosData.data ?? []).map((r: any) => String(r.mensagem_id))));
      } catch { /* best-effort */ }
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
    for (const m of visiveis) {
      if (!lidos.has(m.id)) await marcarLido(m.id);
    }
  }

  // Admin: apaga globalmente para todos
  async function excluirAviso(id: string) {
    const { error } = await supabase.from('mensagens_clube').delete().eq('id', id);
    if (error) { Alert.alert('Erro', error.message); return; }
    setMensagens((prev) => prev.filter((x) => x.id !== id));
    setLidos((prev) => { const s = new Set(prev); s.delete(id); return s; });
    setOcultos((prev) => { const s = new Set(prev); s.delete(id); return s; });
    setExpandidos((prev) => { const s = new Set(prev); s.delete(id); return s; });
    setConfirmandoExclusao(null);
  }

  // Não-admin: oculta apenas da própria visualização
  async function ocultarMensagem(id: string) {
    if (!usuario?.id) return;
    setOcultos((prev) => { const s = new Set(prev); s.add(id); return s; });
    setExpandidos((prev) => { const s = new Set(prev); s.delete(id); return s; });
    await supabase
      .from('mensagens_clube_ocultos')
      .upsert({ mensagem_id: id, usuario_id: usuario.id }, { onConflict: 'mensagem_id,usuario_id' })
      .catch(() => {});
  }

  function toggleExpandido(m: Mensagem) {
    const estaExpandido = expandidos.has(m.id);
    const ehLido = lidos.has(m.id);

    if (estaExpandido) {
      // Já expandido → recolhe e marca como não lido
      setExpandidos((prev) => { const s = new Set(prev); s.delete(m.id); return s; });
      void marcarNaoLido(m.id);
    } else {
      // Não expandido → expande e marca como lido
      setExpandidos((prev) => { const s = new Set(prev); s.add(m.id); return s; });
      if (!ehLido) void marcarLido(m.id);
    }
    setConfirmandoExclusao(null);
  }

  if (!usuario) return null;

  const visiveis = mensagens.filter((m) => !ocultos.has(m.id));
  const temNaoLidos = visiveis.some((m) => !lidos.has(m.id));

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
        {visiveis.length === 0 && (
          <View style={styles.vazioBox}>
            <Ionicons name="notifications-off-outline" size={46} color="#b0bec5" />
            <Text style={styles.vazio}>Nenhum aviso recebido ainda.</Text>
          </View>
        )}

        {visiveis.map((m) => {
          const ehLido       = lidos.has(m.id);
          const estaExpandido = expandidos.has(m.id);
          const confirmando  = confirmandoExclusao === m.id;

          let data = '';
          try {
            data = m.created_at
              ? format(new Date(m.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
              : '';
          } catch {}

          return (
            <TouchableOpacity
              key={m.id}
              style={[
                styles.card,
                ehLido && !estaExpandido && styles.cardLido,
                estaExpandido && styles.cardExpandido,
                confirmando && styles.cardConfirmando,
              ]}
              activeOpacity={0.85}
              onPress={() => toggleExpandido(m)}
            >
              {/* Ícone */}
              <View style={[styles.iconBox, ehLido && !estaExpandido && styles.iconBoxLido]}>
                <Ionicons
                  name={estaExpandido ? 'megaphone' : 'megaphone-outline'}
                  size={22}
                  color={estaExpandido ? '#1a3a5c' : ehLido ? '#90a4ae' : '#1a3a5c'}
                />
              </View>

              {/* Conteúdo */}
              <View style={{ flex: 1 }}>
                <View style={styles.tituloRow}>
                  {!ehLido && !estaExpandido && <View style={styles.dotNaoLido} />}
                  <Text
                    style={[
                      styles.cardTitulo,
                      ehLido && !estaExpandido && styles.cardTituloLido,
                      estaExpandido && styles.cardTituloExpandido,
                    ]}
                    numberOfLines={estaExpandido ? undefined : 2}
                  >
                    {m.titulo}
                  </Text>
                </View>
                {data ? <Text style={styles.data}>{data}</Text> : null}

                {/* Corpo: truncado quando fechado, completo quando expandido */}
                <Text
                  style={[styles.corpo, !estaExpandido && styles.corpoTruncado]}
                  numberOfLines={estaExpandido ? undefined : 2}
                >
                  {m.corpo}
                </Text>

                {estaExpandido && m.enviado_por ? (
                  <Text style={styles.enviado}>Enviado por {m.enviado_por}</Text>
                ) : null}

                {/* Dica de interação quando fechado */}
                {!estaExpandido && (
                  <Text style={styles.dicaToque}>Toque para abrir · toque novamente para marcar como não lido</Text>
                )}

                {/* Confirmação de exclusão global (admin) */}
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
                        <Text style={styles.confirmExcluirText}>Excluir para todos</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              {/* Lixeira (todos os usuários) */}
              <TouchableOpacity
                style={styles.trashBtn}
                onPress={(e) => {
                  e.stopPropagation?.();
                  if (isAdmin) {
                    // Admin: pede confirmação para exclusão global
                    setConfirmandoExclusao(confirmando ? null : m.id);
                  } else {
                    // Não-admin: oculta apenas da própria lista
                    void ocultarMensagem(m.id);
                  }
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name="trash-outline"
                  size={22}
                  color={confirmando ? '#c62828' : '#e53935'}
                />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: '#f0f4f8' },
  header:              { backgroundColor: '#1a3a5c', paddingTop: 52, paddingHorizontal: 20, paddingBottom: 22, flexDirection: 'row', alignItems: 'center', gap: 14 },
  backBtn:             { padding: 6, marginLeft: -6 },
  titulo:              { color: '#fff', fontSize: 24, fontWeight: '900' },
  subtitulo:           { color: '#a8c8e8', fontSize: 13, marginTop: 4 },
  marcarTodosBtn:      { padding: 8, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20 },
  lista:               { flex: 1, padding: 16 },
  vazioBox:            { alignItems: 'center', marginTop: 80, gap: 10 },
  vazio:               { color: '#78909c', fontSize: 14 },

  card:                { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, flexDirection: 'row', gap: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  cardLido:            { backgroundColor: '#e8ecf1', elevation: 0, shadowOpacity: 0 },
  cardExpandido:       { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#1a3a5c22', elevation: 3 },
  cardConfirmando:     { borderWidth: 1.5, borderColor: '#ef9a9a' },

  iconBox:             { width: 42, height: 42, borderRadius: 12, backgroundColor: '#e8f0fe', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconBoxLido:         { backgroundColor: '#d6dde5' },

  tituloRow:           { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dotNaoLido:          { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1a3a5c', flexShrink: 0 },
  cardTitulo:          { color: '#1a3a5c', fontSize: 15, fontWeight: '900', flex: 1 },
  cardTituloLido:      { color: '#78909c', fontWeight: '600' },
  cardTituloExpandido: { color: '#1a3a5c', fontWeight: '900' },

  data:                { color: '#78909c', fontSize: 11, marginTop: 3 },
  corpo:               { color: '#333', fontSize: 14, lineHeight: 20, marginTop: 8 },
  corpoTruncado:       { color: '#666' },
  enviado:             { color: '#777', fontSize: 11, marginTop: 10, fontStyle: 'italic' },
  dicaToque:           { color: '#b0bec5', fontSize: 10, marginTop: 6, fontStyle: 'italic' },

  trashBtn:            { alignSelf: 'flex-start', paddingTop: 2, padding: 4 },

  confirmBox:          { marginTop: 10, backgroundColor: '#fff3f3', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#ef9a9a' },
  confirmTexto:        { fontSize: 12, color: '#c62828', fontWeight: '700', marginBottom: 8 },
  confirmBtns:         { flexDirection: 'row', gap: 8 },
  confirmCancelar:     { flex: 1, padding: 8, borderRadius: 8, backgroundColor: '#f0f4f8', alignItems: 'center' },
  confirmCancelarText: { fontSize: 13, color: '#555', fontWeight: '700' },
  confirmExcluir:      { flex: 1, padding: 8, borderRadius: 8, backgroundColor: '#c62828', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  confirmExcluirText:  { fontSize: 13, color: '#fff', fontWeight: '800' },
});
