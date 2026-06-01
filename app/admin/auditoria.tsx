import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { usePermissoes } from '../../src/lib/permissoes';
import { getClubeAtivoId } from '../../src/lib/contextoAtual';
import { BottomNav } from '../../src/components/BottomNav';

interface EventoAuditoria {
  id: string;
  acao: string;
  entidade: string | null;
  entidade_id: string | null;
  membro_id: number | null;
  alvo_user_id: string | null;
  ator_user_id: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

function formatarData(v: string) {
  return new Date(v).toLocaleString('pt-BR');
}

export default function AuditoriaScreen() {
  const usuario = useAuthStore((s) => s.usuario);
  const permissoes = usePermissoes();
  const [eventos, setEventos] = useState<EventoAuditoria[]>([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(false);

  const podeVer = permissoes.podeAlguma(['admin_plataforma', 'admin_clube', 'gerenciar_acessos']);

  useFocusEffect(useCallback(() => {
    carregar();
  }, []));

  async function carregar() {
    setCarregando(true);
    try {
      const query = supabase
        .from('auditoria_eventos')
        .select('id,acao,entidade,entidade_id,membro_id,alvo_user_id,ator_user_id,created_at,metadata')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!permissoes.pode('admin_plataforma')) query.eq('clube_id', getClubeAtivoId());

      const { data, error } = await query;
      if (error) throw error;
      setEventos((data ?? []) as EventoAuditoria[]);
    } finally {
      setCarregando(false);
    }
  }

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return eventos;
    return eventos.filter((e) =>
      e.acao.toLowerCase().includes(q) ||
      String(e.entidade ?? '').toLowerCase().includes(q) ||
      String(e.entidade_id ?? '').toLowerCase().includes(q) ||
      JSON.stringify(e.metadata ?? {}).toLowerCase().includes(q)
    );
  }, [eventos, busca]);

  if (!usuario) return <Redirect href="/auth/login" />;
  if (!podeVer) return <Redirect href="/" />;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerIcon}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Auditoria</Text>
          <Text style={s.headerSub}>Eventos sensíveis do sistema</Text>
        </View>
        <TouchableOpacity onPress={carregar} style={s.headerIcon}>
          <Ionicons name="refresh" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={s.searchBox}>
        <Ionicons name="search" size={18} color="#78909c" />
        <TextInput
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar ação, entidade ou detalhes..."
          placeholderTextColor="#90a4ae"
          style={s.searchInput}
        />
      </View>

      {carregando ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#1a3a5c" />
      ) : (
        <ScrollView contentContainerStyle={s.lista}>
          {filtrados.map((e) => (
            <View key={e.id} style={s.card}>
              <View style={s.cardTop}>
                <View style={s.badge}>
                  <Ionicons name="shield-checkmark" size={18} color="#1a3a5c" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.acao}>{e.acao}</Text>
                  <Text style={s.meta}>{formatarData(e.created_at)}</Text>
                </View>
              </View>
              <Text style={s.linha}>Entidade: {e.entidade ?? '-'} {e.entidade_id ? `#${e.entidade_id}` : ''}</Text>
              {e.membro_id ? <Text style={s.linha}>Membro ID: {e.membro_id}</Text> : null}
              {e.alvo_user_id ? <Text style={s.linha}>Usuário alvo: {e.alvo_user_id}</Text> : null}
              {e.metadata && Object.keys(e.metadata).length > 0 ? (
                <Text style={s.json}>{JSON.stringify(e.metadata, null, 2)}</Text>
              ) : null}
            </View>
          ))}
          {filtrados.length === 0 && <Text style={s.vazio}>Nenhum evento encontrado.</Text>}
        </ScrollView>
      )}
      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  header: { backgroundColor: '#1a3a5c', paddingTop: 52, paddingHorizontal: 20, paddingBottom: 22, flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '900' },
  headerSub: { color: '#a8c8e8', fontSize: 14, marginTop: 2 },
  searchBox: { margin: 16, backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 14, height: 54, flexDirection: 'row', alignItems: 'center', gap: 10, elevation: 1 },
  searchInput: { flex: 1, fontSize: 15, color: '#263238' },
  lista: { padding: 16, paddingTop: 0, paddingBottom: 40 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12, elevation: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  badge: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#e8f0fe', alignItems: 'center', justifyContent: 'center' },
  acao: { color: '#1a3a5c', fontWeight: '900', fontSize: 16 },
  meta: { color: '#78909c', fontSize: 12, marginTop: 2 },
  linha: { color: '#546e7a', fontSize: 13, marginTop: 4 },
  json: { marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: '#f5f7fa', color: '#455a64', fontFamily: 'monospace', fontSize: 11 },
  vazio: { textAlign: 'center', color: '#90a4ae', marginTop: 40 },
});
