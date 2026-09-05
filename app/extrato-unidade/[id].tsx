import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BottomNav } from '../../src/components/BottomNav';
import { usePontuacaoStore, type ExtratoUnidadeDia } from '../../src/stores/pontuacaoStore';
import { useAparenciaStore } from '../../src/stores/aparenciaStore';

function formatarData(data: string) {
  try {
    const texto = format(parseISO(data), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  } catch {
    return data;
  }
}

function formatarPontos(valor: number) {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

export default function ExtratoUnidadeScreen() {
  const corCabecalho = useAparenciaStore((s) => s.corCabecalho);
  const { id, nome } = useLocalSearchParams<{ id: string; nome?: string }>();
  const { getExtratoUnidade } = usePontuacaoStore();
  const [dias, setDias] = useState<ExtratoUnidadeDia[]>([]);
  const [carregando, setCarregando] = useState(true);

  const unidadeId = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [id]);
  const unidadeNome = typeof nome === 'string' ? nome : 'Unidade';
  const total = dias.reduce((acc, dia) => acc + dia.subtotal, 0);

  useEffect(() => {
    carregar();
  }, [id, nome]);

  async function carregar() {
    setCarregando(true);
    try {
      const lista = await getExtratoUnidade(unidadeId, unidadeNome);
      setDias(lista);
    } catch (erro) {
      console.log('Erro ao carregar extrato da unidade', erro);
      setDias([]);
    } finally {
      setCarregando(false);
    }
  }

  function irParaPontuacao(data: string) {
    router.push({ pathname: '/(tabs)/pontuacao', params: { data } });
  }

  if (carregando) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#1a3a5c" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: corCabecalho, paddingTop: 48, paddingBottom: 18 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitulo}>Extrato da unidade</Text>
          <Text style={styles.headerNome} numberOfLines={1}>{unidadeNome}</Text>
        </View>
        <View style={styles.totalBox}>
          <Text style={styles.totalNum}>{formatarPontos(total)}</Text>
          <Text style={styles.totalLabel}>pts</Text>
        </View>
      </View>

      {dias.length === 0 ? (
        <View style={styles.vazio}>
          <Ionicons name="flag-outline" size={48} color="#c7d2de" />
          <Text style={styles.vazioText}>Nenhuma pontuação registrada para esta unidade.</Text>
        </View>
      ) : (
        <ScrollView style={styles.lista} contentContainerStyle={{ paddingBottom: 96 }}>
          {dias.map((dia) => (
            <View key={dia.data} style={styles.diaCard}>
              <TouchableOpacity style={styles.diaHeader} onPress={() => irParaPontuacao(dia.data)} activeOpacity={0.75}>
                <View style={styles.diaHeaderInfo}>
                  <Ionicons name="calendar-outline" size={15} color="#1a3a5c" />
                  <Text style={styles.diaData}>{formatarData(dia.data)}</Text>
                </View>
                <View style={styles.subtotalBadge}>
                  <Text style={styles.subtotalText}>{dia.subtotal > 0 ? '+' : ''}{formatarPontos(dia.subtotal)} pts</Text>
                </View>
              </TouchableOpacity>

              {dia.membros.length > 0 && (
                <View style={styles.bloco}>
                  <Text style={styles.blocoTitulo}>Pontuação dos membros (1,5%)</Text>
                  {dia.membros.map((m) => (
                    <TouchableOpacity key={m.dbv_id} style={styles.linha} onPress={() => router.push(`/extrato/${m.dbv_id}`)} activeOpacity={0.75}>
                      <View style={styles.linhaIcon}>
                        <Ionicons name="person-outline" size={15} color="#1a3a5c" />
                      </View>
                      <Text style={styles.linhaTexto} numberOfLines={1}>{m.nome}</Text>
                      <Text style={styles.linhaPts}>{m.total > 0 ? '+' : ''}{formatarPontos(m.total)}</Text>
                      <Ionicons name="chevron-forward" size={13} color="#b8c2cc" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {dia.diretos.length > 0 && (
                <View style={styles.bloco}>
                  <Text style={styles.blocoTitulo}>Pontuação direta da unidade</Text>
                  {dia.diretos.map((p) => (
                    <View key={p.id} style={styles.linha}>
                      <View style={styles.linhaIcon}>
                        <Ionicons name="flag-outline" size={15} color="#1a3a5c" />
                      </View>
                      <View style={styles.linhaInfo}>
                        <Text style={styles.linhaTexto}>{p.descricao}</Text>
                        {p.lancado_por ? <Text style={styles.linhaMeta}>Lançado por: {p.lancado_por}</Text> : null}
                      </View>
                      <Text style={[styles.linhaPts, p.pontos < 0 && { color: '#c62828' }]}>
                        {p.pontos > 0 ? '+' : ''}{formatarPontos(p.pontos)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}
      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: '#1a3a5c', paddingTop: 52, paddingHorizontal: 18, paddingBottom: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1 },
  headerTitulo: { color: '#a8c8e8', fontSize: 12, fontWeight: '700' },
  headerNome: { color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 2 },
  totalBox: { alignItems: 'flex-end' },
  totalNum: { color: '#FFD700', fontSize: 22, fontWeight: '900' },
  totalLabel: { color: '#a8c8e8', fontSize: 11 },
  lista: { flex: 1 },
  diaCard: { backgroundColor: '#fff', marginHorizontal: 14, marginTop: 12, borderRadius: 14, overflow: 'hidden', elevation: 2 },
  diaHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f7f9fc', borderBottomWidth: 1, borderBottomColor: '#eef2f6', padding: 12 },
  diaHeaderInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  diaData: { flex: 1, color: '#1a3a5c', fontSize: 13, fontWeight: '900' },
  subtotalBadge: { backgroundColor: '#e8f5e9', borderRadius: 18, paddingHorizontal: 10, paddingVertical: 4 },
  subtotalText: { color: '#2e7d32', fontSize: 12, fontWeight: '900' },
  bloco: { paddingHorizontal: 12, paddingTop: 10 },
  blocoTitulo: { color: '#748394', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 6 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#f2f4f7' },
  linhaIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#eef3f8', alignItems: 'center', justifyContent: 'center' },
  linhaInfo: { flex: 1 },
  linhaTexto: { flex: 1, color: '#1f2933', fontSize: 13, fontWeight: '700' },
  linhaMeta: { color: '#8a98a8', fontSize: 11, marginTop: 2 },
  linhaPts: { color: '#1a3a5c', minWidth: 48, textAlign: 'right', fontSize: 14, fontWeight: '900' },
  vazio: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 30 },
  vazioText: { color: '#9aa6b2', textAlign: 'center', fontSize: 15 },
});
