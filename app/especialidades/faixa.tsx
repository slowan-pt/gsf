import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  ActivityIndicator, Animated, Image, Modal, PanResponder, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { BottomNav } from '../../src/components/BottomNav';
import { CabecalhoTela } from '../../src/components/CabecalhoTela';
import { supabase } from '../../src/lib/supabase';
import { comIdadeAtual } from '../../src/lib/idade';
import {
  carregarCatalogoEspecialidades, carregarConquistasClube, normalizarNomeParaComparar,
  type EspecialidadeCatalogo,
} from '../../src/lib/especialidades';
import {
  ALTURA_IMG, IMAGEM_UNIFORME, LARGURA_IMG, disposicaoNaFaixa, uniformeDoMembro,
} from '../../src/lib/faixaUniforme';
import { useAuthStore } from '../../src/stores/authStore';
import { useContextoStore } from '../../src/stores/contextoStore';
import { useCores } from '../../src/stores/temaStore';
import { textoSobre } from '../../src/lib/tema';
import { SeloAguardando } from '../../src/components/SeloAguardando';
import { carregarAguardandoMembro } from '../../src/lib/aguardandoMembro';
import { getClubeAtivoId } from '../../src/lib/contextoAtual';

interface Membro { id: number; nome: string; genero: string | null; idade: number | null }
interface Conquista { nome: string; insignia: string | null; catalogo: EspecialidadeCatalogo | null; concluidaEm: string | null; aguardando: boolean }

/** Velocidade do giro automático da faixa (px/ms): bem devagar. */
const VELOCIDADE_AUTO = 0.014;

function ehMestrado(e: { nome: string; catalogo: EspecialidadeCatalogo | null }) {
  return /mestr/i.test(e.nome) || /mestr/i.test(e.catalogo?.categoria ?? '');
}

/** Mestrados primeiro; depois as demais áreas em ordem alfabética (sem área, por último); dentro da área, por nome. */
function organizarPorArea(lista: Conquista[]): Conquista[] {
  const peso = (c: Conquista) => (ehMestrado(c) ? 0 : (c.catalogo?.categoria ?? '').trim() ? 1 : 2);
  const area = (c: Conquista) => (ehMestrado(c) ? '' : (c.catalogo?.categoria ?? '').trim());
  return [...lista].sort((a, b) =>
    peso(a) - peso(b) || area(a).localeCompare(area(b), 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR'));
}

function dataBr(iso?: string | null) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

/** Tamanho (px da tela) do ícone: grande o bastante para tocar, sempre dentro da faixa. */
const ICONE_ALVO = 46;
/** Largura máxima da cena: em tela larga a foto não estica nem mostra bordas vazias. */
const LARGURA_MAXIMA = 480;
/** Cor da faixa: os ícones se dissolvem nela ao entrar sob a plaquinha do nome. */
const COR_FAIXA = '#021f1a';
/** Posição inicial da esteira (grande, para o módulo nunca ficar negativo ao rolar para os dois lados). */
const BASE_ESTEIRA = 1_000_000;

function IconeFaixa({ url, tamanho, aguardando = false }: { url: string | null; tamanho: number; aguardando?: boolean }) {
  const [erro, setErro] = useState(false);
  const corpo = url && !erro ? (
    <Image source={{ uri: url }} onError={() => setErro(true)} resizeMode="contain" style={{ width: tamanho, height: tamanho }} />
  ) : (
    <View style={{ width: tamanho * 0.9, height: tamanho * 0.9, borderRadius: tamanho * 0.45, backgroundColor: '#f2c14e', alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="ribbon" size={tamanho * 0.5} color="#432958" />
    </View>
  );
  if (!aguardando) return corpo;
  // Tarja de "aguardando" (investidura) sobre a parte de baixo do ícone.
  return (
    <View style={{ width: tamanho, height: tamanho, alignItems: 'center', justifyContent: 'center' }}>
      {corpo}
      <View style={{ position: 'absolute', left: -2, right: -2, bottom: tamanho * 0.08, height: Math.max(9, tamanho * 0.26), borderRadius: 4, backgroundColor: '#e8420f', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#fff' }}>
        <Text numberOfLines={1} style={{ color: '#fff', fontSize: Math.max(5.5, tamanho * 0.15), fontWeight: '900' }}>Aguardando</Text>
      </View>
    </View>
  );
}

/** Esmaece o conteúdo na cor da faixa, no topo da janela: os ícones somem sob a plaquinha do nome. */
function EsmaecerTopo({ altura, largura }: { altura: number; largura: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: largura, height: altura }}>
      <Svg width={largura} height={altura}>
        <Defs>
          <LinearGradient id="esmaecerTopo" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={COR_FAIXA} stopOpacity={1} />
            <Stop offset="1" stopColor={COR_FAIXA} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={largura} height={altura} fill="url(#esmaecerTopo)" />
      </Svg>
    </View>
  );
}

export default function FaixaEspecialidades() {
  const params = useLocalSearchParams<{ membro?: string }>();
  const usuario = useAuthStore((st) => st.usuario);
  const contextoAtivo = useContextoStore((st) => st.contextoAtivo);
  const cores = useCores();
  const membroId = Number(params.membro ?? contextoAtivo?.membro_id ?? usuario?.dbv_id ?? 0) || null;

  const [membro, setMembro] = useState<Membro | null>(null);
  const [itens, setItens] = useState<Conquista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberta, setAberta] = useState<Conquista | null>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });

  useFocusEffect(useCallback(() => {
    let ativo = true;
    (async () => {
      if (!membroId) { setCarregando(false); return; }
      try {
        const [{ data: m }, conquistas, catalogo, esperando] = await Promise.all([
          supabase.from('desbravadores').select('id,nome,genero,data_nascimento,idade').eq('id', membroId).maybeSingle(),
          carregarConquistasClube([membroId]),
          carregarCatalogoEspecialidades(true).catch(() => [] as EspecialidadeCatalogo[]),
          carregarAguardandoMembro(getClubeAtivoId(), membroId).catch(() => ({ classes: [], especialidades: [] as string[] })),
        ]);
        if (!ativo) return;
        if (m) {
          const comIdade = comIdadeAtual(m as any);
          setMembro({ id: Number(m.id), nome: String(m.nome ?? ''), genero: (m as any).genero ?? null, idade: comIdade.idade ?? null });
        }
        const porNome = new Map<string, EspecialidadeCatalogo>();
        for (const e of catalogo) {
          const k = normalizarNomeParaComparar(e.nome ?? '');
          if (e.insignia_url || !porNome.has(k)) porNome.set(k, e);
        }
        const ordenadas = [...conquistas].sort((a, b) =>
          String(b.marcado_em ?? b.updated_at ?? '').localeCompare(String(a.marcado_em ?? a.updated_at ?? '')));
        const vistos = new Set<string>();
        const lista: Conquista[] = [];
        for (const c of ordenadas) {
          const k = normalizarNomeParaComparar(c.nome);
          if (vistos.has(k)) continue;
          vistos.add(k);
          const cat = porNome.get(k) ?? null;
          lista.push({
            nome: c.nome, insignia: cat?.insignia_url ?? null, catalogo: cat,
            concluidaEm: (c.marcado_em ?? c.updated_at ?? null) as string | null,
            aguardando: esperando.especialidades.includes(k),
          });
        }
        setItens(organizarPorArea(lista));
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => { ativo = false; };
  }, [membroId]));

  const uniforme = uniformeDoMembro(membro?.genero, membro?.idade);
  const disp = useMemo(() => disposicaoNaFaixa(uniforme, itens.length), [uniforme, itens.length]);
  const larguraVista = Math.min(area.w, LARGURA_MAXIMA);
  const escala = Math.min(2.2, Math.max(0.8, ICONE_ALVO / disp.tamanho));
  const celula = disp.passo * escala;
  const larguraFaixa = celula * disp.colunas;

  const geo = useMemo(() => {
    const dir = disp.dir;
    const meiaFaixa = (larguraFaixa / 0.92) / 2;
    // O alto da bandeira vai para o canto superior esquerdo; a faixa desce na diagonal, como na foto.
    const xTopo = Math.max(10 + meiaFaixa * Math.abs(dir.y), larguraVista * 0.26);
    const yTopo = 34;
    const offX = xTopo - disp.topo.x * escala;
    const offY = yTopo - disp.topo.y * escala;
    const alt = disp.alturaBandeira * escala;
    const p0 = { x: xTopo + dir.x * alt, y: yTopo + dir.y * alt };
    const comp = Math.min(disp.comprimento * escala, Math.hypot(larguraVista, area.h));
    const centro = { x: p0.x + dir.x * comp / 2, y: p0.y + dir.y * comp / 2 };
    // Quantas linhas aparecem na tela (centro da linha dentro da área visível).
    let visiveis = 0;
    for (let r = 0; r * celula < comp; r++) {
      const px = p0.x + dir.x * (r + 0.5) * celula;
      const py = p0.y + dir.y * (r + 0.5) * celula;
      if (px >= 0 && px <= larguraVista && py >= 0 && py <= area.h) visiveis++;
    }
    return { dir, offX, offY, p0, comp, centro, linhasVisiveis: Math.max(1, visiveis) };
  }, [disp, escala, larguraFaixa, larguraVista, area.h, celula]);

  const capacidade = geo.linhasVisiveis * disp.colunas;
  const esteira = itens.length > capacidade;
  const linhasPorCopia = Math.ceil(itens.length / disp.colunas);
  const alturaCopia = Math.max(1, linhasPorCopia * celula);
  const copias = esteira ? Math.ceil(geo.comp / alturaCopia) + 1 : 1;

  // ---- esteira: arrastar (ou girar a roda do mouse) move os ícones ao longo da faixa, sem fim ----
  const pos = useRef(new Animated.Value(BASE_ESTEIRA)).current;
  const posAtual = useRef(BASE_ESTEIRA);
  const ultimo = useRef({ dx: 0, dy: 0 });
  const refs = useRef({ esteira: false, dir: { x: 0.54, y: 0.84 } });
  refs.current = { esteira, dir: geo.dir };
  const faixaRef = useRef<any>(null);
  const girando = useRef(true);
  const parar = useCallback(() => { girando.current = false; }, []);

  useEffect(() => {
    const id = pos.addListener(({ value }) => { posAtual.current = value; });
    return () => pos.removeListener(id);
  }, [pos]);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_e, g) => refs.current.esteira && Math.hypot(g.dx, g.dy) > 6,
    onPanResponderGrant: () => { girando.current = false; pos.stopAnimation(); ultimo.current = { dx: 0, dy: 0 }; },
    onPanResponderMove: (_e, g) => {
      const d = refs.current.dir;
      const ddx = g.dx - ultimo.current.dx;
      const ddy = g.dy - ultimo.current.dy;
      ultimo.current = { dx: g.dx, dy: g.dy };
      // O conteúdo acompanha o dedo: arrastar para baixo da faixa traz os ícones de cima.
      pos.setValue(posAtual.current - (ddx * d.x + ddy * d.y));
    },
    onPanResponderRelease: (_e, g) => {
      const d = refs.current.dir;
      const v = -(g.vx * d.x + g.vy * d.y);
      if (Math.abs(v) > 0.05) Animated.decay(pos, { velocity: v, deceleration: 0.996, useNativeDriver: false }).start();
    },
  })).current;

  // Carrossel automático, bem devagar; qualquer toque (ou giro da roda) na faixa para de vez.
  useEffect(() => {
    if (!esteira) return;
    let anterior = Date.now();
    const id = setInterval(() => {
      const agora = Date.now();
      const dt = Math.min(200, agora - anterior);
      anterior = agora;
      if (girando.current) pos.setValue(posAtual.current + VELOCIDADE_AUTO * dt);
    }, 24);
    return () => clearInterval(id);
  }, [esteira, pos]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const no = faixaRef.current as any;
    if (!no?.addEventListener) return;
    const aoGirar = (e: WheelEvent) => {
      if (!refs.current.esteira) return;
      e.preventDefault();
      parar();
      pos.stopAnimation();
      pos.setValue(posAtual.current + e.deltaY * 0.8);
    };
    no.addEventListener('wheel', aoGirar, { passive: false });
    return () => no.removeEventListener('wheel', aoGirar);
  }, [pos, esteira, area.h, itens.length]);

  const translacao = Animated.multiply(Animated.modulo(pos, alturaCopia), -1);

  function linhas(copia: number) {
    const rows: ReactElement[] = [];
    for (let r = 0; r < linhasPorCopia; r++) {
      const celulas: ReactElement[] = [];
      for (let j = 0; j < disp.colunas; j++) {
        const e = itens[r * disp.colunas + j];
        celulas.push(
          <View key={j} style={{ width: celula, height: celula, alignItems: 'center', justifyContent: 'center' }}>
            {e ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setAberta(e)}
                accessibilityRole="button"
                accessibilityLabel={`Especialidade ${e.nome}`}
                style={{ width: celula, height: celula, alignItems: 'center', justifyContent: 'center' }}
              >
                <IconeFaixa url={e.insignia} tamanho={disp.tamanho * escala} aguardando={e.aguardando} />
              </TouchableOpacity>
            ) : null}
          </View>,
        );
      }
      rows.push(<View key={`${copia}-${r}`} style={{ flexDirection: 'row', height: celula }}>{celulas}</View>);
    }
    return rows;
  }

  if (!usuario) return <Redirect href="/auth/login" />;

  return (
    <View style={[st.container, { backgroundColor: cores.fundo }]}>
      <CabecalhoTela
        titulo="Minhas especialidades"
        subtitulo={membro ? `${membro.nome} · ${itens.length} ${itens.length === 1 ? 'especialidade' : 'especialidades'}` : undefined}
        aoVoltar={() => (router.canGoBack() ? router.back() : router.replace('/' as any))}
      />

      {carregando ? (
        <ActivityIndicator size="large" color={cores.primaria} style={{ marginTop: 40 }} />
      ) : itens.length === 0 ? (
        <View style={st.vazio}>
          <Ionicons name="ribbon-outline" size={46} color={cores.textoSecundario} />
          <Text style={[st.vazioTitulo, { color: cores.texto }]}>Nenhuma especialidade ainda</Text>
          <Text style={[st.vazioSub, { color: cores.textoSecundario }]}>Quando uma especialidade for concluída, o ícone aparece na faixa.</Text>
        </View>
      ) : (
        <View style={{ flex: 1, alignItems: 'center' }} onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          {area.h > 0 ? (
            <View style={{ width: larguraVista, height: area.h, overflow: 'hidden' }}>
              <Image
                source={IMAGEM_UNIFORME[uniforme]}
                resizeMode="stretch"
                accessibilityIgnoresInvertColors
                style={{ position: 'absolute', left: geo.offX, top: geo.offY, width: LARGURA_IMG * escala, height: ALTURA_IMG * escala }}
              />
              {/* Janela da faixa: girada como a faixa da foto; só o que está sobre o verde aparece. */}
              <View
                ref={faixaRef}
                onTouchStart={parar}
                {...(Platform.OS === 'web' ? ({ onMouseDown: parar } as any) : {})}
                {...(esteira ? pan.panHandlers : {})}
                style={{
                  position: 'absolute', overflow: 'hidden',
                  left: geo.centro.x - larguraFaixa / 2, top: geo.centro.y - geo.comp / 2, width: larguraFaixa, height: geo.comp,
                  transform: [{ rotate: `${disp.giroGraus}deg` }],
                }}
              >
                <Animated.View style={{ width: larguraFaixa, transform: [{ translateY: esteira ? translacao : 0 }] }}>
                  {Array.from({ length: copias }, (_, c) => linhas(c))}
                </Animated.View>
                {esteira ? <EsmaecerTopo altura={celula * 0.8} largura={larguraFaixa} /> : null}
              </View>
            </View>
          ) : null}
        </View>
      )}

      <Modal visible={!!aberta} transparent animationType="fade" onRequestClose={() => setAberta(null)}>
        <View style={[st.fundoModal, { backgroundColor: cores.overlay }]}>
          <View style={[st.caixa, { backgroundColor: cores.cartao }]}>
            <View style={st.caixaTopo}>
              <IconeFaixa url={aberta?.insignia ?? null} tamanho={56} />
              <View style={{ flex: 1 }}>
                <Text style={[st.caixaTitulo, { color: cores.texto }]}>{aberta?.nome}</Text>
                {aberta?.catalogo?.categoria ? <Text style={[st.caixaSub, { color: cores.textoSecundario }]}>{aberta.catalogo.categoria}</Text> : null}
                {dataBr(aberta?.concluidaEm) ? <Text style={[st.caixaSub, { color: cores.textoSecundario }]}>Concluída em {dataBr(aberta?.concluidaEm)}</Text> : null}
                {aberta?.aguardando ? <View style={{ alignSelf: 'flex-start', marginTop: 6 }}><SeloAguardando compacto tipo="investidura" /></View> : null}
              </View>
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              {aberta?.catalogo?.pre_requisitos ? (
                <>
                  <Text style={[st.rotulo, { color: cores.textoSecundario }]}>Pré-requisitos</Text>
                  <Text style={[st.texto, { color: cores.texto }]}>{aberta.catalogo.pre_requisitos}</Text>
                </>
              ) : null}
              <Text style={[st.rotulo, { color: cores.textoSecundario }]}>Requisitos</Text>
              <Text style={[st.texto, { color: cores.texto }]}>{aberta?.catalogo?.requisitos || 'Os requisitos desta especialidade ainda não estão cadastrados.'}</Text>
              {aberta?.catalogo?.observacoes ? (
                <>
                  <Text style={[st.rotulo, { color: cores.textoSecundario }]}>Observações</Text>
                  <Text style={[st.texto, { color: cores.texto }]}>{aberta.catalogo.observacoes}</Text>
                </>
              ) : null}
            </ScrollView>
            <TouchableOpacity style={[st.fechar, { backgroundColor: cores.primaria }]} onPress={() => setAberta(null)} accessibilityRole="button">
              <Text style={{ color: textoSobre(cores.primaria), fontWeight: '900' }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <BottomNav />
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  vazio: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  vazioTitulo: { fontSize: 17, fontWeight: '900', textAlign: 'center' },
  vazioSub: { fontSize: 13, textAlign: 'center' },
  fundoModal: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18 },
  caixa: { width: '100%', maxWidth: 460, borderRadius: 20, padding: 18, gap: 8 },
  caixaTopo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  caixaTitulo: { fontSize: 17, fontWeight: '900' },
  caixaSub: { fontSize: 12, marginTop: 2 },
  rotulo: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginTop: 10, marginBottom: 4 },
  texto: { fontSize: 14, lineHeight: 20 },
  fechar: { minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
});
