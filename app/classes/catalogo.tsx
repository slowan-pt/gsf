import { EstadoVazio, CampoBusca } from '../../src/components/ui';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { BottomNav } from '../../src/components/BottomNav';
import { usePermissoes } from '../../src/lib/permissoes';
import {
  carregarClassesDoCatalogo,
  CATEGORIAS_CLASSE,
  type CategoriaClasse,
  type ClasseDoCatalogo,
} from '../../src/lib/classesCatalogoAdmin';
import { imagemDaClasse } from '../../src/lib/classesRequisitos';
import { useCores, useCorCabecalho } from '../../src/stores/temaStore';
import { corIcone, tomTexto } from '../../src/lib/tema';
import { CabecalhoTela } from '../../src/components/CabecalhoTela';

function semAcento(txt: string) {
  return txt.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const DESCRICAO: Record<CategoriaClasse, string> = {
  Regulares: 'Amigo a Guia — os requisitos do cartão de cada classe.',
  Avançadas: 'Amigo da Natureza, Guia de Exploração e demais avançadas.',
  Líder: 'Líder e Líder Máster.',
  Agrupadas: 'Classes agrupadas por faixa etária.',
};

export default function CatalogoClassesScreen() {
  const cores = useCores();
  const corCabecalho = useCorCabecalho();
  const permissoes = usePermissoes();
  const podeGerenciar = permissoes.temPerfil(['admin_ti', 'admin_total']);

  const [classes, setClasses] = useState<ClasseDoCatalogo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [abertas, setAbertas] = useState<Set<string>>(new Set());

  useFocusEffect(useCallback(() => { carregar(); }, []));

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setClasses(await carregarClassesDoCatalogo());
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível carregar o catálogo de classes.');
    } finally {
      setCarregando(false);
    }
  }

  const grupos = useMemo(() => {
    const termo = semAcento(busca);
    const filtradas = termo
      ? classes.filter((c) => semAcento(c.rotulo).includes(termo))
      : classes;

    const mapa = new Map<CategoriaClasse, ClasseDoCatalogo[]>(
      CATEGORIAS_CLASSE.map((c) => [c, []])
    );
    for (const item of filtradas) mapa.get(item.categoria)!.push(item);

    // Ordem fixa: Regulares → Avançadas → Líder → Agrupadas. Vazias somem.
    return CATEGORIAS_CLASSE
      .map((categoria) => ({ categoria, itens: mapa.get(categoria) ?? [] }))
      .filter((g) => g.itens.length > 0);
  }, [classes, busca]);

  function abrirRequisitos(item: ClasseDoCatalogo) {
    router.push({
      pathname: '/classes/requisitos',
      params: {
        classe: item.classe_nome,
        avancada: item.avancada ? '1' : '0',
        rotulo: item.rotulo,
      },
    } as any);
  }

  return (
    <View style={[s.container, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.fundo }]}>
      <CabecalhoTela titulo="Catálogo de classes" />

      <Text style={[s.explicacao, cores.isEscuro && { color: '#aeb4bc' }, { color: cores.textoSecundario }]}>
        Toque numa classe para ver e editar os requisitos dela. As mudanças valem
        na hora para todos os membros.
      </Text>

      {!podeGerenciar && (
        <Text style={[s.somenteLeitura, cores.isEscuro && { color: '#c3c8d1' }, { color: cores.textoSecundario }]}>
          Só o Admin TI pode alterar — o catálogo é compartilhado por todos os clubes do programa.
        </Text>
      )}

      <View style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 8 }}>
        <CampoBusca valor={busca} onChange={setBusca} placeholder="Buscar classe..." />
      </View>

      <ScrollView style={s.lista} contentContainerStyle={{ paddingBottom: 24 }}>
        {carregando && <ActivityIndicator size="large" color={corIcone(cores)} style={{ marginTop: 40 }} />}
        {!!erro && <EstadoVazio icone="warning-outline" titulo="Não foi possível carregar" texto={erro} />}
        {!carregando && !erro && grupos.length === 0 && (
          <EstadoVazio titulo="Nenhuma classe encontrada." />
        )}

        {grupos.map((grupo) => {
          const aberto = !!busca.trim() || abertas.has(grupo.categoria);
          const totalRequisitos = grupo.itens.reduce((soma, i) => soma + i.totalPontuam, 0);
          return (
            <View key={grupo.categoria}>
              <TouchableOpacity
                style={[s.grupoHeader, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, { backgroundColor: cores.cartao, borderColor: cores.borda }]}
                activeOpacity={0.7}
                onPress={() => setAbertas((prev) => {
                  const novo = new Set(prev);
                  if (novo.has(grupo.categoria)) novo.delete(grupo.categoria);
                  else novo.add(grupo.categoria);
                  return novo;
                })}
              >
                <Ionicons name={aberto ? 'chevron-down' : 'chevron-forward'} size={17} color={corIcone(cores)} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.grupoTitulo, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>{grupo.categoria}</Text>
                  <Text style={[s.grupoSub, cores.isEscuro && { color: '#c3c8d1' }, { color: cores.textoSecundario }]}>{DESCRICAO[grupo.categoria]}</Text>
                </View>
                <View style={[s.contador, cores.isEscuro && { backgroundColor: '#3e3b4b' }, { backgroundColor: cores.fundo }]}>
                  <Text style={[s.contadorText, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>{totalRequisitos}</Text>
                </View>
              </TouchableOpacity>

              {aberto && grupo.itens.map((item) => {
                const img = imagemDaClasse(item.classe_nome, item.avancada);
                return (
                <TouchableOpacity
                  key={`${item.classe_nome}-${item.avancada}`}
                  style={[s.card, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, { backgroundColor: cores.cartao, borderColor: cores.borda }]}
                  activeOpacity={0.75}
                  onPress={() => abrirRequisitos(item)}
                >
                  {img ? (
                    <Image source={img} style={s.cardLogo} resizeMode="contain" />
                  ) : (
                    <Ionicons name="ribbon-outline" size={19} color={tomTexto('#7c3aed', cores)} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[s.cardNome, cores.isEscuro && { color: '#f1eefc' }, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>{item.rotulo}</Text>
                    <Text style={[s.cardSub, cores.isEscuro && { color: '#c3c8d1' }, { color: cores.textoSecundario }]}>
                      {item.totalPontuam} requisitos · {item.totalRequisitos} itens
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color={cores.textoSecundario} />
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
  explicacao: { fontSize: 12, color: '#6b7684', paddingHorizontal: 20, paddingTop: 12, lineHeight: 17 },
  somenteLeitura: { fontSize: 12, color: '#8a94a0', textAlign: 'center', paddingHorizontal: 20, paddingTop: 8 },

  buscaBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff',
    marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, borderRadius: 18,
    borderWidth: 1, borderColor: '#e6e1f4',
  },
  busca: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#222' },

  lista: { flex: 1, marginTop: 8 },
  erro: { color: '#c0392b', textAlign: 'center', marginVertical: 12 },
  vazio: { color: '#8a94a0', textAlign: 'center', marginTop: 24 },

  grupoHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 10, paddingVertical: 12, paddingHorizontal: 12,
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e6e1f4',
  },
  grupoTitulo: { fontSize: 13, fontWeight: '800', color: '#4b2bb0', textTransform: 'uppercase' },
  grupoSub: { fontSize: 11, color: '#8a94a0', marginTop: 2 },
  contador: {
    minWidth: 30, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
    backgroundColor: '#efeaf9', alignItems: 'center',
  },
  contadorText: { fontSize: 12, fontWeight: '800', color: '#4b2bb0' },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, borderRadius: 18,
    borderWidth: 1, borderColor: '#e6e1f4', padding: 12,
  },
  cardLogo: { width: 28, height: 28 },
  cardNome: { fontSize: 14, fontWeight: '700', color: '#1f1b33' },
  cardSub: { fontSize: 12, color: '#8a94a0', marginTop: 2 },
});
