import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, Animated, Platform, Image, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCores } from '../stores/temaStore';
import { useAuthStore } from '../stores/authStore';
import { useContextoStore } from '../stores/contextoStore';
import { supabase } from '../lib/supabase';
import { getClubeAtivoId, getProgramaAtivoId } from '../lib/contextoAtual';
import { estiloCartao, type CoresTema } from '../lib/tema';
import {
  carregarProgressoClube, carregarResumoCatalogoClasses, idadePorNascimento, imagemDaClasse,
  organizarClassesParaExibicao, resumirPorClasseSeparado, type ResumoClasseSeparado,
} from '../lib/classesRequisitos';
import { carregarConquistasClube } from '../lib/especialidades';

type Situacao = 'concluida' | 'andamento' | 'nao_iniciada';

function situacaoDe(r: ResumoClasseSeparado): Situacao {
  if (r.total > 0 && r.concluidos >= r.total) return 'concluida';
  if (r.concluidos > 0) return 'andamento';
  return 'nao_iniciada';
}

function useDbvAtual() {
  const usuario = useAuthStore((s) => s.usuario);
  const contextoAtivo = useContextoStore((s) => s.contextoAtivo);
  return contextoAtivo?.membro_id ?? usuario?.dbv_id ?? null;
}

function useMovimentoReduzido() {
  const [reduzido, setReduzido] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduzido).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduzido);
    return () => sub?.remove?.();
  }, []);
  return reduzido;
}

function CabecalhoSecao({ titulo, cores }: { titulo: string; cores: CoresTema }) {
  return <Text style={[s.secao, { color: cores.texto }]} accessibilityRole="header">{titulo}</Text>;
}

/* ─── Carrossel único de classes (regulares → avançadas → líderes) ─────────── */
export function ClassesCarrossel() {
  const cores = useCores();
  const dbvId = useDbvAtual();
  const reduzido = useMovimentoReduzido();
  const [itens, setItens] = useState<ResumoClasseSeparado[] | null>(null);
  const [semImagem, setSemImagem] = useState<Record<string, boolean>>({});
  const scroll = useRef<ScrollView>(null);
  const medidas = useRef({ x: 0, conteudo: 0, visivel: 0 });
  const [noFim, setNoFim] = useState(false);
  const largura = useRef(new Animated.Value(40)).current;

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      (async () => {
        if (!dbvId) { setItens(null); return; }
        try {
          const clubeId = getClubeAtivoId();
          const [cat, progresso, { data: m }] = await Promise.all([
            carregarResumoCatalogoClasses(),
            carregarProgressoClube(clubeId, [dbvId]),
            supabase.from('desbravadores').select('data_nascimento').eq('id', dbvId).maybeSingle(),
          ]);
          const concluidos = new Set(progresso.map((p) => p.requisito_id));
          const idade = idadePorNascimento((m as any)?.data_nascimento);
          const resumos = resumirPorClasseSeparado(cat, concluidos, idade);
          const regulares = organizarClassesParaExibicao(resumos, 'regular', idade);
          const lista = [
            ...regulares.filter((r) => !r.avancada),
            ...regulares.filter((r) => r.avancada),
            ...organizarClassesParaExibicao(resumos, 'agrupada', idade),
            ...organizarClassesParaExibicao(resumos, 'lider', idade),
          ];
          if (ativo) setItens(lista);
        } catch {
          if (ativo) setItens(null);
        }
      })();
      return () => { ativo = false; };
    }, [dbvId])
  );

  const atualizarFim = useCallback(() => {
    const { x, conteudo, visivel } = medidas.current;
    const fim = conteudo > visivel && x + visivel >= conteudo - 4;
    setNoFim((anterior) => (anterior === fim ? anterior : fim));
  }, []);

  useEffect(() => {
    Animated.timing(largura, { toValue: noFim ? 104 : 40, duration: reduzido ? 0 : 220, useNativeDriver: false }).start();
  }, [noFim, reduzido, largura]);

  if (!itens || itens.length === 0) return null;

  function aoRolar(e: NativeSyntheticEvent<NativeScrollEvent>) {
    medidas.current.x = e.nativeEvent.contentOffset.x;
    atualizarFim();
  }

  function aoPressionarSeta() {
    if (noFim) { router.push('/classes' as any); return; }
    const { x, visivel } = medidas.current;
    scroll.current?.scrollTo({ x: x + visivel * 0.8, animated: !reduzido });
  }

  return (
    <View style={s.bloco}>
      <CabecalhoSecao titulo="Classes" cores={cores} />
      <View>
        <ScrollView
          ref={scroll}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.carrossel}
          scrollEventThrottle={16}
          onScroll={aoRolar}
          onLayout={(e: LayoutChangeEvent) => { medidas.current.visivel = e.nativeEvent.layout.width; atualizarFim(); }}
          onContentSizeChange={(w) => { medidas.current.conteudo = w; atualizarFim(); }}
        >
          {itens.map((r) => {
            const sit = situacaoDe(r);
            const img = semImagem[r.chave] ? null : imagemDaClasse(r.classe, r.avancada);
            const concluida = sit === 'concluida';
            const nao = sit === 'nao_iniciada';
            return (
              <TouchableOpacity
                key={r.chave}
                activeOpacity={0.85}
                onPress={() => router.push('/classes' as any)}
                accessibilityRole="button"
                accessibilityLabel={`${r.label}: ${concluida ? 'concluída' : sit === 'andamento' ? `em andamento, ${r.pct}%` : 'não iniciada'}`}
                style={[
                  s.cartaoClasse,
                  estiloCartao(cores),
                  nao && { backgroundColor: cores.isEscuro ? '#26223a' : '#ebe9f1', shadowOpacity: 0.05 },
                  concluida && { borderWidth: 2, borderColor: '#2e9d57' },
                  sit === 'andamento' && { borderWidth: 2, borderColor: cores.acento },
                ]}
              >
                {img ? (
                  <Image
                    source={img}
                    style={[s.emblema, nao && { opacity: 0.55 }, nao && Platform.OS === 'web' ? ({ filter: 'grayscale(1)' } as any) : null]}
                    resizeMode="contain"
                    onError={() => setSemImagem((a) => ({ ...a, [r.chave]: true }))}
                  />
                ) : (
                  <View style={[s.emblema, s.emblemaVazio, { backgroundColor: cores.acentoSuave }]}>
                    <Ionicons name="ribbon" size={28} color={cores.acento} />
                  </View>
                )}
                <Text style={[s.nomeClasse, { color: nao ? cores.textoSecundario : cores.texto }]} numberOfLines={2}>{r.label}</Text>
                <Text style={[s.statusClasse, { color: concluida ? '#2e9d57' : sit === 'andamento' ? cores.acento : cores.textoSecundario }]}>
                  {concluida ? 'Concluída' : sit === 'andamento' ? `${r.pct}%` : 'Não iniciada'}
                </Text>
                {concluida ? (
                  <View style={s.selo}><Ionicons name="checkmark" size={12} color="#fff" /></View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <Animated.View style={[s.setaWrap, { width: largura }]}>
          <TouchableOpacity
            onPress={aoPressionarSeta}
            accessibilityRole="button"
            accessibilityLabel={noFim ? 'Ver todas as classes' : 'Avançar classes'}
            style={[s.seta, { backgroundColor: cores.acento }]}
          >
            {noFim ? <Text style={[s.setaTexto, { color: cores.isEscuro ? '#1a1033' : '#fff' }]} numberOfLines={1}>Ver todas</Text> : null}
            {!noFim ? <Ionicons name="chevron-forward" size={20} color={cores.isEscuro ? '#1a1033' : '#fff'} /> : null}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

/* ─── Especialidades conquistadas (mais recentes primeiro) ─────────────────── */
interface EspConquistada { nome: string; insignia: string | null }

export function EspecialidadesConquistadas() {
  const cores = useCores();
  const dbvId = useDbvAtual();
  const [itens, setItens] = useState<EspConquistada[]>([]);
  const [semImagem, setSemImagem] = useState<Record<string, boolean>>({});

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      (async () => {
        if (!dbvId) { setItens([]); return; }
        try {
          const conquistas = await carregarConquistasClube([dbvId]);
          const ordenadas = [...conquistas].sort((a, b) =>
            String(b.marcado_em ?? b.updated_at ?? '').localeCompare(String(a.marcado_em ?? a.updated_at ?? '')));
          const nomes = Array.from(new Set(ordenadas.map((c) => c.nome)));
          if (nomes.length === 0) { if (ativo) setItens([]); return; }
          const { data } = await supabase
            .from('especialidades_modelo')
            .select('nome,insignia_url')
            .eq('programa_id', getProgramaAtivoId())
            .in('nome', nomes);
          const insignias = new Map<string, string | null>((data ?? []).map((e: any) => [e.nome, e.insignia_url]));
          if (ativo) setItens(nomes.map((nome) => ({ nome, insignia: insignias.get(nome) ?? null })));
        } catch {
          if (ativo) setItens([]);
        }
      })();
      return () => { ativo = false; };
    }, [dbvId])
  );

  if (itens.length === 0) return null;

  return (
    <View style={s.bloco}>
      <View style={s.linhaTitulo}>
        <CabecalhoSecao titulo="Especialidades conquistadas" cores={cores} />
        <TouchableOpacity onPress={() => router.push('/especialidades' as any)} accessibilityRole="link" accessibilityLabel="Ver todas as especialidades">
          <Text style={[s.verTodas, { color: cores.acento }]}>Ver todas</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carrossel}>
        {itens.map((e) => (
          <TouchableOpacity
            key={e.nome}
            activeOpacity={0.85}
            onPress={() => router.push('/especialidades' as any)}
            style={s.espItem}
            accessibilityRole="button"
            accessibilityLabel={`Especialidade ${e.nome}`}
          >
            <View style={[s.espIcone, estiloCartao(cores), { borderRadius: 28 }]}>
              {e.insignia && !semImagem[e.nome] ? (
                <Image source={{ uri: e.insignia }} style={s.espImagem} resizeMode="contain" onError={() => setSemImagem((a) => ({ ...a, [e.nome]: true }))} />
              ) : (
                <Ionicons name="medal" size={24} color={cores.acento} />
              )}
            </View>
            <Text style={[s.espNome, { color: cores.texto }]} numberOfLines={2}>{e.nome}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  bloco: { marginTop: 20 },
  secao: { fontSize: 17, fontWeight: '800', marginBottom: 10 },
  linhaTitulo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  verTodas: { fontSize: 13, fontWeight: '800' },
  carrossel: { gap: 12, paddingBottom: 14, paddingRight: 56, paddingLeft: 2, paddingTop: 2 },
  cartaoClasse: { width: 116, padding: 10, alignItems: 'center', gap: 4 },
  emblema: { width: 72, height: 72 },
  emblemaVazio: { borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  nomeClasse: { fontSize: 12, fontWeight: '800', textAlign: 'center', minHeight: 30 },
  statusClasse: { fontSize: 11, fontWeight: '700' },
  selo: { position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#2e9d57', alignItems: 'center', justifyContent: 'center' },
  setaWrap: { position: 'absolute', right: 0, top: 50, height: 40, overflow: 'hidden' },
  seta: { flex: 1, borderRadius: 20, alignItems: 'center', justifyContent: 'center', minWidth: 40, minHeight: 40 },
  setaTexto: { fontSize: 12, fontWeight: '800' },
  espItem: { width: 76, alignItems: 'center', gap: 6 },
  espIcone: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  espImagem: { width: 40, height: 40 },
  espNome: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
});
