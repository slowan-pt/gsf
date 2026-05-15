import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getDB } from '../../src/lib/database';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/authStore';

interface Mensagem {
  id: number;
  titulo: string;
  corpo: string;
  enviado_por: string | null;
  created_at: string | null;
}

export default function MensagensScreen() {
  const usuario = useAuthStore((s) => s.usuario);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);

  useFocusEffect(useCallback(() => { carregar(); }, []));

  async function carregar() {
    if (Platform.OS === 'web') {
      const { data } = await supabase
        .from('mensagens_clube')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(80);
      setMensagens((data ?? []) as Mensagem[]);
      return;
    }

    const db = await getDB();
    const rows = await db.getAllAsync<Mensagem>(
      'SELECT id, titulo, corpo, enviado_por, created_at FROM mensagens_clube ORDER BY created_at DESC LIMIT 80'
    );
    setMensagens(rows);
  }

  if (!usuario) return null;

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
      </View>

      <ScrollView style={styles.lista} contentContainerStyle={{ paddingBottom: 28 }}>
        {mensagens.length === 0 && (
          <View style={styles.vazioBox}>
            <Ionicons name="notifications-off-outline" size={46} color="#b0bec5" />
            <Text style={styles.vazio}>Nenhum aviso recebido ainda.</Text>
          </View>
        )}

        {mensagens.map((m) => {
          let data = '';
          try {
            data = m.created_at ? format(new Date(m.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '';
          } catch {}
          return (
            <View key={m.id} style={styles.card}>
              <View style={styles.iconBox}>
                <Ionicons name="megaphone" size={22} color="#1a3a5c" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitulo}>{m.titulo}</Text>
                {data ? <Text style={styles.data}>{data}</Text> : null}
                <Text style={styles.corpo}>{m.corpo}</Text>
                {m.enviado_por ? <Text style={styles.enviado}>Enviado por {m.enviado_por}</Text> : null}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  header: { backgroundColor: '#1a3a5c', paddingTop: 52, paddingHorizontal: 20, paddingBottom: 22, flexDirection: 'row', alignItems: 'center', gap: 14 },
  backBtn: { padding: 6, marginLeft: -6 },
  titulo: { color: '#fff', fontSize: 24, fontWeight: '900' },
  subtitulo: { color: '#a8c8e8', fontSize: 13, marginTop: 4 },
  lista: { flex: 1, padding: 16 },
  vazioBox: { alignItems: 'center', marginTop: 80, gap: 10 },
  vazio: { color: '#78909c', fontSize: 14 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, flexDirection: 'row', gap: 12, elevation: 2 },
  iconBox: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#e8f0fe', alignItems: 'center', justifyContent: 'center' },
  cardTitulo: { color: '#1a3a5c', fontSize: 16, fontWeight: '900' },
  data: { color: '#78909c', fontSize: 11, marginTop: 2 },
  corpo: { color: '#333', fontSize: 14, lineHeight: 20, marginTop: 8 },
  enviado: { color: '#777', fontSize: 11, marginTop: 10, fontStyle: 'italic' },
});
