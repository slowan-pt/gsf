import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { getClubeAtivoId } from '../../src/lib/contextoAtual';
import { useAuthStore } from '../../src/stores/authStore';
import { usePermissoes } from '../../src/lib/permissoes';
import { BottomNav } from '../../src/components/BottomNav';
import { RequisitoLinha, type ContextoRequisito } from '../../src/components/classes/RequisitoLinha';
import { AgrupadasArvore } from '../../src/components/classes/AgrupadasArvore';
import { useAparenciaStore } from '../../src/stores/aparenciaStore';
import {
  agruparClasse,
  carregarCatalogoClasses,
  carregarEspecialidadesElegiveis,
  carregarProgressoClube,
  classeLiderBloqueada,
  CLASSES_LIDER,
  definirRequisito,
  ehClasseAgrupada,
  estadoGrupos,
  idadePorNascimento,
  imagemDaClasse,
  marcarClasseCompleta,
  necessariasParaFilhos,
  organizarClassesParaExibicao,
  raizControladaPorFilhos,
  resumirPorClasseSeparado,
  vincularEspecialidadeARequisito,
  type ModoClasse,
  type ProgressoRequisito,
  type RequisitoCatalogo,
} from '../../src/lib/classesRequisitos';

function modoDaClasse(classeNome: string): ModoClasse {
  if (ehClasseAgrupada(classeNome)) return 'agrupada';
  if (CLASSES_LIDER.includes(classeNome)) return 'lider';
  return 'regular';
}

const PERFIS_QUE_MARCAM = ['admin_ti', 'admin_clube', 'admin_geral', 'admin_total', 'usuario_secretaria'];

const MODOS_CLASSE: { valor: ModoClasse; rotulo: string }[] = [
  { valor: 'regular', rotulo: 'Classes regulares' },
  { valor: 'agrupada', rotulo: 'Classes agrupadas' },
  { valor: 'lider', rotulo: 'Classes de Líderes' },
];

function textoVazioModo(modo: ModoClasse): string {
  if (modo === 'agrupada') return 'Nenhuma classe agrupada no catálogo.';
  if (modo === 'lider') return 'Nenhuma classe de líder no catálogo.';
  return 'Nenhuma classe regular disponível ainda.';
}

export default function ClasseMembroScreen() {
  const corCabecalho = useAparenciaStore((s) => s.corCabecalho);
  const { dbvId, chave: chaveParam } = useLocalSearchParams<{ dbvId: string; chave?: string }>();
  const membroId = Number(dbvId);
  const chaveParamAplicada = useRef(false);
  const usuario = useAuthStore((s) => s.usuario);
  const permissoes = usePermissoes();
  const clubeId = getClubeAtivoId();

  const podeMarcar = permissoes.temPerfil(PERFIS_QUE_MARCAM);

  const [loading, setLoading] = useState(true);
  const [salvandoId, setSalvandoId] = useState<number | null>(null);
  const [salvandoTudo, setSalvandoTudo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [membro, setMembro] = useState<{ nome: string; unidade: string; foto: string | null; idade: number | null } | null>(null);
  const [catalogo, setCatalogo] = useState<RequisitoCatalogo[]>([]);
  const [progresso, setProgresso] = useState<ProgressoRequisito[]>([]);
  const [chaveAtiva, setChaveAtiva] = useState('');
  const [secoesAbertas, setSecoesAbertas] = useState<Record<string, boolean>>({});
  const [modoClasse, setModoClasse] = useState<ModoClasse>('regular');
  const [nomesUsuarios, setNomesUsuarios] = useState<Map<string, string>>(new Map());
  const scrollRef = useRef<ScrollView>(null);
  const cardYRef = useRef(0);

  function selecionarERolar(chave: string) {
    setChaveAtiva(chave);
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, cardYRef.current - 12), animated: true });
    }, 80);
  }

  useFocusEffect(useCallback(() => { carregar(); }, [clubeId, membroId]));

  async function carregar() {
    if (!Number.isFinite(membroId)) { setErro('Membro inválido.'); setLoading(false); return; }
    setLoading(true);
    setErro(null);
    try {
      const [cat, membroRes, prog] = await Promise.all([
        carregarCatalogoClasses(),
        supabase.from('desbravadores').select('nome,unidade_nome,foto_url,data_nascimento').eq('id', membroId).maybeSingle(),
        carregarProgressoClube(clubeId, [membroId]),
      ]);
      if (membroRes.error) throw membroRes.error;
      setCatalogo(cat);
      setProgresso(prog);
      const idsQuemMarcou = Array.from(new Set(prog.map((p) => p.concluido_por).filter((id): id is string => !!id)));
      if (idsQuemMarcou.length > 0) {
        const { data: usuariosData } = await supabase.from('usuarios').select('id,nome').in('id', idsQuemMarcou);
        setNomesUsuarios(new Map((usuariosData ?? []).map((u: any) => [u.id as string, u.nome as string])));
      } else {
        setNomesUsuarios(new Map());
      }
      const idadeMembro = idadePorNascimento(membroRes.data?.data_nascimento);
      setMembro(
        membroRes.data
          ? { nome: membroRes.data.nome, unidade: membroRes.data.unidade_nome || 'Sem unidade', foto: membroRes.data.foto_url ?? null, idade: idadeMembro }
          : null
      );
      const resumosNovos = resumirPorClasseSeparado(cat, new Set(prog.map((p) => p.requisito_id)), idadeMembro);
      const chaves = resumosNovos.map((r) => r.chave);

      if (!chaveParamAplicada.current && chaveParam && chaves.includes(chaveParam)) {
        chaveParamAplicada.current = true;
        const alvo = resumosNovos.find((r) => r.chave === chaveParam);
        if (alvo) setModoClasse(modoDaClasse(alvo.classe));
        setChaveAtiva(chaveParam);
        return;
      }
      setChaveAtiva((atual) => (atual && chaves.includes(atual) ? atual : chaves[0] ?? ''));
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível carregar os requisitos.');
    } finally {
      setLoading(false);
    }
  }

  const concluidos = useMemo(() => new Set(progresso.map((p) => p.requisito_id)), [progresso]);
  const origens = useMemo(() => {
    const m = new Map<number, string>();
    progresso.forEach((p) => m.set(p.requisito_id, p.origem));
    return m;
  }, [progresso]);
  const especialidadeVinculada = useMemo(() => {
    const m = new Map<number, string>();
    progresso.forEach((p) => { if (p.especialidade_vinculada) m.set(p.requisito_id, p.especialidade_vinculada); });
    return m;
  }, [progresso]);
  const nomesQuemMarcou = useMemo(() => {
    const m = new Map<number, string>();
    progresso.forEach((p) => {
      if (p.concluido_por) {
        const nome = nomesUsuarios.get(p.concluido_por);
        if (nome) m.set(p.requisito_id, nome);
      }
    });
    return m;
  }, [progresso, nomesUsuarios]);

  const resumos = useMemo(
    () => resumirPorClasseSeparado(catalogo, concluidos, membro?.idade),
    [catalogo, concluidos, membro?.idade]
  );
  const resumosVisiveis = useMemo(
    () => organizarClassesParaExibicao(resumos, modoClasse, membro?.idade),
    [resumos, modoClasse, membro?.idade]
  );
  useEffect(() => {
    if (resumosVisiveis.length === 0) return;
    if (!resumosVisiveis.some((r) => r.chave === chaveAtiva)) {
      setChaveAtiva(resumosVisiveis[0].chave);
    }
  }, [resumosVisiveis, chaveAtiva]);
  const resumoAtual = resumos.find((r) => r.chave === chaveAtiva);
  const secoes = useMemo(
    () => (resumoAtual ? agruparClasse(catalogo, resumoAtual.classe, resumoAtual.avancada, membro?.idade) : []),
    [catalogo, resumoAtual, membro?.idade]
  );
  const grupos = useMemo(() => estadoGrupos(catalogo, concluidos), [catalogo, concluidos]);

  /** filho.id -> {raiz, filhos} do grupo dele, pra reconciliar a raiz depois de marcar/desmarcar um filho. */
  const paiDoFilho = useMemo(() => {
    const mapa = new Map<number, { raiz: RequisitoCatalogo; filhos: RequisitoCatalogo[] }>();
    for (const s of secoes) {
      for (const grupo of s.raizes) {
        for (const f of grupo.filhos) mapa.set(f.id, grupo);
      }
    }
    return mapa;
  }, [secoes]);

  function bloqueadoPorGrupo(req: RequisitoCatalogo) {
    if (!req.grupo_escolha) return false;
    const g = grupos.get(req.grupo_escolha);
    return !!g && g.completo && !concluidos.has(req.id);
  }

  async function recarregarProgresso() {
    const novo = await carregarProgressoClube(clubeId, [membroId]);
    setProgresso(novo);
    return novo;
  }

  async function alternar(req: RequisitoCatalogo) {
    if (!podeMarcar || salvandoId) return;
    // Raiz com marcação derivada dos filhos: nunca marca direto (a UI já
    // desabilita o toque, isso aqui é só uma trava de segurança a mais).
    const filhosDoReq = secoes.flatMap((s) => s.raizes).find((g) => g.raiz.id === req.id)?.filhos ?? [];
    if (raizControladaPorFilhos(req, filhosDoReq)) return;

    setSalvandoId(req.id);
    try {
      await definirRequisito({
        clubeId, dbvId: membroId, requisito: req,
        concluido: !concluidos.has(req.id), usuarioId: usuario?.id ?? null,
      });
      let progressoAtual = await recarregarProgresso();

      // Reconcilia a raiz do grupo, se esse requisito for um filho.
      const grupo = paiDoFilho.get(req.id);
      if (grupo) {
        const concluidosAtuais = new Set(progressoAtual.map((p) => p.requisito_id));
        const necessarias = necessariasParaFilhos(grupo.filhos);
        const marcadas = grupo.filhos.filter((f) => concluidosAtuais.has(f.id)).length;
        const deveEstarConcluido = marcadas >= necessarias;
        const raizJaEsta = concluidosAtuais.has(grupo.raiz.id);
        if (deveEstarConcluido !== raizJaEsta) {
          await definirRequisito({
            clubeId, dbvId: membroId, requisito: grupo.raiz,
            concluido: deveEstarConcluido, usuarioId: usuario?.id ?? null, origem: 'automatico',
          });
          await recarregarProgresso();
        }
      }
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível atualizar o requisito.');
    } finally {
      setSalvandoId(null);
    }
  }

  async function escolherEspecialidade(req: RequisitoCatalogo, especialidadeNome: string | null) {
    try {
      await vincularEspecialidadeARequisito({
        clubeId, dbvId: membroId, requisito: req, especialidadeNome, usuarioId: usuario?.id ?? null,
      });
      await recarregarProgresso();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível vincular a especialidade.');
    }
  }

  async function alternarClasseCompleta(concluir: boolean) {
    if (!podeMarcar || salvandoTudo || !resumoAtual) return;
    setSalvandoTudo(true);
    try {
      await marcarClasseCompleta({
        clubeId, dbvId: membroId, classeNome: resumoAtual.classe, avancada: resumoAtual.avancada, concluir,
      });
      await recarregarProgresso();
      if (concluir) {
        const msg = `Classe ${resumoAtual.label} marcada como concluída! Ela já aparece em "Receber" na ficha do membro, aguardando validação.`;
        if (typeof window !== 'undefined') window.alert(msg);
        else Alert.alert('Concluída', msg);
      }
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível atualizar a classe.');
    } finally {
      setSalvandoTudo(false);
    }
  }

  const ctx: ContextoRequisito = {
    concluidos, origens, nomesQuemMarcou, especialidadeVinculada, podeMarcar, salvandoId, onAlternar: alternar,
    carregarEspecialidadesElegiveis: (req, area) =>
      carregarEspecialidadesElegiveis({ clubeId, dbvId: membroId, area, requisitoId: req.id }),
    onEscolherEspecialidade: escolherEspecialidade,
    dbvId: membroId, usuarioId: usuario?.id ?? null, usuarioNome: usuario?.nome ?? null,
    onEspecialidadeAvulsaMarcada: recarregarProgresso,
  };
  const cor = resumoAtual?.cor ?? '#64748b';
  const classeCompleta = !!resumoAtual && resumoAtual.total > 0 && resumoAtual.concluidos >= resumoAtual.total;
  const classeBloqueadaMarcar =
    !!resumoAtual && classeLiderBloqueada(resumoAtual.classe, resumoAtual.avancada, resumos, membro?.idade);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: corCabecalho, paddingTop: 48, paddingBottom: 18 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.voltar}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.fotoMoldura}>
          {membro?.foto ? (
            <Image source={{ uri: membro.foto }} style={styles.foto} resizeMode="cover" />
          ) : (
            <View style={[styles.foto, styles.fotoVazia]}>
              <Ionicons name="person" size={20} color="#8fa3b8" />
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitulo} numberOfLines={1}>{membro?.nome ?? 'Membro'}</Text>
          <Text style={styles.headerSub}>{membro?.unidade ?? ''}</Text>
        </View>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
        {loading && <ActivityIndicator size="large" color="#1a3a5c" style={{ marginTop: 40 }} />}
        {!!erro && <Text style={styles.erro}>{erro}</Text>}
        {!loading && resumos.length === 0 && <Text style={styles.vazio}>Nenhuma classe no catálogo.</Text>}

        {!loading && resumos.length > 0 && (
          <>
            <View style={styles.segmentado}>
              {MODOS_CLASSE.map((opt) => (
                <TouchableOpacity
                  key={opt.valor}
                  style={[styles.segmentoBtn, modoClasse === opt.valor && styles.segmentoBtnAtivo]}
                  onPress={() => setModoClasse(opt.valor)}
                >
                  <Text style={[styles.segmentoText, modoClasse === opt.valor && styles.segmentoTextAtivo]}>
                    {opt.rotulo}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {modoClasse === 'agrupada' ? (
              <AgrupadasArvore resumos={resumos} chaveSelecionada={chaveAtiva} onSelecionar={selecionarERolar} />
            ) : (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
                  {resumosVisiveis.map((r) => {
                    const imgChip = imagemDaClasse(r.classe, r.avancada);
                    return (
                      <TouchableOpacity
                        key={r.chave}
                        style={[styles.chip, chaveAtiva === r.chave && { backgroundColor: r.cor }]}
                        onPress={() => setChaveAtiva(r.chave)}
                      >
                        {imgChip ? (
                          <Image source={imgChip} style={styles.logoChip} resizeMode="contain" />
                        ) : (
                          <View style={[styles.pontoChip, { backgroundColor: chaveAtiva === r.chave ? '#fff' : r.cor }]} />
                        )}
                        <Text style={[styles.chipText, chaveAtiva === r.chave && styles.chipTextAtivo]}>
                          {r.label} · {r.pct}%
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {resumosVisiveis.length === 0 && (
                  <Text style={styles.vazio}>{textoVazioModo(modoClasse)}</Text>
                )}
              </>
            )}

            {!!resumoAtual && resumosVisiveis.some((r) => r.chave === resumoAtual.chave) && (
              <View
                style={[styles.cardProgresso, { borderColor: cor }]}
                onLayout={(e) => { cardYRef.current = e.nativeEvent.layout.y; }}
              >
                {(() => {
                  const imgGrande = imagemDaClasse(resumoAtual.classe, resumoAtual.avancada);
                  return imgGrande ? (
                    <Image source={imgGrande} style={styles.logoGrande} resizeMode="contain" />
                  ) : (
                    <View style={[styles.pontoGrande, { backgroundColor: cor }]} />
                  );
                })()}
                <Text style={[styles.nivelTitulo, { color: cor }]}>{resumoAtual.label}</Text>
                <View style={styles.barraFundo}>
                  <View style={[styles.barraPreenchida, { width: `${resumoAtual.pct}%`, backgroundColor: cor }]} />
                </View>
                <Text style={styles.progressoTexto}>
                  <Text style={{ fontWeight: '800', color: cor }}>{resumoAtual.concluidos}</Text>
                  {` de ${resumoAtual.total} requisitos · faltam ${Math.max(0, resumoAtual.total - resumoAtual.concluidos)}`}
                </Text>

                {classeBloqueadaMarcar && (
                  <Text style={styles.somenteLeitura}>
                    Conclua a etapa anterior de Líderes primeiro para marcar requisitos aqui.
                  </Text>
                )}

                {podeMarcar && !classeBloqueadaMarcar && (
                  <TouchableOpacity
                    style={[styles.btnClasseCompleta, classeCompleta && styles.btnClasseCompletaOn]}
                    onPress={() => alternarClasseCompleta(!classeCompleta)}
                    disabled={salvandoTudo}
                  >
                    {salvandoTudo
                      ? <ActivityIndicator size="small" color={classeCompleta ? '#fff' : '#16a34a'} />
                      : <Ionicons name={classeCompleta ? 'checkmark-circle' : 'checkmark-circle-outline'} size={18} color={classeCompleta ? '#fff' : '#16a34a'} />}
                    <Text style={[styles.btnClasseCompletaText, classeCompleta && { color: '#fff' }]}>
                      {classeCompleta ? 'Classe completa — toque para desmarcar tudo' : 'Marcar toda a classe como concluída'}
                    </Text>
                  </TouchableOpacity>
                )}

                {!podeMarcar && !classeBloqueadaMarcar && (
                  <Text style={styles.somenteLeitura}>
                    Só admin do clube e secretaria marcam requisitos como concluídos.
                  </Text>
                )}
              </View>
            )}

            {resumosVisiveis.some((r) => r.chave === chaveAtiva) && secoes.map((s) => {
              const aberta = secoesAbertas[s.secao] ?? true;
              const total = s.raizes.filter((r) => r.raiz.pontua).length;
              const feitos = s.raizes.filter((r) => r.raiz.pontua && concluidos.has(r.raiz.id)).length;
              return (
                <View key={s.secao} style={styles.secaoBox}>
                  <TouchableOpacity
                    style={styles.secaoHeader}
                    onPress={() => setSecoesAbertas((p) => ({ ...p, [s.secao]: !aberta }))}
                  >
                    <Ionicons name={aberta ? 'chevron-down' : 'chevron-forward'} size={18} color="#1a3a5c" />
                    <Text style={styles.secaoTitulo}>{s.secao}</Text>
                    {s.avancada && <Text style={styles.badgeAvancada}>avançada</Text>}
                    <Text style={styles.secaoContagem}>{feitos}/{total}</Text>
                  </TouchableOpacity>
                  {aberta && s.raizes.map(({ raiz, filhos }) => (
                    <RequisitoLinha
                      key={raiz.id}
                      requisito={raiz}
                      filhos={filhos}
                      bloqueado={bloqueadoPorGrupo(raiz) || classeBloqueadaMarcar}
                      ctx={ctx}
                    />
                  ))}
                </View>
              );
            })}
          </>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f5f9' },
  header: {
    backgroundColor: '#1a3a5c', paddingTop: 48, paddingBottom: 16, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  voltar: { padding: 2 },
  fotoMoldura: { width: 39, height: 52, borderRadius: 7, borderWidth: 2, borderColor: '#7fa8cc', overflow: 'hidden' },
  foto: { width: '100%', height: '100%' },
  fotoVazia: { backgroundColor: '#2b5079', alignItems: 'center', justifyContent: 'center' },
  headerTitulo: { color: '#fff', fontSize: 17, fontWeight: '800' },
  headerSub: { color: '#c7d6e5', fontSize: 12, marginTop: 2 },
  scroll: { padding: 16 },
  erro: { color: '#c0392b', textAlign: 'center', marginVertical: 12 },
  vazio: { color: '#8a94a0', textAlign: 'center', marginTop: 24 },
  segmentado: {
    flexDirection: 'row', backgroundColor: '#e4eaf1', borderRadius: 12, padding: 4, marginBottom: 12,
  },
  segmentoBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  segmentoBtnAtivo: { backgroundColor: '#1a3a5c' },
  segmentoText: { fontSize: 12, fontWeight: '700', color: '#4a5866' },
  segmentoTextAtivo: { color: '#fff' },
  chipsRow: { marginBottom: 12 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, backgroundColor: '#e4eaf1', marginRight: 8,
  },
  pontoChip: { width: 8, height: 8, borderRadius: 4 },
  logoChip: { width: 16, height: 16 },
  pontoGrande: { width: 34, height: 34, borderRadius: 17 },
  logoGrande: { width: 56, height: 56, marginBottom: 4 },
  chipText: { fontSize: 12, color: '#4a5866', fontWeight: '700' },
  chipTextAtivo: { color: '#fff' },
  cardProgresso: {
    backgroundColor: '#fff', borderRadius: 18, borderWidth: 2, padding: 18,
    alignItems: 'center', marginBottom: 16, elevation: 2,
  },
  nivelTitulo: { fontSize: 16, fontWeight: '800', marginTop: 4, marginBottom: 10 },
  barraFundo: { width: '100%', height: 14, borderRadius: 999, backgroundColor: '#e4eaf1', overflow: 'hidden' },
  barraPreenchida: { height: '100%', borderRadius: 999 },
  progressoTexto: { fontSize: 13, color: '#52606d', marginTop: 8 },
  somenteLeitura: { fontSize: 11, color: '#9aa5b1', marginTop: 6, textAlign: 'center' },
  btnClasseCompleta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#16a34a', borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 14, marginTop: 12, alignSelf: 'stretch',
  },
  btnClasseCompletaOn: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  btnClasseCompletaText: { fontSize: 12, fontWeight: '700', color: '#16a34a', textAlign: 'center', flexShrink: 1 },
  secaoBox: { marginBottom: 12 },
  secaoHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 4 },
  secaoTitulo: { flex: 1, fontSize: 14, fontWeight: '800', color: '#1a3a5c' },
  badgeAvancada: {
    fontSize: 9, fontWeight: '700', color: '#7c3aed', backgroundColor: '#ede9fe',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden',
  },
  secaoContagem: { fontSize: 12, color: '#7b8794', fontWeight: '700' },
});
