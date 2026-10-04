import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { BottomNav } from '../../src/components/BottomNav';
import { usePermissoes } from '../../src/lib/permissoes';
import { useAuthStore } from '../../src/stores/authStore';
import { useContextoStore } from '../../src/stores/contextoStore';
import { type DiaAnoBiblico, formatarCapitulos, isAnoBissexto, obterAnoCompleto, obterDiasLidos } from '../../src/lib/anoBiblico';
import { useCores, useCorCabecalho } from '../../src/stores/temaStore';
import { corIcone, estiloCartao, tomTexto } from '../../src/lib/tema';
import { EstadoVazio, Selo } from '../../src/components/ui';
import { CabecalhoTela, BotaoCabecalho } from '../../src/components/CabecalhoTela';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function AnoBiblicoScreen() {
  const corCabecalho = useCorCabecalho();
  const cores = useCores();
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
    <View style={[s.container, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.fundo }]}>
      <CabecalhoTela titulo="Ano Bíblico"
        acoes={<>
          <BotaoCabecalho icone="star" onPress={() => router.push('/ano-biblico/marcados' as any)} rotulo="Versos marcados" />
          {podeEditar && <BotaoCabecalho icone="create-outline" onPress={() => router.push('/ano-biblico/admin' as any)} rotulo="Editar plano" />}
        </>}
      />

      <ScrollView style={s.lista} contentContainerStyle={{ paddingBottom: 24 }}>
        {carregando && <ActivityIndicator size="large" color={corIcone(cores)} style={{ marginTop: 40 }} />}
        {!!erro && <View style={{ marginHorizontal: 16 }}><EstadoVazio icone="warning-outline" titulo="Não foi possível carregar" texto={erro} acao="Tentar novamente" aoAcao={() => { void carregar(); }} /></View>}

        {!carregando && !erro && dbvId != null && dias.length > 0 && (
          <View style={[s.resumo, estiloCartao(cores), { borderRadius: 22 }]} accessible accessibilityLabel={`Progresso do ano: ${totalLidos} de ${dias.length} leituras`}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Text style={[s.resumoTitulo, { color: cores.texto }]}>Seu progresso</Text>
              <Text style={[s.resumoNumero, { color: cores.acento }]}>{totalLidos}<Text style={{ color: cores.textoSecundario, fontSize: 14 }}> / {dias.length}</Text></Text>
            </View>
            <View style={[s.barra, { backgroundColor: cores.acentoSuave }]}>
              <View style={[s.barraCheia, { width: `${Math.min(100, Math.round((totalLidos / dias.length) * 100))}%`, backgroundColor: cores.acento }]} />
            </View>
          </View>
        )}

        {!carregando && !erro && MESES.map((nomeMes, idx) => {
          const mes = idx + 1;
          const itens = porMes.get(mes) ?? [];
          if (itens.length === 0) return null;
          const aberto = mesAberto === mes;
          const lidosNoMes = itens.filter((d) => lidos.has(d.id)).length;
          return (
            <View key={mes}>
              <TouchableOpacity
                style={[s.grupoHeader, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, estiloCartao(cores), { borderRadius: 18, borderColor: cores.borda }]}
                activeOpacity={0.7}
                onPress={() => setMesAberto(aberto ? 0 : mes)}
              >
                <Ionicons name={aberto ? 'chevron-down' : 'chevron-forward'} size={17} color={corIcone(cores)} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.grupoTitulo, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>{nomeMes}</Text>
                </View>
                <Selo texto={`${lidosNoMes}/${itens.length}`} tom={lidosNoMes === itens.length ? 'verde' : 'roxo'} icone={lidosNoMes === itens.length ? 'checkmark-circle' : undefined} />
              </TouchableOpacity>

              {aberto && itens.map((dItem) => {
                const lido = lidos.has(dItem.id);
                return (
                  <TouchableOpacity
                    key={dItem.id}
                    style={[s.card, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, estiloCartao(cores), { borderRadius: 18, borderColor: cores.borda, padding: 12 }]}
                    activeOpacity={0.75}
                    onPress={() => router.push({ pathname: '/ano-biblico/[id]', params: { id: String(dItem.id) } } as any)}
                  >
                    <View style={[s.diaBadge, cores.isEscuro && { backgroundColor: '#3e3a4a' }, lido && [s.diaBadgeLido, cores.isEscuro && { backgroundColor: '#1d1932' }]]}>
                      <Text style={[s.diaBadgeTexto, cores.isEscuro && { color: '#cbb8ff' }, lido && [s.diaBadgeTextoLido, cores.isEscuro && { color: '#7fdc98' }]]}>{String(dItem.dia).padStart(2, '0')}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.cardNome, cores.isEscuro && { color: '#f1eefc' }, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>{dItem.livro_nome}</Text>
                      <Text style={[s.cardSub, cores.isEscuro && { color: '#c3c8d1' }, { color: cores.textoSecundario }]}>{formatarCapitulos(dItem)}</Text>
                    </View>
                    {lido ? (
                      <Ionicons name="checkmark-circle" size={20} color={tomTexto('#2e7d32', cores)} />
                    ) : (
                      <Ionicons name="chevron-forward" size={17} color={cores.textoSecundario} />
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
  container: { flex: 1, backgroundColor: '#f5f3fb' },
  header: {
    backgroundColor: '#7c39e7', paddingTop: 48, paddingBottom: 16, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  voltar: { padding: 2 },
  headerTitulo: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub: { color: '#c7d6e5', fontSize: 12, marginTop: 2 },
  editarBtn: { padding: 6 },

  lista: { flex: 1, marginTop: 8 },
  resumo: { marginHorizontal: 16, marginTop: 6, marginBottom: 6, padding: 16, gap: 10 },
  resumoTitulo: { fontSize: 16, fontWeight: '800' },
  resumoNumero: { fontSize: 24, fontWeight: '900' },
  barra: { height: 10, borderRadius: 5, overflow: 'hidden' },
  barraCheia: { height: 10, borderRadius: 5 },
  erro: { color: '#c0392b', textAlign: 'center', marginVertical: 12 },

  grupoHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 10, paddingVertical: 12, paddingHorizontal: 12,
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e6e1f4',
  },
  grupoTitulo: { fontSize: 13, fontWeight: '800', color: '#4b2bb0', textTransform: 'uppercase' },
  contador: {
    minWidth: 42, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
    backgroundColor: '#efeaf9', alignItems: 'center',
  },
  contadorText: { fontSize: 12, fontWeight: '800', color: '#4b2bb0' },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, borderRadius: 18,
    borderWidth: 1, borderColor: '#e6e1f4', padding: 12,
  },
  diaBadge: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#ede7f6',
    alignItems: 'center', justifyContent: 'center',
  },
  diaBadgeLido: { backgroundColor: '#e8f5e9' },
  diaBadgeTexto: { fontSize: 13, fontWeight: '800', color: '#5e35b1' },
  diaBadgeTextoLido: { color: '#2e7d32' },
  cardNome: { fontSize: 14, fontWeight: '700', color: '#1f1b33' },
  cardSub: { fontSize: 12, color: '#8a94a0', marginTop: 2 },
});
