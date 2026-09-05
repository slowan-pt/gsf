import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { BottomNav } from '../../src/components/BottomNav';
import { usePermissoes } from '../../src/lib/permissoes';
import { useAuthStore } from '../../src/stores/authStore';
import { useContextoStore } from '../../src/stores/contextoStore';
import { type DiaAnoBiblico, isAnoBissexto, obterAnoCompleto, obterDiasLidos } from '../../src/lib/anoBiblico';
import { useAparenciaStore } from '../../src/stores/aparenciaStore';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function AnoBiblicoScreen() {
  const corCabecalho = useAparenciaStore((s) => s.corCabecalho);
  const permissoes = usePermissoes();
  const podeEditar = permissoes.temPerfil(['admin_ti']);
  const usuario = useAuthStore((s) => s.usuario);
  const contextoAtivo = useContextoStore((s) => s.contextoAtivo);
  const dbvId = contextoAtivo?.membro_id ?? usuario?.dbv_id ?? null;

  const [dias, setDias] = useState<DiaAnoBiblico[]>([]);
  const [lidos, setLidos] = useState<Set<number>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [mesAberto, setMesAberto] = useState<number>(new Date().getMonth() + 1);

  useFocusEffect(useCallback(() => { carregar(); }, [dbvId]));

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const ano = new Date().getFullYear();
      const bissexto = isAnoBissexto(ano);
      const todos = await obterAnoCompleto();
      // Filtra a linha certa de 28/fev conforme o ano ser bissexto, e só
      // inclui 29/fev nos anos que realmente o têm.
      const filtrados = todos.filter((d) => {
        if (d.mes === 2 && (d.dia === 28 || d.dia === 29)) return d.ano_bissexto === bissexto;
        return !d.ano_bissexto;
      });
      setDias(filtrados);
      if (dbvId) setLidos(await obterDiasLidos(dbvId, ano));
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível carregar o Ano Bíblico.');
    } finally {
      setCarregando(false);
    }
  }

  const porMes = useMemo(() => {
    const mapa = new Map<number, DiaAnoBiblico[]>();
    for (const d of dias) {
      if (!mapa.has(d.mes)) mapa.set(d.mes, []);
      mapa.get(d.mes)!.push(d);
    }
    for (const lista of mapa.values()) lista.sort((a, b) => a.dia - b.dia);
    return mapa;
  }, [dias]);

  const totalLidos = lidos.size;

  return (
    <View style={s.container}>
      <View style={[s.header, { backgroundColor: corCabecalho, paddingTop: 48, paddingBottom: 18 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.voltar}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitulo}>Ano Bíblico</Text>
          <Text style={s.headerSub}>{totalLidos} de {dias.length} dias lidos</Text>
        </View>
        {podeEditar && (
          <TouchableOpacity onPress={() => router.push('/ano-biblico/admin' as any)} style={s.editarBtn}>
            <Ionicons name="create-outline" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={s.lista} contentContainerStyle={{ paddingBottom: 24 }}>
        {carregando && <ActivityIndicator size="large" color="#1a3a5c" style={{ marginTop: 40 }} />}
        {!!erro && <Text style={s.erro}>{erro}</Text>}

        {!carregando && !erro && MESES.map((nomeMes, idx) => {
          const mes = idx + 1;
          const itens = porMes.get(mes) ?? [];
          if (itens.length === 0) return null;
          const aberto = mesAberto === mes;
          const lidosNoMes = itens.filter((d) => lidos.has(d.id)).length;
          return (
            <View key={mes}>
              <TouchableOpacity
                style={s.grupoHeader}
                activeOpacity={0.7}
                onPress={() => setMesAberto(aberto ? 0 : mes)}
              >
                <Ionicons name={aberto ? 'chevron-down' : 'chevron-forward'} size={17} color="#1a3a5c" />
                <View style={{ flex: 1 }}>
                  <Text style={s.grupoTitulo}>{nomeMes}</Text>
                </View>
                <View style={s.contador}>
                  <Text style={s.contadorText}>{lidosNoMes}/{itens.length}</Text>
                </View>
              </TouchableOpacity>

              {aberto && itens.map((dItem) => {
                const lido = lidos.has(dItem.id);
                return (
                  <TouchableOpacity
                    key={dItem.id}
                    style={s.card}
                    activeOpacity={0.75}
                    onPress={() => router.push({ pathname: '/ano-biblico/[id]', params: { id: String(dItem.id) } } as any)}
                  >
                    <View style={[s.diaBadge, lido && s.diaBadgeLido]}>
                      <Text style={[s.diaBadgeTexto, lido && s.diaBadgeTextoLido]}>{String(dItem.dia).padStart(2, '0')}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardNome}>{dItem.referencia}</Text>
                      <Text style={s.cardSub}>{dItem.livro_nome}</Text>
                    </View>
                    {lido ? (
                      <Ionicons name="checkmark-circle" size={20} color="#2e7d32" />
                    ) : (
                      <Ionicons name="chevron-forward" size={17} color="#9aa5b1" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
      </ScrollView>

      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f5f9' },
  header: {
    backgroundColor: '#1a3a5c', paddingTop: 48, paddingBottom: 16, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  voltar: { padding: 2 },
  headerTitulo: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub: { color: '#c7d6e5', fontSize: 12, marginTop: 2 },
  editarBtn: { padding: 6 },

  lista: { flex: 1, marginTop: 8 },
  erro: { color: '#c0392b', textAlign: 'center', marginVertical: 12 },

  grupoHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 10, paddingVertical: 12, paddingHorizontal: 12,
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e4eaf1',
  },
  grupoTitulo: { fontSize: 13, fontWeight: '800', color: '#1a3a5c', textTransform: 'uppercase' },
  contador: {
    minWidth: 42, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
    backgroundColor: '#eef3f8', alignItems: 'center',
  },
  contadorText: { fontSize: 12, fontWeight: '800', color: '#1a3a5c' },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, borderRadius: 12,
    borderWidth: 1, borderColor: '#e4eaf1', padding: 12,
  },
  diaBadge: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: '#ede7f6',
    alignItems: 'center', justifyContent: 'center',
  },
  diaBadgeLido: { backgroundColor: '#e8f5e9' },
  diaBadgeTexto: { fontSize: 13, fontWeight: '800', color: '#5e35b1' },
  diaBadgeTextoLido: { color: '#2e7d32' },
  cardNome: { fontSize: 14, fontWeight: '700', color: '#1f2933' },
  cardSub: { fontSize: 12, color: '#8a94a0', marginTop: 2 },
});
