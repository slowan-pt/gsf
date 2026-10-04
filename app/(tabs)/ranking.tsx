import { useState, useCallback, useRef } from 'react';
import { ActivityIndicator, Animated, View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { usePontuacaoStore } from '../../src/stores/pontuacaoStore';
import { useAuthStore } from '../../src/stores/authStore';
import { useRealtime } from '../../src/lib/realtime';
import { Avatar, avatarCor } from '../../src/components/common/Avatar';
import { CarregandoAcampamento } from '../../src/components/common/CarregandoAcampamento';
import { getClubeAtivoId } from '../../src/lib/contextoAtual';
import { usePermissoes } from '../../src/lib/permissoes';
import { anosEfetivosRanking, carregarConfigRanking, CONFIG_RANKING_RESTRITA, type ConfigRanking } from '../../src/lib/rankingConfig';
import { useCores, useCorCabecalho } from '../../src/stores/temaStore';
import { corIcone, estiloCartao, tomTexto } from '../../src/lib/tema';
import { carregarExtratoMembro, type ExtratoMembro, type RegistroDia } from '../../src/lib/extratoMembro';
import { CabecalhoTela } from '../../src/components/CabecalhoTela';
import { CenaAcampamento, PodioCartao, usePulso } from '../../src/components/RankingExtras';
import { EstadoVazio, Segmentado, TituloSecao } from '../../src/components/ui';

type Aba = 'dbvs' | 'conselheiros' | 'diretoria' | 'unidades';

const ABAS_RANKING: { key: Aba; label: string; tipoDiretoria: keyof ConfigRanking; tipoMembros: keyof ConfigRanking }[] = [
  { key: 'dbvs',         label: 'Desbrav.',     tipoDiretoria: 'diretoria_tipo_dbv',         tipoMembros: 'membros_tipo_dbv' },
  { key: 'conselheiros', label: 'Conselheiros', tipoDiretoria: 'diretoria_tipo_conselheiros', tipoMembros: 'membros_tipo_conselheiros' },
  { key: 'diretoria',    label: 'Diretoria',    tipoDiretoria: 'diretoria_tipo_diretoria',    tipoMembros: 'membros_tipo_diretoria' },
  { key: 'unidades',     label: 'Unidades',     tipoDiretoria: 'diretoria_tipo_unidades',     tipoMembros: 'membros_tipo_unidades' },
];

interface RankingItem {
  dbv_id?: number;
  unidade_id?: number | null;
  nome: string;
  unidade?: string;
  total: number;
  total_membros?: number;
  total_direto?: number;
  foto_url?: string;
}

function formatarAnosRanking(anos: number[]): string {
  const ordenados = [...anos].sort((a, b) => a - b);
  if (ordenados.length <= 1) return String(ordenados[0] ?? new Date().getFullYear());
  if (ordenados.length === 2) return ordenados.join(' e ');
  return ordenados.join(', ');
}

const CORES_UNIDADE: Record<string, string> = {
  'Amor Perfeito': '#e91e63',
  'Sempre Viva':   '#4caf50',
  'Águia Dourada': '#ff9800',
  'Leões':         '#2196f3',
  'Diretoria':     '#9c27b0',
};

interface CacheRanking {
  cfg: ConfigRanking;
  anos: number[];
  dbvs: RankingItem[];
  conselheiros: RankingItem[];
  dirs: RankingItem[];
  unidades: RankingItem[];
}

// Última carga por clube: ao voltar pra aba o ranking aparece na hora com o
// que já se sabia e é atualizado por trás, em vez de recomeçar do zero.
const cacheRanking = new Map<number, CacheRanking>();

export default function RankingScreen() {
  const corCabecalho = useCorCabecalho();
  const temaCores = useCores();
  const [aba, setAba]             = useState<Aba>('dbvs');
  const [rankDBV, setRankDBV]           = useState<RankingItem[]>([]);
  const [rankConselheiros, setRankConselheiros] = useState<RankingItem[]>([]);
  const [rankDir, setRankDir]           = useState<RankingItem[]>([]);
  const [rankUnidade, setRankUnidade]   = useState<RankingItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState(false);
  const carregandoRef = useRef(false);
  const recarregarDepoisRef = useRef(false);
  const [configRanking, setConfigRanking] = useState<ConfigRanking>(CONFIG_RANKING_RESTRITA);
  const [anosAtivos, setAnosAtivos] = useState<number[]>([new Date().getFullYear()]);
  // Extrato do próprio usuário, mostrado no lugar da lista quando o clube
  // não libera nenhum tipo de ranking pro público dele.
  const [meuExtrato, setMeuExtrato] = useState<RegistroDia[]>([]);
  const [meuResumo, setMeuResumo] = useState<ExtratoMembro | null>(null);
  const [carregandoExtrato, setCarregandoExtrato] = useState(false);
  const { getRankingGeral, getRankingUnidades, carregarConfig } = usePontuacaoStore();
  const usuario = useAuthStore((s) => s.usuario);
  const permissoes = usePermissoes();
  const membroId = permissoes.contextoAtivo?.membro_id ?? usuario?.dbv_id;

  // "Não tem nenhuma permissão de equipe" em vez de uma lista de nomes de
  // perfil: com a lista, qualquer perfil fora dela caía no ramo da diretoria
  // e a pessoa via tudo — era por isso que a configuração de membros nunca
  // pegava. Ver PERMISSOES_EQUIPE em src/lib/permissoes.ts.
  const ehMembroComum = permissoes.ehMembroComum;
  const campoTipo = ehMembroComum ? 'tipoMembros' : 'tipoDiretoria';
  const abasVisiveis = ABAS_RANKING.filter((a) => configRanking[a[campoTipo]]);
  // Sem nenhum tipo marcado pro público de quem está logado, mostra só a
  // própria posição/extrato — não existe mais um toggle "mostrar lista" à
  // parte, é só derivado de quantos tipos ficaram habilitados.
  const podeVerListaCompleta = abasVisiveis.length > 0;
  // As duas opções abaixo só valem pra DBV/pais (é o que foi pedido) — a
  // diretoria, se algum dia cair nesse mesmo cartão restrito, continua vendo
  // os dois normalmente.
  const mostrarMinhaPontuacao = podeVerListaCompleta || !ehMembroComum || configRanking.membros_ve_pontuacao;
  const mostrarMinhaPosicao = !ehMembroComum || configRanking.membros_ve_posicao;

  // Recarrega toda vez que a aba recebe foco
  useFocusEffect(
    useCallback(() => {
      carregarRanking();
    }, [ehMembroComum, permissoes.perfil, membroId, permissoes.contextoAtivo?.clube_id])
  );

  // Atualiza sozinho com a tela aberta quando alguém lança pontos em outro
  // aparelho (ou no computador).
  useRealtime(
    ['pontuacoes', 'pontuacoes_custom', 'pontuacoes_unidades', 'desbravadores'],
    () => { carregarRanking(); }
  );

  async function carregarRanking() {
    // Vários eventos de tempo real em sequência (ou o foco da aba junto com
    // um evento) disparavam cargas sobrepostas, cada uma baixando o clube
    // inteiro de novo. Agora só uma roda por vez e no máximo uma fica na fila.
    if (carregandoRef.current) {
      recarregarDepoisRef.current = true;
      return;
    }
    carregandoRef.current = true;
    setErroCarga(false);
    const clubeId = getClubeAtivoId();
    const emCache = cacheRanking.get(clubeId);
    if (emCache) {
      setConfigRanking(emCache.cfg);
      setAnosAtivos(emCache.anos);
      setRankDBV(emCache.dbvs);
      setRankConselheiros(emCache.conselheiros);
      setRankDir(emCache.dirs);
      setRankUnidade(emCache.unidades);
      setCarregando(false);
    } else {
      setCarregando(true);
    }
    try {
      const cfg = await carregarConfigRanking(clubeId);
      const anos = anosEfetivosRanking(cfg);
      const abasHabilitadas = ABAS_RANKING.filter((a) => cfg[a[campoTipo]]);
      const abaInicial: Aba = abasHabilitadas.some((a) => a.key === aba) ? aba : (abasHabilitadas[0]?.key ?? aba);
      // Quem não vê a lista completa (ou é membro comum) precisa de todos os
      // grupos pra achar a própria posição; os demais carregam primeiro só a
      // aba aberta e completam o resto por trás.
      const precisaDeTudo = abasHabilitadas.length === 0 || ehMembroComum;
      const grupos = [
        { chave: 'dbvs', grupo: 'desbravadores', aba: 'dbvs' },
        { chave: 'conselheiros', grupo: 'conselheiros', aba: 'conselheiros' },
        { chave: 'dirs', grupo: 'diretoria', aba: 'diretoria' },
      ] as const;
      const buscarGrupo = (g: typeof grupos[number]) => getRankingGeral(g.grupo, anos) as Promise<RankingItem[]>;
      const prioridade = precisaDeTudo ? [...grupos] : grupos.filter((g) => g.aba === abaInicial);
      const resto = precisaDeTudo ? [] : grupos.filter((g) => g.aba !== abaInicial);
      const unidadesNaPrimeira = precisaDeTudo || abaInicial === 'unidades';

      const novo: CacheRanking = emCache
        ? { ...emCache, cfg, anos }
        : { cfg, anos, dbvs: [], conselheiros: [], dirs: [], unidades: [] };

      const [, listasPrioritarias, unidades] = await Promise.all([
        carregarConfig(),
        Promise.all(prioridade.map(buscarGrupo)),
        unidadesNaPrimeira ? (getRankingUnidades(anos) as Promise<RankingItem[]>) : Promise.resolve(null),
      ]);
      prioridade.forEach((g, i) => { novo[g.chave] = listasPrioritarias[i]; });
      if (unidades) novo.unidades = unidades;

      setAnosAtivos(anos);
      setConfigRanking(cfg);
      // A aba selecionada pode ter ficado desabilitada pelo admin — cai pra
      // primeira aba habilitada em vez de mostrar uma tela vazia.
      if (abaInicial !== aba) setAba(abaInicial);
      setRankDBV(novo.dbvs);
      setRankConselheiros(novo.conselheiros);
      setRankDir(novo.dirs);
      setRankUnidade(novo.unidades);
      setCarregando(false);
      cacheRanking.set(clubeId, novo);

      // Membros e responsaveis tambem veem o extrato abaixo das listas.
      let extratoPromessa: Promise<void> = Promise.resolve();
      if (precisaDeTudo && membroId) {
        setCarregandoExtrato(true);
        extratoPromessa = carregarExtratoMembro(membroId, clubeId)
          .then((extrato) => {
            setMeuResumo(extrato);
            setMeuExtrato(extrato.dias);
          })
          .catch((erro) => {
            console.log('Erro ao carregar extrato próprio', erro);
            setMeuResumo(null);
            setMeuExtrato([]);
          })
          .finally(() => setCarregandoExtrato(false));
      } else {
        setMeuResumo(null);
        setMeuExtrato([]);
      }

      // Abas que não estavam abertas: completa por trás, sem travar a tela.
      const restoPromessa = Promise.all([
        Promise.all(resto.map(buscarGrupo)),
        unidadesNaPrimeira ? Promise.resolve(null) : (getRankingUnidades(anos) as Promise<RankingItem[]>),
      ]).then(([listas, unidadesResto]) => {
        resto.forEach((g, i) => { novo[g.chave] = listas[i]; });
        if (unidadesResto) novo.unidades = unidadesResto;
        setRankDBV(novo.dbvs);
        setRankConselheiros(novo.conselheiros);
        setRankDir(novo.dirs);
        setRankUnidade(novo.unidades);
        cacheRanking.set(clubeId, novo);
      }).catch((erro) => console.log('Erro ao completar ranking', erro));

      await Promise.all([extratoPromessa, restoPromessa]);
    } catch (erro) {
      console.log('Erro ao carregar ranking', erro);
      setErroCarga(true);
      if (!emCache) {
        setRankDBV([]);
        setRankConselheiros([]);
        setRankDir([]);
        setRankUnidade([]);
      }
    } finally {
      setCarregando(false);
      carregandoRef.current = false;
      if (recarregarDepoisRef.current) {
        recarregarDepoisRef.current = false;
        void carregarRanking();
      }
    }
  }

  const listaAtual =
    aba === 'dbvs'          ? rankDBV :
    aba === 'conselheiros'  ? rankConselheiros :
    aba === 'diretoria'     ? rankDir : [];
  const medalhas   = ['🥇', '🥈', '🥉'];
  const cores      = ['#FFD700', '#C0C0C0', '#CD7F32'];

  // A colocacao e relativa ao grupo real do membro. Misturar as tres listas
  // gerava uma posicao diferente daquela exibida na respectiva aba.
  const meuRanking = membroId == null
    ? []
    : [rankDBV, rankConselheiros, rankDir].find((lista) =>
        lista.some((item) => item.dbv_id === membroId)
      ) ?? [];
  const minhaPosicao = meuRanking.find((item) => item.dbv_id === membroId);
  const minhaPosicaoIndex = minhaPosicao
    ? meuRanking.findIndex((item) => item.dbv_id === membroId) + 1
    : 0;

  // Aba (categoria) em que o usuário logado aparece — fica destacada mesmo
  // quando outra aba está selecionada.
  const minhaAba: Aba | null = membroId == null ? null
    : rankDBV.some((i) => i.dbv_id === membroId) ? 'dbvs'
    : rankConselheiros.some((i) => i.dbv_id === membroId) ? 'conselheiros'
    : rankDir.some((i) => i.dbv_id === membroId) ? 'diretoria' : null;
  const scrollRef = useRef<ScrollView>(null);
  const yMinhaLinha = useRef(0);
  const pulsoMeu = usePulso(!!minhaPosicao, 1100);
  const brilhoMeu = pulsoMeu.valor.interpolate({ inputRange: [0, 1], outputRange: [0.0, 0.28] });

  if (!usuario) return <Redirect href="/auth/login" />;

  function irParaAbaVizinha(direcao: 1 | -1) {
    const atual = abasVisiveis.findIndex((a) => a.key === aba);
    if (atual < 0) return;
    const proxima = abasVisiveis[atual + direcao];
    if (proxima) setAba(proxima.key);
  }

  // Só ativa quando o movimento é claramente horizontal — assim a rolagem
  // vertical da lista continua funcionando normalmente. Desligado na Web:
  // lá o gesto capturava a rolagem do mouse/trackpad e travava a lista
  // inteira — nesse ambiente a troca de aba já é feita clicando na barra.
  const gestoTrocarAba = Gesture.Pan()
    .enabled(Platform.OS !== 'web')
    .activeOffsetX([-24, 24])
    .failOffsetY([-16, 16])
    .onEnd((ev) => {
      if (Math.abs(ev.translationX) < 60) return;
      runOnJS(irParaAbaVizinha)(ev.translationX < 0 ? 1 : -1);
    });

  function renderResumoPessoal() {
    const resumo = meuResumo ?? (minhaPosicao ? {
      nome: minhaPosicao.nome,
      unidade_nome: minhaPosicao.unidade ?? '—',
      total: minhaPosicao.total,
      dias: meuExtrato,
    } : null);

    return <View style={styles.restritoContent}>
          {podeVerListaCompleta && (
            <Text style={[styles.meuResumoTitulo, { color: temaCores.texto }]}>Minha pontuação</Text>
          )}
          {resumo ? (
            <View style={[styles.meuResumoCard, { backgroundColor: temaCores.cartao }]}>
              <Avatar nome={resumo.nome} foto_url={minhaPosicao?.foto_url} cor={CORES_UNIDADE[resumo.unidade_nome] ?? '#888'} size={56} />
              <Text style={[styles.meuResumoNome, { color: temaCores.texto }]}>{resumo.nome}</Text>
              {mostrarMinhaPontuacao && (
                <Text style={[styles.meuResumoPontos, temaCores.isEscuro && { color: '#cdbcff' }, temaCores.isEscuro && { color: '#fff' }]}>
                  {resumo.total.toLocaleString('pt-BR')} pontos
                </Text>
              )}
              {mostrarMinhaPosicao && minhaPosicaoIndex > 0 && (
                <Text style={[styles.meuResumoPosicao, { color: temaCores.textoSecundario }]}>
                  {minhaPosicaoIndex}ª colocação
                </Text>
              )}
            </View>
          ) : (
            <EstadoVazio titulo="Nenhuma pontuação registrada ainda." />
          )}

          <Text style={[styles.extratoTitulo, { color: temaCores.texto }]}>Extrato</Text>
          {carregandoExtrato ? (
            <ActivityIndicator style={{ marginTop: 16 }} color={corIcone(temaCores)} />
          ) : meuExtrato.length === 0 ? (
            <EstadoVazio titulo="Nenhum lançamento ainda." />
          ) : (
            meuExtrato.map((dia) => (
              <View key={dia.data} style={[styles.extratoDia, { backgroundColor: temaCores.cartao }]}>
                <View style={[styles.extratoDiaTopo, { borderBottomColor: temaCores.borda }]}>
                  <Text style={[styles.extratoData, { color: temaCores.texto }]}>{dia.dataFormatada}</Text>
                  <Text style={[styles.extratoSubtotal, temaCores.isEscuro && { color: '#7fdc98' }, { color: tomTexto('#2e7d32', temaCores) }]}>
                    {dia.subtotal > 0 ? '+' : ''}{dia.subtotal.toLocaleString('pt-BR')} pts
                  </Text>
                </View>
                {dia.linhas.map((linha: any, i: number) => (
                  <View key={`${dia.data}-${i}`} style={styles.extratoLinha}>
                    <Ionicons name={linha.icon as any} size={15} color={corIcone(temaCores)} />
                    <Text style={[styles.extratoLabel, { color: temaCores.texto }]} numberOfLines={1}>
                      {linha.label}
                      {linha.observacao ? <Text style={[styles.extratoObs, { color: temaCores.textoSecundario }]}>{` · ${linha.observacao}`}</Text> : null}
                    </Text>
                    <Text style={[styles.extratoPts, temaCores.isEscuro && { color: '#cdbcff' }, temaCores.isEscuro && { color: '#fff' }]}>
                      {linha.pts > 0 ? '+' : ''}{linha.pts.toLocaleString('pt-BR')}
                    </Text>
                  </View>
                ))}
              </View>
            ))
          )}
    </View>;
  }

  return (
    <View style={[styles.container, temaCores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: temaCores.fundo }]}>
      <CabecalhoTela titulo="Ranking" />

      {abasVisiveis.length > 0 && (
      <View style={styles.abasWrap}>
        <Segmentado
          opcoes={abasVisiveis.map(({ key, label }) => ({ valor: key, rotulo: label, minha: minhaAba === key }))}
          valor={aba}
          onChange={(v) => setAba(v as Aba)}
        />
      </View>
      )}

      {carregando ? (
        <ScrollView style={styles.lista} contentContainerStyle={styles.listaContent}>
          <CarregandoAcampamento corTexto={temaCores.textoSecundario} />
        </ScrollView>
      ) : !podeVerListaCompleta ? (
        <ScrollView style={styles.lista} contentContainerStyle={styles.listaContent}>{renderResumoPessoal()}</ScrollView>
      ) : (
      <GestureDetector gesture={gestoTrocarAba}>
      <ScrollView ref={scrollRef} style={styles.lista} contentContainerStyle={styles.listaContent}>
        {/* ── Aba Desbravadores, Conselheiros ou Diretoria ── */}
        {(aba === 'dbvs' || aba === 'conselheiros' || aba === 'diretoria') && (
          <>
            {/* Pódio */}
            {listaAtual.length > 0 && (
              <PodioCartao
                brilho={brilhoMeu}
                itens={listaAtual.slice(0, 3).map((it) => ({
                  chave: String(it.dbv_id ?? it.nome),
                  nome: it.nome,
                  pontos: it.total,
                  fotoUrl: it.foto_url,
                  cor: CORES_UNIDADE[it.unidade ?? ''] ?? '#888',
                  ehVoce: it.dbv_id != null && it.dbv_id === membroId,
                  aoAbrir: () => { if (it.dbv_id) router.push(`/extrato/${it.dbv_id}`); },
                }))}
              />
            )}

            {listaAtual.length > 0 && (
              <TituloSecao
                titulo="Classificação geral"
                acao={minhaPosicaoIndex > 0 && minhaAba === aba ? 'Minha posição ↓' : undefined}
                aoAcao={() => scrollRef.current?.scrollTo({ y: Math.max(0, yMinhaLinha.current - 120), animated: true })}
              />
            )}

            {/* Lista completa */}
            {listaAtual.map((item, idx) => {
              const cor = CORES_UNIDADE[item.unidade ?? ''] ?? '#888';
              const ehVoce = item.dbv_id != null && item.dbv_id === membroId;
              return (
                <TouchableOpacity
                  key={idx}
                  onLayout={ehVoce ? (e) => { yMinhaLinha.current = e.nativeEvent.layout.y; } : undefined}
                  style={[
                    styles.linha,
                    { backgroundColor: temaCores.cartao, borderColor: temaCores.borda, boxShadow: `0px 3px 0px ${temaCores.sombra}` },
                    ehVoce && { borderWidth: 3, borderColor: '#f2ad19', backgroundColor: temaCores.isEscuro ? '#40321e' : '#fff2b6' },
                  ]}
                  onPress={() => { if (item.dbv_id) router.push(`/extrato/${item.dbv_id}`); }}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={ehVoce ? `Você: ${idx + 1}º, ${item.nome}, ${item.total} pontos. Abrir seu extrato` : `${idx + 1}º, ${item.nome}, ${item.total} pontos`}
                >
                  {ehVoce ? (
                    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 15, backgroundColor: '#f2ad19', opacity: brilhoMeu }]} />
                  ) : null}
                  {idx < 3 ? (
                    <MaterialCommunityIcons name={idx === 0 ? 'medal-outline' : 'medal'} size={22} color={idx === 0 ? temaCores.acento : temaCores.textoSecundario} style={styles.linhaPos} />
                  ) : (
                    <Text style={[styles.linhaPosTexto, { color: temaCores.texto }]}>{idx + 1}</Text>
                  )}
                  <Avatar nome={item.nome} foto_url={item.foto_url} cor={cor} size={43} />
                  <View style={styles.itemInfo}>
                    <Text style={[styles.linhaNome, { color: ehVoce && !temaCores.isEscuro ? '#322049' : temaCores.texto }]} numberOfLines={2}>{item.nome}</Text>
                    <Text style={[styles.linhaSub, { color: ehVoce ? (temaCores.isEscuro ? '#e8d6b5' : '#75500e') : temaCores.textoSecundario }]}>{ehVoce ? `Você · ${item.unidade ?? ''}` : item.unidade}</Text>
                  </View>
                  <Text style={[styles.linhaPontos, { color: ehVoce ? (temaCores.isEscuro ? '#ffe59b' : '#75500e') : temaCores.acento }]}>{item.total.toLocaleString('pt-BR')}</Text>
                </TouchableOpacity>
              );
            })}

            {listaAtual.length === 0 && (erroCarga ? (
              <CenaAcampamento erro cores={temaCores} titulo="Não foi possível carregar o ranking" texto="Verifique sua conexão e tente de novo." aoTentarNovamente={() => { void carregarRanking(); }} />
            ) : (
              <CenaAcampamento cores={temaCores} titulo="Ainda não há pontuação" texto="Assim que os primeiros pontos forem lançados, o pódio aparece aqui." />
            ))}
          </>
        )}

        {/* ── Aba Unidades ── */}
        {aba === 'unidades' && (
          <>
            {rankUnidade.length > 0 && (
              <PodioCartao
                itens={rankUnidade.slice(0, 3).map((it) => ({
                  chave: String(it.unidade_id ?? it.nome),
                  nome: it.nome,
                  pontos: it.total ?? 0,
                  cor: CORES_UNIDADE[it.nome] ?? '#888',
                  bandeira: true,
                  aoAbrir: () => router.push({ pathname: '/extrato-unidade/[id]', params: { id: String(it.unidade_id ?? 0), nome: it.nome } }),
                }))}
              />
            )}
            {rankUnidade.length > 0 && <TituloSecao titulo="Classificação geral" />}

            {rankUnidade.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.linha, { backgroundColor: temaCores.cartao, borderColor: temaCores.borda, boxShadow: `0px 3px 0px ${temaCores.sombra}` }]}
                onPress={() => router.push({ pathname: '/extrato-unidade/[id]', params: { id: String(item.unidade_id ?? 0), nome: item.nome } })}
                activeOpacity={0.75}
              >
                <Text style={[styles.itemPos, temaCores.isEscuro && { color: '#d4d4de' }, { color: temaCores.textoSecundario }, idx < 3 && { color: cores[idx] }]}>
                  {idx < 3 ? medalhas[idx] : `#${idx + 1}`}
                </Text>
                <View style={[styles.unidadeDot, { backgroundColor: CORES_UNIDADE[item.nome] ?? '#888' }]} />
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemNome, temaCores.isEscuro && { color: '#f1eefc' }, { color: temaCores.texto }]}>{item.nome}</Text>
                  <Text style={[styles.itemSub, temaCores.isEscuro && { color: '#c4c4d2' }, { color: temaCores.textoSecundario }]}>
                    Membros (1,5%): {(item.total_membros ?? 0).toLocaleString('pt-BR')} • Unidade: {(item.total_direto ?? 0).toLocaleString('pt-BR')}
                  </Text>
                </View>
                <Text style={[styles.itemPts, temaCores.isEscuro && { color: '#cdbcff' }, temaCores.isEscuro && { color: '#fff' }]}>{(item.total ?? 0).toLocaleString('pt-BR')}</Text>
                <Ionicons name="chevron-forward" size={14} color={tomTexto('#ccc', temaCores)} />
              </TouchableOpacity>
            ))}

            {rankUnidade.length === 0 && (
              <EstadoVazio titulo="Nenhuma unidade com pontuação registrada ainda." />
            )}
          </>
        )}
        {ehMembroComum && membroId != null && renderResumoPessoal()}
      </ScrollView>
      </GestureDetector>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f5f3fb' },
  header:         { backgroundColor: '#4b2bb0', padding: 20, paddingTop: 52 },
  headerLine:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  headerTitle:    { color: '#fff', fontSize: 20, fontWeight: '800', flex: 1 },
  loginBtn:       { backgroundColor: '#fff', borderRadius: 22, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  loginBtnText:   { color: '#4b2bb0', fontSize: 12, fontWeight: '800' },
  abasWrap:       { paddingHorizontal: 12, paddingTop: 10 },
  abas:           { flexDirection: 'row', borderRadius: 20, padding: 4, gap: 4 },
  aba:            { flex: 1, paddingVertical: 10, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  abaAtiva:       { backgroundColor: 'rgba(255,255,255,0.20)' },
  abaText:        { color: 'rgba(255,255,255,0.85)', fontWeight: '600', fontSize: 12 },
  abaTextAtiva:   { color: '#fff', fontWeight: '800' },

  lista:          { flex: 1 },
  listaContent:   { paddingBottom: 120 },
  meuResumoTitulo: { fontSize: 17, fontWeight: '900', marginBottom: 10 },
  meuResumoCard: { alignItems: 'center', borderRadius: 16, padding: 20, gap: 6, elevation: 2 },
  meuResumoNome: { fontSize: 18, fontWeight: '900', marginTop: 6, textAlign: 'center' },
  meuResumoPontos: { fontSize: 26, fontWeight: '900', color: '#4b2bb0' },
  meuResumoPosicao: { fontSize: 15, fontWeight: '700' },
  extratoTitulo: { fontSize: 17, fontWeight: '900', marginTop: 22, marginBottom: 10 },
  extratoDia: { borderRadius: 14, marginBottom: 10, overflow: 'hidden', elevation: 1 },
  extratoDiaTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1 },
  extratoData: { fontSize: 13, fontWeight: '800', flex: 1 },
  extratoSubtotal: { fontSize: 12, fontWeight: '900', color: '#2e7d32' },
  extratoLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  extratoLabel: { flex: 1, fontSize: 13, fontWeight: '600' },
  extratoObs: { fontSize: 11, fontWeight: '400' },
  extratoPts: { fontSize: 13, fontWeight: '900', color: '#4b2bb0', minWidth: 44, textAlign: 'right' },
  restritoContent:   { padding: 16 },
  restritoCard:      { backgroundColor: '#fff', borderRadius: 18, padding: 20, alignItems: 'center', gap: 8, boxShadow: '0px 4px 0px rgba(80,38,142,0.2)' },
  restritoTitulo:    { fontSize: 15, fontWeight: '800', color: '#333', textAlign: 'center' },
  restritoTexto:     { fontSize: 13, color: '#78909c', textAlign: 'center', lineHeight: 19 },
  minhaPosicaoCard:  { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 18, padding: 16, marginTop: 16, boxShadow: '0px 4px 0px rgba(80,38,142,0.2)' },
  podio:          { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', padding: 20, paddingBottom: 0, gap: 8 },
  podioItem:      { alignItems: 'center', flex: 1 },
  podioMedalha:   { fontSize: 22, marginTop: 4, marginBottom: 2 },
  podioNome:      { fontSize: 12, fontWeight: '700', color: '#333', textAlign: 'center' },
  podioPts:       { fontSize: 11, color: '#666', marginBottom: 6 },
  podioPillar:    { width: '100%', borderTopLeftRadius: 6, borderTopRightRadius: 6, justifyContent: 'center', alignItems: 'center' },
  podioPillarNum: { color: '#2b1d00', fontWeight: '800', fontSize: 18 },

  itemLista:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, padding: 12, borderRadius: 18, elevation: 3, shadowColor: '#2a1a5e', gap: 10 },
  itemPos:        { width: 32, fontSize: 15, fontWeight: '700', color: '#555' },
  itemInfo:       { flex: 1 },
  itemNome:       { fontSize: 14, fontWeight: '600', color: '#222' },
  itemSub:        { fontSize: 12, color: '#888', marginTop: 2 },
  itemDireita:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  itemPts:        { fontSize: 15, fontWeight: '700', color: '#4b2bb0' },
  unidadeDot:     { width: 14, height: 14, borderRadius: 7 },
  unidadeAvatar:  { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  vazio:          { textAlign: 'center', color: '#999', marginTop: 40, fontSize: 14 },
  linha:          { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 17, paddingVertical: 12, paddingHorizontal: 9, marginBottom: 10, overflow: 'hidden' },
  linhaPos:       { width: 24, textAlign: 'center' },
  linhaPosTexto:  { minWidth: 24, fontSize: 15, fontWeight: '900', textAlign: 'center' },
  linhaNome:      { fontSize: 13, fontWeight: '800' },
  linhaSub:       { fontSize: 12, marginTop: 4 },
  linhaPontos:    { fontSize: 14, fontWeight: '900' },
});
