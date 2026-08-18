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
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.voltar}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitulo}>Catálogo de classes</Text>
          <Text style={s.headerSub}>{classes.length} classes com requisitos</Text>
        </View>
      </View>

      <Text style={s.explicacao}>
        Toque numa classe para ver e editar os requisitos dela. As mudanças valem
        na hora para todos os membros.
      </Text>

      {!podeGerenciar && (
        <Text style={s.somenteLeitura}>
          Só o Admin TI pode alterar — o catálogo é compartilhado por todos os clubes do programa.
        </Text>
      )}

      <View style={s.buscaBox}>
        <Ionicons name="search" size={18} color="#8a94a0" />
        <TextInput
          style={s.busca}
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar classe..."
          placeholderTextColor="#aaa"
          clearButtonMode="while-editing"
        />
      </View>

      <ScrollView style={s.lista} contentContainerStyle={{ paddingBottom: 24 }}>
        {carregando && <ActivityIndicator size="large" color="#1a3a5c" style={{ marginTop: 40 }} />}
        {!!erro && <Text style={s.erro}>{erro}</Text>}
        {!carregando && !erro && grupos.length === 0 && (
          <Text style={s.vazio}>Nenhuma classe encontrada.</Text>
        )}

        {grupos.map((grupo) => {
          const aberto = !!busca.trim() || abertas.has(grupo.categoria);
          const totalRequisitos = grupo.itens.reduce((soma, i) => soma + i.totalPontuam, 0);
          return (
            <View key={grupo.categoria}>
              <TouchableOpacity
                style={s.grupoHeader}
                activeOpacity={0.7}
                onPress={() => setAbertas((prev) => {
                  const novo = new Set(prev);
                  if (novo.has(grupo.categoria)) novo.delete(grupo.categoria);
                  else novo.add(grupo.categoria);
                  return novo;
                })}
              >
                <Ionicons name={aberto ? 'chevron-down' : 'chevron-forward'} size={17} color="#1a3a5c" />
                <View style={{ flex: 1 }}>
                  <Text style={s.grupoTitulo}>{grupo.categoria}</Text>
                  <Text style={s.grupoSub}>{DESCRICAO[grupo.categoria]}</Text>
                </View>
                <View style={s.contador}>
                  <Text style={s.contadorText}>{totalRequisitos}</Text>
                </View>
              </TouchableOpacity>

              {aberto && grupo.itens.map((item) => {
                const img = imagemDaClasse(item.classe_nome, item.avancada);
                return (
                <TouchableOpacity
                  key={`${item.classe_nome}-${item.avancada}`}
                  style={s.card}
                  activeOpacity={0.75}
                  onPress={() => abrirRequisitos(item)}
                >
                  {img ? (
                    <Image source={img} style={s.cardLogo} resizeMode="contain" />
                  ) : (
                    <Ionicons name="ribbon-outline" size={19} color="#7c3aed" />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardNome}>{item.rotulo}</Text>
                    <Text style={s.cardSub}>
                      {item.totalPontuam} requisitos · {item.totalRequisitos} itens
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color="#9aa5b1" />
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
  explicacao: { fontSize: 12, color: '#6b7684', paddingHorizontal: 20, paddingTop: 12, lineHeight: 17 },
  somenteLeitura: { fontSize: 12, color: '#8a94a0', textAlign: 'center', paddingHorizontal: 20, paddingTop: 8 },

  buscaBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff',
    marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, borderRadius: 12,
    borderWidth: 1, borderColor: '#e4eaf1',
  },
  busca: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#222' },

  lista: { flex: 1, marginTop: 8 },
  erro: { color: '#c0392b', textAlign: 'center', marginVertical: 12 },
  vazio: { color: '#8a94a0', textAlign: 'center', marginTop: 24 },

  grupoHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 10, paddingVertical: 12, paddingHorizontal: 12,
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e4eaf1',
  },
  grupoTitulo: { fontSize: 13, fontWeight: '800', color: '#1a3a5c', textTransform: 'uppercase' },
  grupoSub: { fontSize: 11, color: '#8a94a0', marginTop: 2 },
  contador: {
    minWidth: 30, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
    backgroundColor: '#eef3f8', alignItems: 'center',
  },
  contadorText: { fontSize: 12, fontWeight: '800', color: '#1a3a5c' },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, borderRadius: 12,
    borderWidth: 1, borderColor: '#e4eaf1', padding: 12,
  },
  cardLogo: { width: 28, height: 28 },
  cardNome: { fontSize: 14, fontWeight: '700', color: '#1f2933' },
  cardSub: { fontSize: 12, color: '#8a94a0', marginTop: 2 },
});
