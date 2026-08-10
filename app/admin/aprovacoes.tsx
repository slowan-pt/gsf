import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { getClubeAtivoId } from '../../src/lib/contextoAtual';
import { usePermissoes } from '../../src/lib/permissoes';
import { BottomNav } from '../../src/components/BottomNav';
import {
  aprovarItem,
  carregarAtividadesEmAndamento,
  carregarItensConcluidos,
  carregarItensParaAprovar,
  type AtividadeEmAndamento,
  type ItemConcluido,
  type ItemParaAprovar,
} from '../../src/lib/aprovacoesClube';

export const PERFIS_APROVACAO = ['admin_ti', 'admin_clube', 'admin_geral', 'admin_total', 'usuario_secretaria'];

type Aba = 'aprovar' | 'andamento' | 'concluidas';

function fmt(data: string | null) {
  if (!data) return null;
  const [y, m, d] = data.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export default function AprovacoesScreen() {
  const permissoes = usePermissoes();
  const podeVer = permissoes.temPerfil(PERFIS_APROVACAO);
  const clubeId = getClubeAtivoId();

  const [aba, setAba] = useState<Aba>('aprovar');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aAprovar, setAAprovar] = useState<ItemParaAprovar[]>([]);
  const [andamento, setAndamento] = useState<AtividadeEmAndamento[]>([]);
  const [concluidas, setConcluidas] = useState<ItemConcluido[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'classe' | 'especialidade'>('todos');
  const [aprovando, setAprovando] = useState<string | null>(null);
  const [expandidas, setExpandidas] = useState<Record<number, boolean>>({});

  useFocusEffect(useCallback(() => { if (podeVer) carregar(); }, [clubeId, podeVer]));

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      const [pendentes, emAndamento, feitas] = await Promise.all([
        carregarItensParaAprovar(clubeId),
        carregarAtividadesEmAndamento(clubeId),
        carregarItensConcluidos(clubeId),
      ]);
      setAAprovar(pendentes);
      setAndamento(emAndamento);
      setConcluidas(feitas);
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível carregar.');
    } finally {
      setLoading(false);
    }
  }

  async function confirmarAprovacao(item: ItemParaAprovar) {
    const chave = `${item.dbvId}-${item.tipo}-${item.nome}`;
    const msg = `Confirmar que "${item.nome}" (${item.dbvNome}) foi entregue na investidura?`;
    const ok = typeof window !== 'undefined' ? window.confirm(msg) : true;
    if (!ok) return;
    setAprovando(chave);
    try {
      await aprovarItem(clubeId, item);
      setAAprovar((prev) => prev.filter((i) => !(i.dbvId === item.dbvId && i.tipo === item.tipo && i.nome === item.nome)));
      setConcluidas((prev) => [...prev, { dbvId: item.dbvId, dbvNome: item.dbvNome, unidadeNome: item.unidadeNome, tipo: item.tipo, nome: item.nome }]);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível registrar a entrega.');
    } finally {
      setAprovando(null);
    }
  }

  const listaFiltrada = useMemo(() => {
    const base = aba === 'aprovar' ? aAprovar : aba === 'concluidas' ? concluidas : [];
    return base.filter((item) => filtroTipo === 'todos' || item.tipo === filtroTipo);
  }, [aba, aAprovar, concluidas, filtroTipo]);

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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.abasScroll} contentContainerStyle={styles.abas}>
        <TouchableOpacity style={[styles.aba, aba === 'aprovar' && styles.abaAtiva]} onPress={() => setAba('aprovar')}>
          <Text style={[styles.abaTexto, aba === 'aprovar' && styles.abaTextoAtivo]}>A aprovar ({aAprovar.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.aba, aba === 'andamento' && styles.abaAtiva]} onPress={() => setAba('andamento')}>
          <Text style={[styles.abaTexto, aba === 'andamento' && styles.abaTextoAtivo]}>Em andamento ({andamento.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.aba, aba === 'concluidas' && styles.abaAtiva]} onPress={() => setAba('concluidas')}>
          <Text style={[styles.abaTexto, aba === 'concluidas' && styles.abaTextoAtivo]}>Concluídas ({concluidas.length})</Text>
        </TouchableOpacity>
      </ScrollView>

      {aba !== 'andamento' && (
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
      )}

      <ScrollView contentContainerStyle={styles.scroll}>
        {loading && <ActivityIndicator size="large" color="#1a3a5c" style={{ marginTop: 40 }} />}
        {!!erro && <Text style={styles.erro}>{erro}</Text>}

        {!loading && aba === 'aprovar' && listaFiltrada.length === 0 && (
          <Text style={styles.vazio}>Nada aguardando aprovação por aqui.</Text>
        )}
        {!loading && aba === 'aprovar' && (listaFiltrada as ItemParaAprovar[]).map((item, i) => {
          const cor = item.tipo === 'classe' ? '#7c3aed' : '#f59e0b';
          const chave = `${item.dbvId}-${item.tipo}-${item.nome}`;
          return (
            <View key={`${chave}-${i}`} style={styles.card}>
              <TouchableOpacity
                style={styles.cardTopo}
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
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnAprovar, aprovando === chave && { opacity: 0.6 }]}
                onPress={() => confirmarAprovacao(item)}
                disabled={aprovando === chave}
              >
                {aprovando === chave
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="checkmark-done" size={16} color="#fff" />}
                <Text style={styles.btnAprovarTexto}>
                  {aprovando === chave ? 'Aprovando...' : item.tipo === 'classe' ? 'Classe validada' : 'Entregar'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {!loading && aba === 'andamento' && andamento.length === 0 && (
          <Text style={styles.vazio}>Nenhuma atividade com entrega pendente.</Text>
        )}
        {!loading && aba === 'andamento' && andamento.map((a) => {
          const aberta = expandidas[a.atividadeId] ?? false;
          return (
            <View key={a.atividadeId} style={styles.card}>
              <TouchableOpacity
                style={styles.cardTopo}
                activeOpacity={0.8}
                onPress={() => setExpandidas((p) => ({ ...p, [a.atividadeId]: !aberta }))}
              >
                <View style={[styles.icone, { backgroundColor: '#e0f2fe' }]}>
                  <Ionicons name="hourglass" size={18} color="#0369a1" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nome}>{a.titulo}</Text>
                  <Text style={styles.sub}>
                    {a.entregues}/{a.totalEsperado} entregaram{fmt(a.data) ? ` · prazo ${fmt(a.data)}` : ''}
                    {a.itemFormativoNome ? ` · ${a.itemFormativoTipo === 'classe' ? 'Classe' : 'Especialidade'}: ${a.itemFormativoNome}` : ''}
                  </Text>
                </View>
                <Ionicons name={aberta ? 'chevron-up' : 'chevron-down'} size={18} color="#b8c2cc" />
              </TouchableOpacity>
              {aberta && (
                <View style={styles.pendentesBox}>
                  <Text style={styles.pendentesTitulo}>Ainda não entregaram:</Text>
                  {a.pendentes.map((p) => (
                    <TouchableOpacity
                      key={p.dbvId}
                      style={styles.pendenteLinha}
                      onPress={() => router.push(`/membro/${p.dbvId}` as any)}
                    >
                      <Ionicons name="person-circle-outline" size={16} color="#7b8794" />
                      <Text style={styles.pendenteTexto}>{p.nome} · {p.unidadeNome}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {!loading && aba === 'concluidas' && listaFiltrada.length === 0 && (
          <Text style={styles.vazio}>Nenhuma conclusão registrada ainda.</Text>
        )}
        {!loading && aba === 'concluidas' && (listaFiltrada as ItemConcluido[]).map((item, i) => {
          const cor = item.tipo === 'classe' ? '#7c3aed' : '#f59e0b';
          return (
            <TouchableOpacity
              key={`${item.dbvId}-${item.tipo}-${item.nome}-${i}`}
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => router.push(`/membro/${item.dbvId}?aba=${item.tipo === 'classe' ? 'classes' : 'especs'}` as any)}
            >
              <View style={styles.cardTopo}>
                <View style={[styles.icone, { backgroundColor: `${cor}18` }]}>
                  <Ionicons name={item.tipo === 'classe' ? 'ribbon' : 'star'} size={20} color={cor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nome}>{item.nome}</Text>
                  <Text style={styles.sub}>{item.dbvNome} · {item.unidadeNome}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#b8c2cc" />
              </View>
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
  abasScroll: { backgroundColor: '#1a3a5c' },
  abas: { paddingHorizontal: 12, paddingBottom: 10, gap: 8 },
  aba: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#2b5079', alignItems: 'center' },
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
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, elevation: 2 },
  cardTopo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icone: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  nome: { fontSize: 14, fontWeight: '700', color: '#1f2933' },
  sub: { fontSize: 11, color: '#7b8794', marginTop: 2 },
  btnAprovar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#16a34a', borderRadius: 10, paddingVertical: 9, marginTop: 10,
  },
  btnAprovarTexto: { color: '#fff', fontWeight: '700', fontSize: 12 },
  pendentesBox: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#eef2f6', gap: 6 },
  pendentesTitulo: { fontSize: 11, fontWeight: '700', color: '#b45309', textTransform: 'uppercase' },
  pendenteLinha: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3 },
  pendenteTexto: { fontSize: 12, color: '#3e4c59' },
});
