import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { BottomNav } from '../../src/components/BottomNav';
import { useAuthStore } from '../../src/stores/authStore';
import { useCores, useCorCabecalho } from '../../src/stores/temaStore';
import {
  type Idioma, type Marcacao,
  alternarMarcacao, obterLivrosComMarcacoes, obterMarcacoes, obterTextoCapitulo,
} from '../../src/lib/anoBiblico';
import { corIcone } from '../../src/lib/tema';

const IDIOMA_KEY = 'ano_biblico_idioma';

interface MarcacaoComTexto extends Marcacao {
  texto: string;
}

export default function VersosMarcadosScreen() {
  const corCabecalho = useCorCabecalho();
  const cores = useCores();
  const usuario = useAuthStore((s) => s.usuario);

  const [livrosDisponiveis, setLivrosDisponiveis] = useState<{ livro_abrev: string; livro_nome: string }[]>([]);
  const [livrosSelecionados, setLivrosSelecionados] = useState<string[]>([]);
  const [marcacoes, setMarcacoes] = useState<MarcacaoComTexto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  useFocusEffect(useCallback(() => { carregar(); }, [usuario?.id, livrosSelecionados.join(',')]));

  async function carregar() {
    if (!usuario?.id) return;
    setCarregando(true);
    setErro(null);
    try {
      const idioma = ((await AsyncStorage.getItem(IDIOMA_KEY)) as Idioma) ?? 'pt';
      const [livros, itens] = await Promise.all([
        obterLivrosComMarcacoes(usuario.id),
        obterMarcacoes(usuario.id, livrosSelecionados.length > 0 ? livrosSelecionados : undefined),
      ]);
      setLivrosDisponiveis(livros);

      const cacheTexto = new Map<string, Map<number, string>>();
      const comTexto: MarcacaoComTexto[] = [];
      for (const m of itens) {
        const chaveCap = `${m.livro_abrev}:${m.capitulo}`;
        if (!cacheTexto.has(chaveCap)) {
          const versiculos = await obterTextoCapitulo(m.livro_abrev, m.capitulo, idioma);
          const mapa = new Map<number, string>();
          for (const v of versiculos ?? []) mapa.set(v.numero, v.texto);
          cacheTexto.set(chaveCap, mapa);
        }
        comTexto.push({ ...m, texto: cacheTexto.get(chaveCap)?.get(m.verso) ?? '' });
      }
      setMarcacoes(comTexto);
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível carregar os versos marcados.');
    } finally {
      setCarregando(false);
    }
  }

  function toggleLivro(abrev: string) {
    setLivrosSelecionados((prev) => (prev.includes(abrev) ? prev.filter((x) => x !== abrev) : [...prev, abrev]));
  }

  async function remover(m: MarcacaoComTexto) {
    if (!usuario?.id) return;
    setMarcacoes((prev) => prev.filter((x) => x.id !== m.id));
    try {
      await alternarMarcacao(usuario.id, m.livro_abrev, m.livro_nome, m.capitulo, m.verso);
    } catch {
      carregar();
    }
  }

  const porLivroCapitulo = useMemo(() => {
    const mapa = new Map<string, MarcacaoComTexto[]>();
    for (const m of marcacoes) {
      const chave = `${m.livro_nome} ${m.capitulo}`;
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(m);
    }
    return Array.from(mapa.entries());
  }, [marcacoes]);

  return (
    <View style={[s.container, { backgroundColor: cores.fundo }]}>
      <View style={[s.header, { backgroundColor: corCabecalho, paddingTop: 48, paddingBottom: 18, paddingRight: 76 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.voltar}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitulo}>Versos marcados</Text>
          <Text style={s.headerSub}>{marcacoes.length} verso(s)</Text>
        </View>
        <TouchableOpacity onPress={() => setMostrarFiltros((v) => !v)} style={s.filtroBtn}>
          <Ionicons name="filter" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {mostrarFiltros && (
        <View style={[s.filtrosBox, { backgroundColor: cores.cartao, borderBottomColor: cores.borda }]}>
          <Text style={[s.filtrosLabel, { color: cores.textoSecundario }]}>
            Livros {livrosSelecionados.length > 0 ? `(${livrosSelecionados.length} selecionado(s))` : '(todos)'}
          </Text>
          <View style={s.filtroRow}>
            {livrosDisponiveis.length === 0 && (
              <Text style={[s.filtrosVazio, { color: cores.textoSecundario }]}>Nenhum verso marcado ainda.</Text>
            )}
            {livrosDisponiveis.map((l) => {
              const ativo = livrosSelecionados.includes(l.livro_abrev);
              return (
                <TouchableOpacity
                  key={l.livro_abrev}
                  style={[s.chip, { backgroundColor: cores.fundo, borderColor: cores.borda }, ativo && s.chipAtivo]}
                  onPress={() => toggleLivro(l.livro_abrev)}
                >
                  <Text style={[s.chipText, cores.isEscuro && { color: '#fff' }, ativo && s.chipTextAtivo]}>{l.livro_nome}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {carregando && <ActivityIndicator size="large" color={corIcone(cores)} style={{ marginTop: 40 }} />}
      {!!erro && <Text style={s.erro}>{erro}</Text>}

      {!carregando && !erro && (
        <ScrollView style={s.lista} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          {porLivroCapitulo.length === 0 && (
            <Text style={[s.vazio, { color: cores.textoSecundario }]}>Nenhum verso marcado{livrosSelecionados.length > 0 ? ' nesses livros' : ''}.</Text>
          )}
          {porLivroCapitulo.map(([titulo, itens]) => (
            <View key={titulo} style={s.grupo}>
              <Text style={[s.grupoTitulo, cores.isEscuro && { color: '#fff' }]}>{titulo}</Text>
              {itens.map((m) => (
                <View key={m.id} style={[s.versoCard, { backgroundColor: cores.cartao, borderColor: cores.borda }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.versoTexto, { color: cores.texto }]}>
                      <Text style={s.versoNumero}>{m.verso} </Text>
                      {m.texto || '(texto indisponível nesse idioma)'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => remover(m)} style={s.removerBtn}>
                    <Ionicons name="star" size={18} color="#f9a825" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}

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
  headerTitulo: { color: '#fff', fontSize: 16, fontWeight: '800' },
  headerSub: { color: '#c7d6e5', fontSize: 12, marginTop: 2 },
  filtroBtn: { padding: 6 },

  filtrosBox: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e4eaf1', padding: 14 },
  filtrosLabel: { fontSize: 12, fontWeight: '800', color: '#455a64', marginBottom: 8 },
  filtrosVazio: { fontSize: 12, color: '#8a94a0' },
  filtroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: '#f3f7fb', borderWidth: 1, borderColor: '#d7e5f3' },
  chipAtivo: { backgroundColor: '#1a3a5c', borderColor: '#1a3a5c' },
  chipText: { color: '#1a3a5c', fontSize: 12, fontWeight: '700' },
  chipTextAtivo: { color: '#fff' },

  lista: { flex: 1 },
  erro: { color: '#c0392b', textAlign: 'center', marginVertical: 12 },
  vazio: { color: '#8a94a0', textAlign: 'center', marginTop: 24 },

  grupo: { marginBottom: 18 },
  grupoTitulo: { fontSize: 14, fontWeight: '800', color: '#1a3a5c', marginBottom: 8 },
  versoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#fff',
    borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#eef2f6',
  },
  versoTexto: { fontSize: 14, lineHeight: 21, color: '#263238' },
  versoNumero: { fontSize: 11, fontWeight: '800', color: '#7c3aed' },
  removerBtn: { padding: 4 },
});
