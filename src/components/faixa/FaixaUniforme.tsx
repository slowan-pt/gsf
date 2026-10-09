import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  ActivityIndicator, Animated, Image, Modal, PanResponder, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { comIdadeAtual } from '../../lib/idade';
import {
  carregarCatalogoEspecialidades, carregarConquistasClube, normalizarNomeParaComparar,
  type EspecialidadeCatalogo,
} from '../../lib/especialidades';
import {
  ALTURA_IMG, FILETE_LENCO_LIDER, LARGURA_IMG, TONS_PELE, disposicaoNaFaixa, disposicaoPeito, imagemDoUniforme, uniformeDoMembro,
} from '../../lib/faixaUniforme';
import { carregarClassesConquistadas, type ClassesConquistadas } from '../../lib/faixaClasses';
import { InsigniasPeito, type InsigniaAberta } from './InsigniasPeito';
import { useAuthStore } from '../../stores/authStore';
import { useContextoStore } from '../../stores/contextoStore';
import { useCores } from '../../stores/temaStore';
import { textoSobre } from '../../lib/tema';
import { SeloAguardando } from '../SeloAguardando';
import { carregarAguardandoMembro } from '../../lib/aguardandoMembro';
import { getClubeAtivoId } from '../../lib/contextoAtual';
import { usePermissoes } from '../../lib/permissoes';
import { avisar } from '../../stores/avisoStore';
import {
  carregarFaixaMestrados, chaveEspecialidade, salvarTomPele,
  type FaixaMestrados, type MestradoNaFaixa,
} from '../../lib/mestrados';
import {
  type Membro, type Conquista, type LinhaFaixa, VELOCIDADE_AUTO, organizarPorArea, montarLinhas, nomeNaTarja, dataBr, ICONE_ALVO, LARGURA_MAXIMA, COR_FAIXA, BASE_ESTEIRA, IconeFaixa, DivisorMestrado, EsmaecerTopo,
} from './pecas';

interface Props {
  membroId: number | null;
  /** Especialidades (faixa verde) ou Classes (lado esquerdo da camisa). */
  modo: 'especialidades' | 'classes';
  /** Altura fixa (dentro da ficha); sem ela ocupa o espaço disponível da tela. */
  altura?: number;
}

/**
 * O uniforme ilustrado do membro: na faixa verde ficam as especialidades (com os mestrados como
 * divisórias) e, no lado esquerdo da camisa, as insígnias das classes. Usado na página da faixa
 * e dentro da ficha do membro.
 */
export function FaixaUniforme({ membroId, modo, altura }: Props) {
  const usuario = useAuthStore((st) => st.usuario);
  const contextoAtivo = useContextoStore((st) => st.contextoAtivo);
  const cores = useCores();

  const [membro, setMembro] = useState<Membro | null>(null);
  const [itens, setItens] = useState<Conquista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberta, setAberta] = useState<Conquista | null>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [faixaM, setFaixaM] = useState<FaixaMestrados>({ mestrados: [], grupos: {} });
  const [tomSalvo, setTomSalvo] = useState<number | null>(null);
  const [tomPrevia, setTomPrevia] = useState<number | null>(null);
  const [painelTom, setPainelTom] = useState(false);
  const [salvandoTom, setSalvandoTom] = useState(false);
  const permissoes = usePermissoes();
  const [classes, setClasses] = useState<ClassesConquistadas>({ chaves: new Set(), ehLider: false });
  const [insigniaAberta, setInsigniaAberta] = useState<InsigniaAberta | null>(null);

  useFocusEffect(useCallback(() => {
    let ativo = true;
    (async () => {
      if (!membroId) { setCarregando(false); return; }
      try {
        const [{ data: m }, conquistas, catalogo, esperando, mestradosFaixa, tomRes] = await Promise.all([
          supabase.from('desbravadores').select('id,nome,genero,data_nascimento,idade').eq('id', membroId).maybeSingle(),
          carregarConquistasClube([membroId]),
          carregarCatalogoEspecialidades(true).catch(() => [] as EspecialidadeCatalogo[]),
          carregarAguardandoMembro(getClubeAtivoId(), membroId).catch(() => ({ classes: [], especialidades: [] as string[] })),
          carregarFaixaMestrados(membroId),
          // Em consulta à parte: sem a migration 137 a coluna não existe e a faixa continua funcionando.
          Promise.resolve(supabase.from('desbravadores').select('tom_pele').eq('id', membroId).maybeSingle()).catch(() => ({ data: null })),
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
        setFaixaM(mestradosFaixa);
        const tom = Number((tomRes as any)?.data?.tom_pele ?? 0);
        setTomSalvo(tom >= 1 && tom <= TONS_PELE.length ? tom : null);
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => { ativo = false; };
  }, [membroId]));

  // Classes conquistadas (para as insígnias do uniforme e a filetinha do lenço de líder).
  useEffect(() => {
    if (!membro) return;
    let ativo = true;
    carregarClassesConquistadas(membro.id, membro.idade)
      .then((c) => { if (ativo) setClasses(c); })
      .catch(() => {});
    return () => { ativo = false; };
  }, [membro?.id, membro?.idade]);

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

  // Na aba Classes a foto é enquadrada no lado esquerdo da camisa (bolso, insígnias e passador do lenço).
  const noPeito = modo === 'classes';
  const peito = useMemo(() => disposicaoPeito(uniforme), [uniforme]);
  const escalaPeito = larguraVista > 0 ? larguraVista / (peito.vista.x1 - peito.vista.x0) : 1;
  const escalaCena = noPeito ? escalaPeito : escala;
  const cenaX = noPeito ? -peito.vista.x0 * escalaPeito : geo.offX;
  const cenaY = noPeito ? -peito.vista.y0 * escalaPeito : geo.offY;
  const tarjaNome = nomeNaTarja(membro?.nome ?? '', disp.tarja.comp * escalaCena * 0.86, disp.tarja.alt * escalaCena * 0.9);
  // Divisórias (mestrados) e fileiras de especialidades; o mestrado ocupa uma fileira mais alta.
  const linhasModelo = useMemo(() => montarLinhas(itens, faixaM, disp.colunas), [itens, faixaM, disp.colunas]);
  const alturaDivisor = celula * 1.7;
  const alturaCopia = Math.max(1, linhasModelo.reduce((soma, l) => soma + (l.tipo === 'divisor' ? alturaDivisor : celula), 0));
  const esteira = alturaCopia / celula > geo.linhasVisiveis;
  const copias = esteira ? Math.ceil(geo.comp / alturaCopia) + 1 : 1;
  const ehProprio = !!membro && membro.id === Number(contextoAtivo?.membro_id ?? usuario?.dbv_id ?? -1);
  const podePersonalizar = !!membro && (ehProprio || permissoes.pode('gerenciar_membros'));
  const tomExibido = painelTom ? tomPrevia : tomSalvo;

  function abrirPainelTom() { setTomPrevia(tomSalvo); setPainelTom(true); }
  function cancelarTom() { setPainelTom(false); setTomPrevia(tomSalvo); }
  async function salvarTom() {
    if (!membro) return;
    setSalvandoTom(true);
    try {
      await salvarTomPele(membro.id, tomPrevia);
      setTomSalvo(tomPrevia);
      setPainelTom(false);
      avisar('Personalização salva no seu perfil.', 'sucesso', 'Salvo');
    } catch (e: any) {
      // Só confirma quando realmente salvou: aqui a escolha continua como estava no banco.
      avisar(e?.message ?? 'Não foi possível salvar a personalização.', 'erro', 'Não salvou');
    } finally {
      setSalvandoTom(false);
    }
  }

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
    onPanResponderTerminationRequest: () => false,
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
    return linhasModelo.map((l, r) => {
      if (l.tipo === 'divisor') {
        return <DivisorMestrado key={`${copia}-d${l.mestrado.id}`} m={l.mestrado} largura={larguraFaixa} altura={alturaDivisor} />;
      }
      const celulas = Array.from({ length: disp.colunas }, (_, j) => {
        const e = l.itens[j];
        return (
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
          </View>
        );
      });
      return <View key={`${copia}-${r}`} style={{ flexDirection: 'row', height: celula }}>{celulas}</View>;
    });
  }

  return (
    <View style={altura ? { height: altura } : { flex: 1 }}>
      {carregando ? (
        <ActivityIndicator size="large" color={cores.primaria} style={{ marginTop: 40 }} />
      ) : itens.length === 0 && !noPeito ? (
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
                source={imagemDoUniforme(uniforme, tomExibido)}
                resizeMode="stretch"
                accessibilityIgnoresInvertColors
                style={{ position: 'absolute', left: cenaX, top: cenaY, width: LARGURA_IMG * escalaCena, height: ALTURA_IMG * escalaCena }}
              />
              {/* Quem já é líder tem a filetinha vermelha no lenço (camada transparente sobre a foto). */}
              {classes.ehLider ? (
                <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
                  <Image
                    source={FILETE_LENCO_LIDER[uniforme]}
                    resizeMode="stretch"
                    style={{ position: 'absolute', left: cenaX, top: cenaY, width: LARGURA_IMG * escalaCena, height: ALTURA_IMG * escalaCena }}
                  />
                </View>
              ) : null}
              {/* Nome do membro na tarja branca, com a mesma inclinação da tarja da foto. */}
              {membro?.nome ? (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute', alignItems: 'center', justifyContent: 'center',
                    left: cenaX + disp.tarja.cx * escalaCena - (disp.tarja.comp * escalaCena * 0.9) / 2,
                    top: cenaY + disp.tarja.cy * escalaCena - (disp.tarja.alt * escalaCena * 0.9) / 2,
                    width: disp.tarja.comp * escalaCena * 0.9, height: disp.tarja.alt * escalaCena * 0.9,
                    transform: [{ rotate: `${disp.tarja.angulo}deg` }],
                  }}
                >
                  <Text numberOfLines={1} style={{ color: '#1f2933', fontWeight: '800', letterSpacing: 0.4, fontSize: tarjaNome.tamanho }}>{tarjaNome.texto}</Text>
                </View>
              ) : null}
              {noPeito ? (
                <InsigniasPeito chave={uniforme} conquistadas={classes.chaves} escala={escalaPeito} offX={cenaX} offY={cenaY} aoAbrir={setInsigniaAberta} />
              ) : null}
              {/* Janela da faixa: girada como a faixa da foto; só o que está sobre o verde aparece. */}
              <View
                ref={faixaRef}
                onTouchStart={parar}
                {...(Platform.OS === 'web' ? ({ onMouseDown: parar } as any) : {})}
                {...(esteira ? pan.panHandlers : {})}
                style={{
                  position: 'absolute', overflow: 'hidden', display: noPeito ? 'none' : 'flex',
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

          {podePersonalizar && area.h > 0 && !painelTom ? (
            <TouchableOpacity
              onPress={abrirPainelTom}
              accessibilityRole="button"
              accessibilityLabel="Personalizar o tom de pele"
              style={[st.fab, { backgroundColor: cores.cartao, borderColor: cores.borda }]}
            >
              <Ionicons name="color-palette" size={20} color={cores.acento} />
              <Text style={{ color: cores.texto, fontSize: 12, fontWeight: '800' }}>Tom de pele</Text>
            </TouchableOpacity>
          ) : null}

          {painelTom ? (
            <View style={[st.painel, { backgroundColor: cores.cartao, borderColor: cores.borda }]}>
              <Text style={[st.painelTitulo, { color: cores.texto }]}>Tom de pele da sua figura</Text>
              <View style={st.amostras}>
                {TONS_PELE.map((cor, i) => {
                  const ativo = tomPrevia === i + 1;
                  return (
                    <TouchableOpacity
                      key={cor}
                      onPress={() => setTomPrevia(i + 1)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: ativo }}
                      accessibilityLabel={`Tom ${i + 1} de ${TONS_PELE.length}`}
                      style={[st.amostra, { backgroundColor: cor, borderColor: ativo ? cores.acento : cores.borda, borderWidth: ativo ? 3 : 1 }]}
                    >
                      {ativo ? <Ionicons name="checkmark" size={16} color={i < 4 ? '#432958' : '#fff'} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity onPress={() => setTomPrevia(null)} accessibilityRole="button" style={{ alignSelf: 'flex-start', marginBottom: 8 }}>
                <Text style={{ color: tomPrevia == null ? cores.acento : cores.textoSecundario, fontSize: 12, fontWeight: '800' }}>
                  {tomPrevia == null ? '✓ ' : ''}Padrão
                </Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity style={[st.painelBotao, { flex: 1, backgroundColor: cores.fundo }]} onPress={cancelarTom} disabled={salvandoTom} accessibilityRole="button">
                  <Text style={{ color: cores.texto, fontWeight: '800' }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.painelBotao, { flex: 2, backgroundColor: cores.primaria }, salvandoTom && { opacity: 0.6 }]} onPress={salvarTom} disabled={salvandoTom} accessibilityRole="button">
                  {salvandoTom ? <ActivityIndicator color="#fff" /> : <Text style={{ color: textoSobre(cores.primaria), fontWeight: '900' }}>Salvar personalização</Text>}
                </TouchableOpacity>
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

      <Modal visible={!!insigniaAberta} transparent animationType="fade" onRequestClose={() => setInsigniaAberta(null)}>
        <View style={[st.fundoModal, { backgroundColor: cores.overlay }]}>
          <View style={[st.caixa, { backgroundColor: cores.cartao, alignItems: 'center' }]}>
            {insigniaAberta ? <Image source={insigniaAberta.imagem} resizeMode="contain" style={{ width: 150, height: 110 }} /> : null}
            <Text style={[st.caixaTitulo, { color: cores.texto, textAlign: 'center' }]}>{insigniaAberta?.nome}</Text>
            <Text style={[st.caixaSub, { color: cores.textoSecundario, textAlign: 'center' }]}>{insigniaAberta?.avancada ? 'Classe avançada' : 'Classe'} conquistada</Text>
            <TouchableOpacity style={[st.fechar, { backgroundColor: cores.primaria, alignSelf: 'stretch' }]} onPress={() => setInsigniaAberta(null)} accessibilityRole="button">
              <Text style={{ color: textoSobre(cores.primaria), fontWeight: '900' }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  fab: { position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1, boxShadow: '0px 3px 0px rgba(0,0,0,0.25)' },
  painel: { position: 'absolute', left: 10, right: 10, bottom: 10, padding: 14, borderRadius: 20, borderWidth: 1, boxShadow: '0px 4px 0px rgba(0,0,0,0.25)' },
  painelTitulo: { fontSize: 14, fontWeight: '900', marginBottom: 10 },
  amostras: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, marginBottom: 10 },
  amostra: { flex: 1, aspectRatio: 1, maxWidth: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  painelBotao: { minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
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
