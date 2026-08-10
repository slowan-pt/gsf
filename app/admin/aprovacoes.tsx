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
  type PendenteAtividade,
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
  const [grupoAberto, setGrupoAberto] = useState<string | null>(null);

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

  const gruposAAprovar = useMemo(() => {
    const porNome = new Map<string, { tipo: 'classe' | 'especialidade'; nome: string; itens: ItemParaAprovar[] }>();
    for (const item of aAprovar) {
      if (filtroTipo !== 'todos' && item.tipo !== filtroTipo) continue;
      const chave = `${item.tipo}|${item.nome}`;
      const atual = porNome.get(chave) ?? { tipo: item.tipo, nome: item.nome, itens: [] };
      atual.itens.push(item);
      porNome.set(chave, atual);
    }
    return Array.from(porNome.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [aAprovar, filtroTipo]);

  const gruposAndamento = useMemo(() => {
    const porTitulo = new Map<string, { titulo: string; itemFormativoTipo: 'classe' | 'especialidade' | null; itemFormativoNome: string | null; data: string | null; entregues: number; totalEsperado: number; pendentes: PendenteAtividade[] }>();
    for (const a of andamento) {
      const chave = a.itemFormativoNome ? `${a.itemFormativoTipo}|${a.itemFormativoNome}` : `titulo|${a.titulo}`;
      const atual = porTitulo.get(chave) ?? {
        titulo: a.itemFormativoNome ?? a.titulo,
        itemFormativoTipo: a.itemFormativoTipo, itemFormativoNome: a.itemFormativoNome,
        data: a.data, entregues: 0, totalEsperado: 0, pendentes: [],
      };
      atual.entregues += a.entregues;
      atual.totalEsperado += a.totalEsperado;
      for (const p of a.pendentes) if (!atual.pendentes.some((x) => x.dbvId === p.dbvId)) atual.pendentes.push(p);
      porTitulo.set(chave, atual);
    }
    for (const grupo of porTitulo.values()) {
      grupo.pendentes.sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
    }
    return Array.from(porTitulo.values()).sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
  }, [andamento]);

  const gruposConcluidas = useMemo(() => {
    const porNome = new Map<string, { tipo: 'classe' | 'especialidade'; nome: string; membros: ItemConcluido[] }>();
    for (const item of concluidas) {
      if (filtroTipo !== 'todos' && item.tipo !== filtroTipo) continue;
      const chave = `${item.tipo}|${item.nome}`;
      const atual = porNome.get(chave) ?? { tipo: item.tipo, nome: item.nome, membros: [] };
      atual.membros.push(item);
      porNome.set(chave, atual);
    }
    return Array.from(porNome.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [concluidas, filtroTipo]);

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

        {!loading && aba === 'aprovar' && gruposAAprovar.length === 0 && (
          <Text style={styles.vazio}>Nada aguardando aprovação por aqui.</Text>
        )}
        {!loading && aba === 'aprovar' && gruposAAprovar.map((grupo) => {
          const cor = grupo.tipo === 'classe' ? '#7c3aed' : '#f59e0b';
          const chaveGrupo = `${grupo.tipo}|${grupo.nome}`;
          const aberto = grupoAberto === chaveGrupo;
          return (
            <View key={chaveGrupo} style={styles.card}>
              <TouchableOpacity style={styles.cardTopo} activeOpacity={0.8} onPress={() => setGrupoAberto(aberto ? null : chaveGrupo)}>
                <View style={[styles.icone, { backgroundColor: `${cor}18` }]}>
                  <Ionicons name={grupo.tipo === 'classe' ? 'ribbon' : 'star'} size={20} color={cor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nome}>{grupo.nome}</Text>
                  <Text style={styles.sub}>{grupo.itens.length} aguardando aprovação</Text>
                </View>
                <Ionicons name={aberto ? 'chevron-up' : 'chevron-down'} size={18} color="#b8c2cc" />
              </TouchableOpacity>
              {aberto && (
                <View style={styles.pendentesBox}>
                  {grupo.itens.map((item, i) => {
                    const chaveItem = `${item.dbvId}-${item.tipo}-${item.nome}`;
                    return (
                      <View key={`${chaveItem}-${i}`} style={styles.itemAprovarLinha}>
                        <TouchableOpacity
                          style={{ flex: 1 }}
                          onPress={() => router.push(`/membro/${item.dbvId}?aba=${item.tipo === 'classe' ? 'classes' : 'especs'}` as any)}
                        >
                          <Text style={styles.pendenteTexto}>{item.dbvNome} · {item.unidadeNome}</Text>
                          {item.necessarias > 1 && (
                            <Text style={styles.itemAprovarDetalhe}>{item.aprovadas}/{item.necessarias} avaliações</Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.btnAprovarPequeno, aprovando === chaveItem && { opacity: 0.6 }]}
                          onPress={() => confirmarAprovacao(item)}
                          disabled={aprovando === chaveItem}
                        >
                          {aprovando === chaveItem
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <Ionicons name="checkmark-done" size={14} color="#fff" />}
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        {!loading && aba === 'andamento' && gruposAndamento.length === 0 && (
          <Text style={styles.vazio}>Nenhuma atividade com entrega pendente.</Text>
        )}
        {!loading && aba === 'andamento' && gruposAndamento.map((grupo) => {
          const chaveGrupo = grupo.itemFormativoNome ? `${grupo.itemFormativoTipo}|${grupo.itemFormativoNome}` : `titulo|${grupo.titulo}`;
          const aberto = grupoAberto === chaveGrupo;
          return (
            <View key={chaveGrupo} style={styles.card}>
              <TouchableOpacity style={styles.cardTopo} activeOpacity={0.8} onPress={() => setGrupoAberto(aberto ? null : chaveGrupo)}>
                <View style={[styles.icone, { backgroundColor: '#e0f2fe' }]}>
                  <Ionicons name="hourglass" size={18} color="#0369a1" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nome}>{grupo.titulo}</Text>
                  <Text style={styles.sub}>
                    {grupo.entregues}/{grupo.totalEsperado} entregaram{fmt(grupo.data) ? ` · prazo ${fmt(grupo.data)}` : ''}
                  </Text>
                </View>
                <Ionicons name={aberto ? 'chevron-up' : 'chevron-down'} size={18} color="#b8c2cc" />
              </TouchableOpacity>
              {aberto && (
                <View style={styles.pendentesBox}>
                  <Text style={styles.pendentesTitulo}>Ainda não entregaram:</Text>
                  {grupo.pendentes.map((p) => (
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

        {!loading && aba === 'concluidas' && gruposConcluidas.length === 0 && (
          <Text style={styles.vazio}>Nenhuma conclusão registrada ainda.</Text>
        )}
        {!loading && aba === 'concluidas' && gruposConcluidas.map((grupo) => {
          const cor = grupo.tipo === 'classe' ? '#7c3aed' : '#f59e0b';
          const chave = `${grupo.tipo}|${grupo.nome}`;
          const aberto = grupoAberto === chave;
          return (
            <View key={chave} style={styles.card}>
              <TouchableOpacity
                style={styles.cardTopo}
                activeOpacity={0.8}
                onPress={() => setGrupoAberto(aberto ? null : chave)}
              >
                <View style={[styles.icone, { backgroundColor: `${cor}18` }]}>
                  <Ionicons name={grupo.tipo === 'classe' ? 'ribbon' : 'star'} size={20} color={cor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nome}>{grupo.nome}</Text>
                  <Text style={styles.sub}>{grupo.membros.length} {grupo.membros.length === 1 ? 'concluiu' : 'concluíram'}</Text>
                </View>
                <Ionicons name={aberto ? 'chevron-up' : 'chevron-down'} size={18} color="#b8c2cc" />
              </TouchableOpacity>
              {aberto && (
                <View style={styles.pendentesBox}>
                  {grupo.membros.map((m, i) => (
                    <TouchableOpacity
                      key={`${m.dbvId}-${i}`}
                      style={styles.pendenteLinha}
                      onPress={() => router.push(`/membro/${m.dbvId}?aba=${m.tipo === 'classe' ? 'classes' : 'especs'}` as any)}
                    >
                      <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                      <Text style={styles.pendenteTexto}>{m.dbvNome} · {m.unidadeNome}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
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
  pendentesBox: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#eef2f6', gap: 6 },
  pendentesTitulo: { fontSize: 11, fontWeight: '700', color: '#b45309', textTransform: 'uppercase' },
  pendenteLinha: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3 },
  itemAprovarLinha: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  itemAprovarDetalhe: { fontSize: 10, color: '#9aa5b1', marginTop: 1 },
  btnAprovarPequeno: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#16a34a',
    alignItems: 'center', justifyContent: 'center',
  },
  pendenteTexto: { fontSize: 12, color: '#3e4c59' },
});
