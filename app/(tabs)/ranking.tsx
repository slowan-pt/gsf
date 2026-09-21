import { useState, useCallback } from 'react';
import { ActivityIndicator, View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { usePontuacaoStore } from '../../src/stores/pontuacaoStore';
import { useAuthStore } from '../../src/stores/authStore';
import { useRealtime } from '../../src/lib/realtime';
import { Avatar, avatarCor } from '../../src/components/common/Avatar';
import { getClubeAtivoId } from '../../src/lib/contextoAtual';
import { usePermissoes } from '../../src/lib/permissoes';
import { anosEfetivosRanking, carregarConfigRanking, CONFIG_RANKING_RESTRITA, type ConfigRanking } from '../../src/lib/rankingConfig';
import { useCores, useCorCabecalho } from '../../src/stores/temaStore';
import { corIcone } from '../../src/lib/tema';
import { carregarExtratoMembro, type RegistroDia } from '../../src/lib/extratoMembro';

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

export default function RankingScreen() {
  const corCabecalho = useCorCabecalho();
  const temaCores = useCores();
  const [aba, setAba]             = useState<Aba>('dbvs');
  const [rankDBV, setRankDBV]           = useState<RankingItem[]>([]);
  const [rankConselheiros, setRankConselheiros] = useState<RankingItem[]>([]);
  const [rankDir, setRankDir]           = useState<RankingItem[]>([]);
  const [rankUnidade, setRankUnidade]   = useState<RankingItem[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [configRanking, setConfigRanking] = useState<ConfigRanking>(CONFIG_RANKING_RESTRITA);
  const [anosAtivos, setAnosAtivos] = useState<number[]>([new Date().getFullYear()]);
  // Extrato do próprio usuário, mostrado no lugar da lista quando o clube
  // não libera nenhum tipo de ranking pro público dele.
  const [meuExtrato, setMeuExtrato] = useState<RegistroDia[]>([]);
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
    setCarregando(true);
    try {
      const clubeId = getClubeAtivoId();
      const cfg = await carregarConfigRanking(clubeId);
      const anos = anosEfetivosRanking(cfg);
      setAnosAtivos(anos);
      const [, dbvs, conselheiros, dirs, unidades] = await Promise.all([
        carregarConfig(),
        getRankingGeral('desbravadores', anos),
        getRankingGeral('conselheiros', anos),
        getRankingGeral('diretoria', anos),
        getRankingUnidades(anos),
      ]);
      setConfigRanking(cfg);
      // A aba selecionada pode ter ficado desabilitada pelo admin — cai pra
      // primeira aba habilitada em vez de mostrar uma tela vazia.
      const abasHabilitadas = ABAS_RANKING.filter((a) => cfg[a[campoTipo]]);
      if (abasHabilitadas.length > 0 && !abasHabilitadas.some((a) => a.key === aba)) {
        setAba(abasHabilitadas[0].key);
      }
      setRankDBV(dbvs);
      setRankConselheiros(conselheiros);
      setRankDir(dirs);
      setRankUnidade(unidades);

      // Membros e responsaveis tambem veem o extrato abaixo das listas.
      const temAlgumTipo = ABAS_RANKING.some((a) => cfg[a[campoTipo]]);
      if ((!temAlgumTipo || ehMembroComum) && membroId) {
        setCarregandoExtrato(true);
        try {
          const extrato = await carregarExtratoMembro(membroId, clubeId);
          setMeuExtrato(extrato.dias);
        } catch (erro) {
          console.log('Erro ao carregar extrato próprio', erro);
          setMeuExtrato([]);
        } finally {
          setCarregandoExtrato(false);
        }
      }
    } catch (erro) {
      console.log('Erro ao carregar ranking', erro);
      setRankDBV([]);
      setRankConselheiros([]);
      setRankDir([]);
      setRankUnidade([]);
    } finally {
      setCarregando(false);
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
    return <View style={styles.restritoContent}>
          {minhaPosicao ? (
            <View style={[styles.meuResumoCard, { backgroundColor: temaCores.cartao }]}>
              <Avatar nome={minhaPosicao.nome} foto_url={minhaPosicao.foto_url} cor={CORES_UNIDADE[minhaPosicao.unidade ?? ''] ?? '#888'} size={56} />
              <Text style={[styles.meuResumoNome, { color: temaCores.texto }]}>{minhaPosicao.nome}</Text>
              {mostrarMinhaPontuacao && (
                <Text style={[styles.meuResumoPontos, temaCores.isEscuro && { color: '#fff' }]}>
                  {minhaPosicao.total.toLocaleString('pt-BR')} pontos
                </Text>
              )}
              {mostrarMinhaPosicao && minhaPosicaoIndex > 0 && (
                <Text style={[styles.meuResumoPosicao, { color: temaCores.textoSecundario }]}>
                  {minhaPosicaoIndex}ª colocação
                </Text>
              )}
            </View>
          ) : (
            <Text style={[styles.vazio, { color: temaCores.textoSecundario }]}>Nenhuma pontuação registrada ainda.</Text>
          )}

          <Text style={[styles.extratoTitulo, { color: temaCores.texto }]}>Extrato</Text>
          {carregandoExtrato ? (
            <ActivityIndicator style={{ marginTop: 16 }} color={corIcone(temaCores)} />
          ) : meuExtrato.length === 0 ? (
            <Text style={[styles.vazio, { color: temaCores.textoSecundario }]}>Nenhum lançamento ainda.</Text>
          ) : (
            meuExtrato.map((dia) => (
              <View key={dia.data} style={[styles.extratoDia, { backgroundColor: temaCores.cartao }]}>
                <View style={[styles.extratoDiaTopo, { borderBottomColor: temaCores.borda }]}>
                  <Text style={[styles.extratoData, { color: temaCores.texto }]}>{dia.dataFormatada}</Text>
                  <Text style={styles.extratoSubtotal}>
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
                    <Text style={[styles.extratoPts, temaCores.isEscuro && { color: '#fff' }]}>
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
    <View style={[styles.container, { backgroundColor: temaCores.fundo }]}>
      <View style={[styles.header, { backgroundColor: corCabecalho, paddingTop: 48, paddingBottom: 18 }]}>
        <View style={styles.headerLine}>
          <Text style={styles.headerTitle}>🏆 Ranking {formatarAnosRanking(anosAtivos)}</Text>
        </View>
        <View style={[styles.abas, temaCores.isEscuro && { backgroundColor: temaCores.fundo }]}>
          {abasVisiveis.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.aba, aba === key && styles.abaAtiva, temaCores.isEscuro && aba === key && { backgroundColor: temaCores.cartao }]}
              onPress={() => setAba(key as Aba)}
            >
              <Text style={[styles.abaText, aba === key && styles.abaTextAtiva, temaCores.isEscuro && aba === key && { color: '#fff' }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {!podeVerListaCompleta ? (
        <ScrollView style={styles.lista}>{renderResumoPessoal()}</ScrollView>
      ) : (
      <GestureDetector gesture={gestoTrocarAba}>
      <ScrollView style={styles.lista}>
        {/* ── Aba Desbravadores, Conselheiros ou Diretoria ── */}
        {(aba === 'dbvs' || aba === 'conselheiros' || aba === 'diretoria') && (
          <>
            {/* Pódio */}
            {listaAtual.slice(0, 3).length > 0 && (
              <View style={styles.podio}>
                {listaAtual[1] && (
                  <TouchableOpacity style={[styles.podioItem, { marginTop: 20 }]} onPress={() => router.push(`/extrato/${listaAtual[1].dbv_id}`)} activeOpacity={0.8}>
                    <Avatar nome={listaAtual[1].nome} foto_url={listaAtual[1].foto_url} cor={CORES_UNIDADE[listaAtual[1].unidade ?? ''] ?? '#888'} size={44} />
                    <Text style={styles.podioMedalha}>🥈</Text>
                    <Text style={[styles.podioNome, { color: temaCores.texto }]}>{listaAtual[1].nome.split(' ')[0]}</Text>
                    <Text style={[styles.podioPts, { color: temaCores.textoSecundario }]}>{listaAtual[1].total.toLocaleString('pt-BR')}</Text>
                    <View style={[styles.podioPillar, { height: 70, backgroundColor: '#C0C0C0' }]}>
                      <Text style={styles.podioPillarNum}>2</Text>
                    </View>
                  </TouchableOpacity>
                )}
                {listaAtual[0] && (
                  <TouchableOpacity style={styles.podioItem} onPress={() => router.push(`/extrato/${listaAtual[0].dbv_id}`)} activeOpacity={0.8}>
                    <Avatar nome={listaAtual[0].nome} foto_url={listaAtual[0].foto_url} cor={CORES_UNIDADE[listaAtual[0].unidade ?? ''] ?? '#888'} size={52} />
                    <Text style={styles.podioMedalha}>🥇</Text>
                    <Text style={[styles.podioNome, { fontWeight: '800', color: temaCores.texto }]}>{listaAtual[0].nome.split(' ')[0]}</Text>
                    <Text style={[styles.podioPts, { color: '#B8860B' }]}>{listaAtual[0].total.toLocaleString('pt-BR')}</Text>
                    <View style={[styles.podioPillar, { height: 95, backgroundColor: '#FFD700' }]}>
                      <Text style={styles.podioPillarNum}>1</Text>
                    </View>
                  </TouchableOpacity>
                )}
                {listaAtual[2] && (
                  <TouchableOpacity style={[styles.podioItem, { marginTop: 40 }]} onPress={() => router.push(`/extrato/${listaAtual[2].dbv_id}`)} activeOpacity={0.8}>
                    <Avatar nome={listaAtual[2].nome} foto_url={listaAtual[2].foto_url} cor={CORES_UNIDADE[listaAtual[2].unidade ?? ''] ?? '#888'} size={40} />
                    <Text style={styles.podioMedalha}>🥉</Text>
                    <Text style={[styles.podioNome, { color: temaCores.texto }]}>{listaAtual[2].nome.split(' ')[0]}</Text>
                    <Text style={[styles.podioPts, { color: temaCores.textoSecundario }]}>{listaAtual[2].total.toLocaleString('pt-BR')}</Text>
                    <View style={[styles.podioPillar, { height: 55, backgroundColor: '#CD7F32' }]}>
                      <Text style={styles.podioPillarNum}>3</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Lista completa */}
            {listaAtual.map((item, idx) => {
              const cor = CORES_UNIDADE[item.unidade ?? ''] ?? '#888';
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.itemLista, { backgroundColor: temaCores.cartao }]}
                  onPress={() => item.dbv_id && router.push(`/extrato/${item.dbv_id}`)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.itemPos, { color: temaCores.textoSecundario }, idx < 3 && { color: cores[idx] }]}>
                    {idx < 3 ? medalhas[idx] : `#${idx + 1}`}
                  </Text>
                  <Avatar nome={item.nome} foto_url={item.foto_url} cor={cor} size={36} />
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemNome, { color: temaCores.texto }]}>{item.nome}</Text>
                    <Text style={[styles.itemSub, { color: temaCores.textoSecundario }]}>{item.unidade}</Text>
                  </View>
                  <View style={styles.itemDireita}>
                    <Text style={[styles.itemPts, temaCores.isEscuro && { color: '#fff' }]}>{item.total.toLocaleString('pt-BR')}</Text>
                    <Ionicons name="chevron-forward" size={14} color="#ccc" />
                  </View>
                </TouchableOpacity>
              );
            })}

            {listaAtual.length === 0 && (
              <Text style={[styles.vazio, { color: temaCores.textoSecundario }]}>Nenhuma pontuação registrada ainda.</Text>
            )}
          </>
        )}

        {/* ── Aba Unidades ── */}
        {aba === 'unidades' && (
          <>
            {rankUnidade.slice(0, 3).length > 0 && (
              <View style={styles.podio}>
                {rankUnidade[1] && (
                  <TouchableOpacity
                    style={[styles.podioItem, { marginTop: 20 }]}
                    onPress={() => router.push({ pathname: '/extrato-unidade/[id]', params: { id: String(rankUnidade[1].unidade_id ?? 0), nome: rankUnidade[1].nome } })}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.unidadeAvatar, { backgroundColor: CORES_UNIDADE[rankUnidade[1].nome] ?? '#888' }]}>
                      <Ionicons name="flag" size={22} color="#fff" />
                    </View>
                    <Text style={styles.podioMedalha}>🥈</Text>
                    <Text style={[styles.podioNome, { color: temaCores.texto }]}>{rankUnidade[1].nome}</Text>
                    <Text style={[styles.podioPts, { color: temaCores.textoSecundario }]}>{rankUnidade[1].total.toLocaleString('pt-BR')}</Text>
                    <View style={[styles.podioPillar, { height: 70, backgroundColor: '#C0C0C0' }]}>
                      <Text style={styles.podioPillarNum}>2</Text>
                    </View>
                  </TouchableOpacity>
                )}
                {rankUnidade[0] && (
                  <TouchableOpacity
                    style={styles.podioItem}
                    onPress={() => router.push({ pathname: '/extrato-unidade/[id]', params: { id: String(rankUnidade[0].unidade_id ?? 0), nome: rankUnidade[0].nome } })}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.unidadeAvatar, { width: 52, height: 52, borderRadius: 26, backgroundColor: CORES_UNIDADE[rankUnidade[0].nome] ?? '#888' }]}>
                      <Ionicons name="flag" size={26} color="#fff" />
                    </View>
                    <Text style={styles.podioMedalha}>🥇</Text>
                    <Text style={[styles.podioNome, { fontWeight: '800', color: temaCores.texto }]}>{rankUnidade[0].nome}</Text>
                    <Text style={[styles.podioPts, { color: '#B8860B' }]}>{rankUnidade[0].total.toLocaleString('pt-BR')}</Text>
                    <View style={[styles.podioPillar, { height: 95, backgroundColor: '#FFD700' }]}>
                      <Text style={styles.podioPillarNum}>1</Text>
                    </View>
                  </TouchableOpacity>
                )}
                {rankUnidade[2] && (
                  <TouchableOpacity
                    style={[styles.podioItem, { marginTop: 40 }]}
                    onPress={() => router.push({ pathname: '/extrato-unidade/[id]', params: { id: String(rankUnidade[2].unidade_id ?? 0), nome: rankUnidade[2].nome } })}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.unidadeAvatar, { width: 40, height: 40, borderRadius: 20, backgroundColor: CORES_UNIDADE[rankUnidade[2].nome] ?? '#888' }]}>
                      <Ionicons name="flag" size={20} color="#fff" />
                    </View>
                    <Text style={styles.podioMedalha}>🥉</Text>
                    <Text style={[styles.podioNome, { color: temaCores.texto }]}>{rankUnidade[2].nome}</Text>
                    <Text style={[styles.podioPts, { color: temaCores.textoSecundario }]}>{rankUnidade[2].total.toLocaleString('pt-BR')}</Text>
                    <View style={[styles.podioPillar, { height: 55, backgroundColor: '#CD7F32' }]}>
                      <Text style={styles.podioPillarNum}>3</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {rankUnidade.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.itemLista, { backgroundColor: temaCores.cartao }]}
                onPress={() => router.push({ pathname: '/extrato-unidade/[id]', params: { id: String(item.unidade_id ?? 0), nome: item.nome } })}
                activeOpacity={0.75}
              >
                <Text style={[styles.itemPos, { color: temaCores.textoSecundario }, idx < 3 && { color: cores[idx] }]}>
                  {idx < 3 ? medalhas[idx] : `#${idx + 1}`}
                </Text>
                <View style={[styles.unidadeDot, { backgroundColor: CORES_UNIDADE[item.nome] ?? '#888' }]} />
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemNome, { color: temaCores.texto }]}>{item.nome}</Text>
                  <Text style={[styles.itemSub, { color: temaCores.textoSecundario }]}>
                    Membros (1,5%): {(item.total_membros ?? 0).toLocaleString('pt-BR')} • Unidade: {(item.total_direto ?? 0).toLocaleString('pt-BR')}
                  </Text>
                </View>
                <Text style={[styles.itemPts, temaCores.isEscuro && { color: '#fff' }]}>{(item.total ?? 0).toLocaleString('pt-BR')}</Text>
                <Ionicons name="chevron-forward" size={14} color="#ccc" />
              </TouchableOpacity>
            ))}

            {rankUnidade.length === 0 && (
              <Text style={[styles.vazio, { color: temaCores.textoSecundario }]}>Nenhuma unidade com pontuação registrada ainda.</Text>
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
  container:      { flex: 1, backgroundColor: '#f0f4f8' },
  header:         { backgroundColor: '#1a3a5c', padding: 20, paddingTop: 52 },
  headerLine:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  headerTitle:    { color: '#fff', fontSize: 20, fontWeight: '800', flex: 1 },
  loginBtn:       { backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  loginBtnText:   { color: '#1a3a5c', fontSize: 12, fontWeight: '800' },
  abas:           { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 3 },
  aba:            { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  abaAtiva:       { backgroundColor: '#fff' },
  abaText:        { color: '#a8c8e8', fontWeight: '600', fontSize: 12 },
  abaTextAtiva:   { color: '#1a3a5c' },

  lista:          { flex: 1 },
  meuResumoCard: { alignItems: 'center', borderRadius: 16, padding: 20, gap: 6, elevation: 2 },
  meuResumoNome: { fontSize: 18, fontWeight: '900', marginTop: 6, textAlign: 'center' },
  meuResumoPontos: { fontSize: 26, fontWeight: '900', color: '#1a3a5c' },
  meuResumoPosicao: { fontSize: 15, fontWeight: '700' },
  extratoTitulo: { fontSize: 17, fontWeight: '900', marginTop: 22, marginBottom: 10 },
  extratoDia: { borderRadius: 14, marginBottom: 10, overflow: 'hidden', elevation: 1 },
  extratoDiaTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1 },
  extratoData: { fontSize: 13, fontWeight: '800', flex: 1 },
  extratoSubtotal: { fontSize: 12, fontWeight: '900', color: '#2e7d32' },
  extratoLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  extratoLabel: { flex: 1, fontSize: 13, fontWeight: '600' },
  extratoObs: { fontSize: 11, fontWeight: '400' },
  extratoPts: { fontSize: 13, fontWeight: '900', color: '#1a3a5c', minWidth: 44, textAlign: 'right' },
  restritoContent:   { padding: 16 },
  restritoCard:      { backgroundColor: '#fff', borderRadius: 14, padding: 20, alignItems: 'center', gap: 8, elevation: 1 },
  restritoTitulo:    { fontSize: 15, fontWeight: '800', color: '#333', textAlign: 'center' },
  restritoTexto:     { fontSize: 13, color: '#78909c', textAlign: 'center', lineHeight: 19 },
  minhaPosicaoCard:  { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 16, elevation: 1 },
  podio:          { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', padding: 20, paddingBottom: 0, gap: 8 },
  podioItem:      { alignItems: 'center', flex: 1 },
  podioMedalha:   { fontSize: 22, marginTop: 4, marginBottom: 2 },
  podioNome:      { fontSize: 12, fontWeight: '700', color: '#333', textAlign: 'center' },
  podioPts:       { fontSize: 11, color: '#666', marginBottom: 6 },
  podioPillar:    { width: '100%', borderTopLeftRadius: 6, borderTopRightRadius: 6, justifyContent: 'center', alignItems: 'center' },
  podioPillarNum: { color: '#fff', fontWeight: '800', fontSize: 18 },

  itemLista:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, padding: 12, borderRadius: 12, elevation: 1, gap: 10 },
  itemPos:        { width: 32, fontSize: 15, fontWeight: '700', color: '#555' },
  itemInfo:       { flex: 1 },
  itemNome:       { fontSize: 14, fontWeight: '600', color: '#222' },
  itemSub:        { fontSize: 12, color: '#888', marginTop: 2 },
  itemDireita:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  itemPts:        { fontSize: 15, fontWeight: '700', color: '#1a3a5c' },
  unidadeDot:     { width: 14, height: 14, borderRadius: 7 },
  unidadeAvatar:  { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  vazio:          { textAlign: 'center', color: '#999', marginTop: 40, fontSize: 14 },
});
