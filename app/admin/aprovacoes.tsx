import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { getClubeAtivoId } from '../../src/lib/contextoAtual';
import { usePermissoes } from '../../src/lib/permissoes';
import { BottomNav } from '../../src/components/BottomNav';
import {
  carregarItensConcluidos,
  carregarItensParaAprovar,
  type ItemConcluido,
  type ItemParaAprovar,
} from '../../src/lib/aprovacoesClube';

export const PERFIS_APROVACAO = ['admin_ti', 'admin_clube', 'admin_geral', 'admin_total', 'usuario_secretaria'];

type Aba = 'aprovar' | 'concluidas';

export default function AprovacoesScreen() {
  const permissoes = usePermissoes();
  const podeVer = permissoes.temPerfil(PERFIS_APROVACAO);
  const clubeId = getClubeAtivoId();

  const [aba, setAba] = useState<Aba>('aprovar');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aAprovar, setAAprovar] = useState<ItemParaAprovar[]>([]);
  const [concluidas, setConcluidas] = useState<ItemConcluido[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'classe' | 'especialidade'>('todos');

  useFocusEffect(useCallback(() => { if (podeVer) carregar(); }, [clubeId, podeVer]));

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      const [pendentes, feitas] = await Promise.all([
        carregarItensParaAprovar(clubeId),
        carregarItensConcluidos(clubeId),
      ]);
      setAAprovar(pendentes);
      setConcluidas(feitas);
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível carregar.');
    } finally {
      setLoading(false);
    }
  }

  const listaAtual = aba === 'aprovar' ? aAprovar : concluidas;
  const listaFiltrada = useMemo(
    () => listaAtual.filter((item) => filtroTipo === 'todos' || item.tipo === filtroTipo),
    [listaAtual, filtroTipo]
  );

  if (!podeVer) return <Redirect href="/" />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.voltar}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitulo}>✅ Classes & Especialidades</Text>
          <Text style={styles.headerSub}>Visão geral do clube</Text>
        </View>
      </View>

      <View style={styles.abas}>
        <TouchableOpacity style={[styles.aba, aba === 'aprovar' && styles.abaAtiva]} onPress={() => setAba('aprovar')}>
          <Text style={[styles.abaTexto, aba === 'aprovar' && styles.abaTextoAtivo]}>A aprovar ({aAprovar.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.aba, aba === 'concluidas' && styles.abaAtiva]} onPress={() => setAba('concluidas')}>
          <Text style={[styles.abaTexto, aba === 'concluidas' && styles.abaTextoAtivo]}>Concluídas ({concluidas.length})</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filtros}>
        {([
          { id: 'todos', label: 'Todos' },
          { id: 'classe', label: 'Classes' },
          { id: 'especialidade', label: 'Especialidades' },
        ] as const).map((op) => (
          <TouchableOpacity
            key={op.id}
            style={[styles.chip, filtroTipo === op.id && styles.chipAtivo]}
            onPress={() => setFiltroTipo(op.id)}
          >
            <Text style={[styles.chipTexto, filtroTipo === op.id && styles.chipTextoAtivo]}>{op.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {loading && <ActivityIndicator size="large" color="#1a3a5c" style={{ marginTop: 40 }} />}
        {!!erro && <Text style={styles.erro}>{erro}</Text>}
        {!loading && listaFiltrada.length === 0 && (
          <Text style={styles.vazio}>
            {aba === 'aprovar' ? 'Nada aguardando aprovação por aqui.' : 'Nenhuma conclusão registrada ainda.'}
          </Text>
        )}

        {aba === 'aprovar'
          ? (listaFiltrada as ItemParaAprovar[]).map((item, i) => {
              const cor = item.tipo === 'classe' ? '#7c3aed' : '#f59e0b';
              return (
                <TouchableOpacity
                  key={`${item.dbvId}-${item.tipo}-${item.nome}-${i}`}
                  style={styles.card}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/membro/${item.dbvId}?aba=${item.tipo === 'classe' ? 'classes' : 'especs'}` as any)}
                >
                  <View style={[styles.icone, { backgroundColor: `${cor}18` }]}>
                    <Ionicons name={item.tipo === 'classe' ? 'ribbon' : 'star'} size={20} color={cor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nome}>{item.nome}</Text>
                    <Text style={styles.sub}>
                      {item.dbvNome} · {item.unidadeNome}
                      {item.necessarias > 1 ? ` · ${item.aprovadas}/${item.necessarias} avaliações` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#b8c2cc" />
                </TouchableOpacity>
              );
            })
          : (listaFiltrada as ItemConcluido[]).map((item, i) => {
              const cor = item.tipo === 'classe' ? '#7c3aed' : '#f59e0b';
              return (
                <TouchableOpacity
                  key={`${item.dbvId}-${item.tipo}-${item.nome}-${i}`}
                  style={styles.card}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/membro/${item.dbvId}?aba=${item.tipo === 'classe' ? 'classes' : 'especs'}` as any)}
                >
                  <View style={[styles.icone, { backgroundColor: `${cor}18` }]}>
                    <Ionicons name={item.tipo === 'classe' ? 'ribbon' : 'star'} size={20} color={cor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nome}>{item.nome}</Text>
                    <Text style={styles.sub}>{item.dbvNome} · {item.unidadeNome}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#b8c2cc" />
                </TouchableOpacity>
              );
            })}
        <View style={{ height: 24 }} />
      </ScrollView>

      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f5f9' },
  header: {
    backgroundColor: '#1a3a5c', paddingTop: 48, paddingBottom: 14, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  voltar: { padding: 4 },
  headerTitulo: { color: '#fff', fontSize: 19, fontWeight: '800' },
  headerSub: { color: '#c7d6e5', fontSize: 12, marginTop: 2 },
  abas: { flexDirection: 'row', backgroundColor: '#1a3a5c', paddingHorizontal: 12, paddingBottom: 10, gap: 8 },
  aba: { flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: '#2b5079', alignItems: 'center' },
  abaAtiva: { backgroundColor: '#fff' },
  abaTexto: { color: '#c7d6e5', fontSize: 12, fontWeight: '700' },
  abaTextoAtivo: { color: '#1a3a5c' },
  filtros: { flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#e4eaf1' },
  chipAtivo: { backgroundColor: '#1a3a5c' },
  chipTexto: { fontSize: 12, color: '#4a5866', fontWeight: '600' },
  chipTextoAtivo: { color: '#fff' },
  scroll: { padding: 16, paddingTop: 4 },
  erro: { color: '#c0392b', textAlign: 'center', marginVertical: 12 },
  vazio: { color: '#8a94a0', textAlign: 'center', marginTop: 40 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, elevation: 2,
  },
  icone: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  nome: { fontSize: 14, fontWeight: '700', color: '#1f2933' },
  sub: { fontSize: 11, color: '#7b8794', marginTop: 2 },
});
