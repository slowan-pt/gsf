import { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { useDBVStore } from '../../src/stores/dbvStore';
import type { Desbravador } from '../../src/types';

const CORES: Record<string, string> = {
  'Amor Perfeito': '#e91e63',
  'Sempre Viva': '#4caf50',
  'Águia Dourada': '#ff9800',
  'Leões': '#2196f3',
  'Diretoria': '#9c27b0',
  'Sem Unidade': '#90a4ae',
};

function normalizarGrupo(membro: Desbravador) {
  return membro.unidade_nome || 'Sem Unidade';
}

export default function RelatoriosScreen() {
  const usuario = useAuthStore((s) => s.usuario);
  const { desbravadores, carregar } = useDBVStore();
  const [busca, setBusca] = useState('');
  const isAdmin = usuario?.perfil === 'admin_geral' || usuario?.perfil === 'admin_diretoria';

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [])
  );

  const grupos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtrados = desbravadores
      .filter((m) => {
        if (!termo) return true;
        return (
          m.nome.toLowerCase().includes(termo) ||
          String(m.unidade_nome ?? '').toLowerCase().includes(termo) ||
          String(m.cargo ?? '').toLowerCase().includes(termo) ||
          String(m.id_sgc ?? '').toLowerCase().includes(termo)
        );
      })
      .sort((a, b) =>
        normalizarGrupo(a).localeCompare(normalizarGrupo(b), 'pt-BR') ||
        a.nome.localeCompare(b.nome, 'pt-BR')
      );

    const mapa = new Map<string, Desbravador[]>();
    for (const membro of filtrados) {
      const grupo = normalizarGrupo(membro);
      if (!mapa.has(grupo)) mapa.set(grupo, []);
      mapa.get(grupo)!.push(membro);
    }
    return Array.from(mapa.entries()).map(([nome, membros]) => ({ nome, membros }));
  }, [desbravadores, busca]);

  if (!isAdmin) {
    return (
      <View style={styles.semAcesso}>
        <Ionicons name="lock-closed" size={46} color="#bbb" />
        <Text style={styles.semAcessoText}>Relatórios disponíveis apenas para a diretoria.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>📊 Relatórios</Text>
          <Text style={styles.subtitulo}>Dados dos membros agrupados por unidade</Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color="#90a4ae" />
        <TextInput
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar por nome, unidade, cargo ou SGC..."
          placeholderTextColor="#999"
          style={styles.searchInput}
        />
      </View>

      <ScrollView style={styles.lista} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.resumo}>
          <View style={styles.resumoItem}>
            <Text style={styles.resumoNum}>{desbravadores.length}</Text>
            <Text style={styles.resumoLabel}>membros</Text>
          </View>
          <View style={styles.resumoItem}>
            <Text style={styles.resumoNum}>{grupos.length}</Text>
            <Text style={styles.resumoLabel}>grupos</Text>
          </View>
        </View>

        {grupos.map((grupo) => {
          const cor = CORES[grupo.nome] ?? '#1a3a5c';
          return (
            <View key={grupo.nome} style={styles.grupoCard}>
              <View style={[styles.grupoHeader, { borderLeftColor: cor }]}>
                <View style={[styles.dot, { backgroundColor: cor }]} />
                <Text style={styles.grupoTitulo}>{grupo.nome}</Text>
                <View style={[styles.countBadge, { backgroundColor: `${cor}22` }]}>
                  <Text style={[styles.countText, { color: cor }]}>{grupo.membros.length}</Text>
                </View>
              </View>

              {grupo.membros.map((membro) => (
                <View key={membro.id} style={styles.membroRow}>
                  <View style={[styles.avatar, { backgroundColor: cor }]}>
                    <Text style={styles.avatarText}>{membro.nome[0]}</Text>
                  </View>
                  <View style={styles.membroInfo}>
                    <Text style={styles.nome}>{membro.nome}</Text>
                    <Text style={styles.meta}>
                      {membro.cargo || 'Sem cargo'}
                      {membro.id_sgc ? ` · SGC ${membro.id_sgc}` : ''}
                    </Text>
                    <Text style={styles.meta}>
                      {membro.email || 'sem e-mail'} {membro.contato ? `· ${membro.contato}` : ''}
                    </Text>
                  </View>
                  {membro.idade ? <Text style={styles.idade}>{membro.idade}a</Text> : null}
                </View>
              ))}
            </View>
          );
        })}

        {grupos.length === 0 && (
          <Text style={styles.vazio}>Nenhum membro encontrado para este filtro.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  semAcesso: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  semAcessoText: { color: '#888', fontSize: 15, textAlign: 'center' },
  header: { backgroundColor: '#1a3a5c', paddingTop: 52, paddingHorizontal: 20, paddingBottom: 22, flexDirection: 'row', alignItems: 'center', gap: 14 },
  backBtn: { padding: 6, marginLeft: -6 },
  titulo: { color: '#fff', fontSize: 24, fontWeight: '900' },
  subtitulo: { color: '#a8c8e8', fontSize: 13, marginTop: 4 },
  searchBox: { margin: 16, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, height: 54, flexDirection: 'row', alignItems: 'center', gap: 10, elevation: 2 },
  searchInput: { flex: 1, color: '#222', fontSize: 15 },
  lista: { flex: 1, paddingHorizontal: 16 },
  resumo: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  resumoItem: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', elevation: 1 },
  resumoNum: { color: '#1a3a5c', fontSize: 28, fontWeight: '900' },
  resumoLabel: { color: '#777', fontSize: 12, marginTop: 2 },
  grupoCard: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 14, overflow: 'hidden', elevation: 2 },
  grupoHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10, borderLeftWidth: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  dot: { width: 12, height: 12, borderRadius: 6 },
  grupoTitulo: { flex: 1, color: '#222', fontSize: 17, fontWeight: '800' },
  countBadge: { minWidth: 34, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  countText: { fontWeight: '900' },
  membroRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee', gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  membroInfo: { flex: 1 },
  nome: { color: '#222', fontSize: 14, fontWeight: '800' },
  meta: { color: '#777', fontSize: 11, marginTop: 2 },
  idade: { color: '#1a3a5c', fontWeight: '800', fontSize: 12 },
  vazio: { textAlign: 'center', color: '#999', marginTop: 40 },
});
