import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, NativeScrollEvent, NativeSyntheticEvent, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BottomNav } from '../../src/components/BottomNav';
import { useAuthStore } from '../../src/stores/authStore';
import { useContextoStore } from '../../src/stores/contextoStore';
import {
  IDIOMAS, type DiaAnoBiblico, type Idioma, type Versiculo,
  marcarComoLido, obterDiaPorId, obterDiasLidos, obterTextoCapitulo, recortarVersiculos,
} from '../../src/lib/anoBiblico';

const TEMPO_MINIMO_MS = 15000;
const IDIOMA_KEY = 'ano_biblico_idioma';
const VOZ_KEY_PREFIXO = 'ano_biblico_voz_';

interface PassagemComTexto {
  livro_abrev: string;
  capitulo: number;
  titulo: string;
  versiculos: Versiculo[];
}

export default function CapituloAnoBiblicoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const catalogoId = Number(id);
  const usuario = useAuthStore((s) => s.usuario);
  const contextoAtivo = useContextoStore((s) => s.contextoAtivo);
  const dbvId = contextoAtivo?.membro_id ?? usuario?.dbv_id ?? null;

  const [dia, setDia] = useState<DiaAnoBiblico | null>(null);
  const [passagens, setPassagens] = useState<PassagemComTexto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [idioma, setIdioma] = useState<Idioma>('pt');
  const [seletorIdiomaAberto, setSeletorIdiomaAberto] = useState(false);
  const [jaLido, setJaLido] = useState(false);
  const [falando, setFalando] = useState(false);

  const tempoOk = useRef(false);
  const scrollOk = useRef(false);
  const marcado = useRef(false);
  const alturaConteudo = useRef(0);
  const alturaVisivel = useRef(0);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      tempoOk.current = false;
      scrollOk.current = false;
      marcado.current = false;
      alturaConteudo.current = 0;
      alturaVisivel.current = 0;
      setFalando(false);
      Speech.stop();

      AsyncStorage.getItem(IDIOMA_KEY).then((v) => {
        if (ativo && v) setIdioma(v as Idioma);
      });

      const timer = setTimeout(() => {
        tempoOk.current = true;
        tentarMarcarComoLido();
      }, TEMPO_MINIMO_MS);

      return () => {
        ativo = false;
        clearTimeout(timer);
        Speech.stop();
      };
    }, [catalogoId])
  );

  useEffect(() => {
    carregar();
  }, [catalogoId, idioma]);

  async function carregar() {
    if (!catalogoId) return;
    setCarregando(true);
    setErro(null);
    try {
      const diaCarregado = await obterDiaPorId(catalogoId);
      if (!diaCarregado) {
        setErro('Dia não encontrado no plano.');
        return;
      }
      setDia(diaCarregado);

      const grupos: PassagemComTexto[] = [];
      for (const p of diaCarregado.passagens) {
        const texto = await obterTextoCapitulo(p.livro_abrev, p.capitulo, idioma);
        if (!texto) continue;
        const recorte = recortarVersiculos(texto, p);
        const nomeLivro = p.livro_abrev === diaCarregado.livro_abrev ? diaCarregado.livro_nome : p.livro_abrev;
        grupos.push({
          livro_abrev: p.livro_abrev,
          capitulo: p.capitulo,
          titulo: `${nomeLivro} ${p.capitulo}${p.verso_ini ? `:${p.verso_ini}-${p.verso_fim}` : ''}`,
          versiculos: recorte,
        });
      }
      setPassagens(grupos);

      if (dbvId) {
        const ano = new Date().getFullYear();
        const lidos = await obterDiasLidos(dbvId, ano);
        setJaLido(lidos.has(catalogoId));
      }
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível carregar o capítulo.');
    } finally {
      setCarregando(false);
    }
  }

  async function tentarMarcarComoLido() {
    if (marcado.current || jaLido || !tempoOk.current || !scrollOk.current || !dbvId || !catalogoId) return;
    marcado.current = true;
    try {
      await marcarComoLido({
        dbvId,
        catalogoId,
        ano: new Date().getFullYear(),
        tempoTelaSegundos: Math.round(TEMPO_MINIMO_MS / 1000),
        chegouAoFim: true,
      });
      setJaLido(true);
    } catch {
      marcado.current = false; // permite tentar de novo no próximo evento de scroll
    }
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 24) {
      scrollOk.current = true;
      tentarMarcarComoLido();
    }
  }

  function checarSemRolagem() {
    // Capítulo curto o suficiente para não precisar rolar: não há o que esperar.
    if (alturaConteudo.current > 0 && alturaVisivel.current > 0 && alturaConteudo.current <= alturaVisivel.current) {
      scrollOk.current = true;
      tentarMarcarComoLido();
    }
  }

  function onContentSizeChange(_w: number, h: number) {
    alturaConteudo.current = h;
    checarSemRolagem();
  }

  function onLayoutScrollView(e: { nativeEvent: { layout: { height: number } } }) {
    alturaVisivel.current = e.nativeEvent.layout.height;
    checarSemRolagem();
  }

  async function escolherIdioma(novo: Idioma) {
    setIdioma(novo);
    setSeletorIdiomaAberto(false);
    await AsyncStorage.setItem(IDIOMA_KEY, novo);
  }

  async function alternarFala() {
    if (falando) {
      Speech.stop();
      setFalando(false);
      return;
    }
    const localeSpeech = IDIOMAS.find((i) => i.codigo === idioma)?.localeSpeech ?? 'pt-BR';
    const vozPreferida = await AsyncStorage.getItem(VOZ_KEY_PREFIXO + idioma);
    const todosVersiculos = passagens.flatMap((p) => p.versiculos);
    if (todosVersiculos.length === 0) return;

    setFalando(true);
    falarSequencia(todosVersiculos, 0, localeSpeech, vozPreferida ?? undefined);
  }

  function falarSequencia(versiculos: Versiculo[], indice: number, locale: string, voice?: string) {
    if (indice >= versiculos.length) {
      setFalando(false);
      return;
    }
    Speech.speak(versiculos[indice].texto, {
      language: locale,
      voice,
      onDone: () => falarSequencia(versiculos, indice + 1, locale, voice),
      onStopped: () => setFalando(false),
      onError: () => falarSequencia(versiculos, indice + 1, locale, voice),
    });
  }

  const tituloIdioma = IDIOMAS.find((i) => i.codigo === idioma)?.rotulo ?? '';

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.voltar}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitulo}>{dia?.referencia ?? 'Ano Bíblico'}</Text>
          <Text style={s.headerSub}>{dia ? `${String(dia.dia).padStart(2, '0')}/${String(dia.mes).padStart(2, '0')}` : ''}</Text>
        </View>
        <TouchableOpacity onPress={() => setSeletorIdiomaAberto((v) => !v)} style={s.idiomaBtn}>
          <Ionicons name="language" size={18} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={alternarFala} style={s.idiomaBtn}>
          <Ionicons name={falando ? 'stop-circle' : 'volume-high'} size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {seletorIdiomaAberto && (
        <View style={s.seletorIdioma}>
          {IDIOMAS.map((i) => (
            <TouchableOpacity key={i.codigo} style={s.opcaoIdioma} onPress={() => escolherIdioma(i.codigo)}>
              <Text style={[s.opcaoIdiomaTexto, i.codigo === idioma && s.opcaoIdiomaTextoAtivo]}>{i.rotulo}</Text>
              {i.codigo === idioma && <Ionicons name="checkmark" size={16} color="#1a3a5c" />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {carregando && <ActivityIndicator size="large" color="#1a3a5c" style={{ marginTop: 40 }} />}
      {!!erro && <Text style={s.erro}>{erro}</Text>}

      {!carregando && !erro && (
        <ScrollView
          style={s.corpo}
          contentContainerStyle={{ padding: 18, paddingBottom: 40 }}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onContentSizeChange={onContentSizeChange}
          onLayout={onLayoutScrollView}
        >
          {jaLido && (
            <View style={s.selo}>
              <Ionicons name="checkmark-circle" size={16} color="#2e7d32" />
              <Text style={s.seloTexto}>Já lido</Text>
            </View>
          )}
          <Text style={s.idiomaAtual}>{tituloIdioma}</Text>
          {passagens.map((p, idx) => (
            <View key={`${p.livro_abrev}-${p.capitulo}-${idx}`} style={s.passagem}>
              <Text style={s.tituloPassagem}>{p.titulo}</Text>
              {p.versiculos.map((v) => (
                <Text key={v.numero} style={s.versiculo}>
                  <Text style={s.numeroVersiculo}>{v.numero} </Text>
                  {v.texto}
                </Text>
              ))}
            </View>
          ))}
          {passagens.length === 0 && (
            <Text style={s.vazio}>Texto ainda não disponível nesse idioma.</Text>
          )}
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
  idiomaBtn: { padding: 6 },

  seletorIdioma: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e4eaf1' },
  opcaoIdioma: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f2f5f9',
  },
  opcaoIdiomaTexto: { fontSize: 14, color: '#455a64' },
  opcaoIdiomaTextoAtivo: { color: '#1a3a5c', fontWeight: '800' },

  corpo: { flex: 1 },
  erro: { color: '#c0392b', textAlign: 'center', marginVertical: 12 },
  vazio: { color: '#8a94a0', textAlign: 'center', marginTop: 24 },

  selo: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: '#e8f5e9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, marginBottom: 12,
  },
  seloTexto: { color: '#2e7d32', fontSize: 12, fontWeight: '700' },
  idiomaAtual: { fontSize: 11, color: '#8a94a0', textTransform: 'uppercase', marginBottom: 10, fontWeight: '700' },

  passagem: { marginBottom: 20 },
  tituloPassagem: { fontSize: 16, fontWeight: '800', color: '#1a3a5c', marginBottom: 8 },
  versiculo: { fontSize: 15, lineHeight: 24, color: '#263238', marginBottom: 4 },
  numeroVersiculo: { fontSize: 11, fontWeight: '800', color: '#7c3aed' },
});
