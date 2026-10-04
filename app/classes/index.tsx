import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Platform,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { buscarPaginado } from '../../src/lib/supabasePaginado';
import { getClubeAtivoId } from '../../src/lib/contextoAtual';
import { useAuthStore } from '../../src/stores/authStore';
import { useContextoStore } from '../../src/stores/contextoStore';
import { usePermissoes } from '../../src/lib/permissoes';
import { BottomNav } from '../../src/components/BottomNav';
import { AgrupadasArvore } from '../../src/components/classes/AgrupadasArvore';
import { useCores, useCorCabecalho } from '../../src/stores/temaStore';
import {
  carregarResumoCatalogoClasses,
  carregarProgressoClube,
  idadePorNascimento,
  imagemDaClasse,
  marcarClasseCompleta,
  organizarClassesParaExibicao,
  resumirPorClasseSeparado,
  nivelPara,
  type ModoClasse,
  type RequisitoResumoCatalogo,
  type ResumoClasseSeparado,
} from '../../src/lib/classesRequisitos';
import { corIcone, estiloCartao, tomTexto, corLegivel } from '../../src/lib/tema';
import { Chip, CampoBusca, EstadoVazio, TONS, Segmentado } from '../../src/components/ui';
import { CabecalhoTela } from '../../src/components/CabecalhoTela';
import { ResumoCompacto } from '../../src/components/HomeHero';
import { Avatar } from '../../src/components/common/Avatar';

const PERFIS_QUE_MARCAM = ['admin_ti', 'admin_clube', 'admin_geral', 'admin_total', 'usuario_secretaria'];

interface MembroLinha {
  id: number;
  nome: string;
  unidade: string;
  foto_url?: string | null;
  idade: number | null;
  resumos: ResumoClasseSeparado[];
  pctGeral: number;
}

function normalizar(v: string) {
  return v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const MODOS_CLASSE: { valor: ModoClasse; rotulo: string }[] = [
  { valor: 'regular', rotulo: 'Regulares' },
  { valor: 'agrupada', rotulo: 'Agrupadas' },
  { valor: 'lider', rotulo: 'Liderança' },
];

function textoVazioModo(modo: ModoClasse): string {
  if (modo === 'agrupada') return 'Nenhuma classe agrupada.';
  if (modo === 'lider') return 'Ainda não desbloqueado — conclua as classes normais (10 a 15) ou as agrupadas.';
  return 'Nenhuma classe regular disponível ainda.';
}

export default function ClassesHubScreen() {
  const cores = useCores();
  const corCabecalho = useCorCabecalho();
  const usuario = useAuthStore((s) => s.usuario);
  const contextoAtivo = useContextoStore((s) => s.contextoAtivo);
  const permissoes = usePermissoes();
  const clubeId = getClubeAtivoId();

  const verTodos = permissoes.podeAlguma([
    'admin_clube', 'gerenciar_membros', 'ver_relatorios', 'ver_unidade', 'validar_classes',
  ]);
  const ehResponsavel = permissoes.pode('ver_filhos');
  const dbvProprio = usuario?.dbv_id ?? contextoAtivo?.membro_id ?? null;

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [catalogo, setCatalogo] = useState<RequisitoResumoCatalogo[]>([]);
  const [membros, setMembros] = useState<MembroLinha[]>([]);
  const [busca, setBusca] = useState('');
  const [unidadeFiltro, setUnidadeFiltro] = useState<string>('');
  const [marcando, setMarcando] = useState<string | null>(null);
  const [modoPorMembro, setModoPorMembro] = useState<Record<number, ModoClasse>>({});
  const [membrosAbertos, setMembrosAbertos] = useState<Record<number, boolean>>({});
  const podeMarcar = permissoes.temPerfil(PERFIS_QUE_MARCAM);

  useFocusEffect(useCallback(() => { carregar(); }, [clubeId, verTodos, dbvProprio]));

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      const [cat, idsPermitidos] = await Promise.all([
        carregarResumoCatalogoClasses(),
        (async (): Promise<number[] | null> => {
          if (verTodos) return null;
          const ids = new Set<number>();
          if (dbvProprio) ids.add(dbvProprio);
          if (ehResponsavel && usuario?.id) {
            const { data, error } = await supabase
              .from('responsavel_membros')
              .select('membro_id')
              .eq('usuario_id', usuario.id)
              .eq('ativo', true);
            if (error) throw error;
            (data ?? []).forEach((r: any) => ids.add(r.membro_id));
          }
          return Array.from(ids);
        })(),
      ]);
      setCatalogo(cat);

      if (idsPermitidos?.length === 0) {
        setMembros([]);
        return;
      }

      const [membrosData, progresso] = await Promise.all([
        buscarPaginado(
          (q) => {
            const base = q.eq('clube_id', clubeId).neq('ativo', false).order('nome', { ascending: true });
            return idsPermitidos ? base.in('id', idsPermitidos) : base;
          },
          'desbravadores',
          'id,nome,unidade_nome,foto_url,data_nascimento',
        ),
        carregarProgressoClube(clubeId, idsPermitidos ?? undefined),
      ]);

      const porMembro = new Map<number, Set<number>>();
      for (const p of progresso) {
        if (!porMembro.has(p.dbv_id)) porMembro.set(p.dbv_id, new Set());
        porMembro.get(p.dbv_id)!.add(p.requisito_id);
      }

      const linhas: MembroLinha[] = membrosData.map((m: any) => {
        const idade = idadePorNascimento(m.data_nascimento);
        const resumos = resumirPorClasseSeparado(cat, porMembro.get(m.id) ?? new Set(), idade);
        const total = resumos.reduce((s, r) => s + r.total, 0);
        const feitos = resumos.reduce((s, r) => s + r.concluidos, 0);
        return {
          id: m.id,
          nome: m.nome,
          unidade: m.unidade_nome || 'Sem unidade',
          foto_url: m.foto_url,
          idade,
          resumos,
          pctGeral: total > 0 ? Math.round((feitos / total) * 100) : 0,
        };
      });
      setMembros(linhas);
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível carregar as classes.');
    } finally {
      setLoading(false);
    }
  }

  async function alternarClasseRapido(membroId: number, classeNome: string, avancada: boolean, concluir: boolean) {
    const chave = `${membroId}|${classeNome}|${avancada}`;
    if (marcando) return;
    setMarcando(chave);
    try {
      await marcarClasseCompleta({ clubeId, dbvId: membroId, classeNome, avancada, concluir });
      const prog = await carregarProgressoClube(clubeId, [membroId]);
      const concluidos = new Set(prog.map((p) => p.requisito_id));
      setMembros((prev) =>
        prev.map((m) => (m.id !== membroId ? m : {
          ...m,
          resumos: resumirPorClasseSeparado(catalogo, concluidos, m.idade),
          pctGeral: (() => {
            const resumos = resumirPorClasseSeparado(catalogo, concluidos, m.idade);
            const total = resumos.reduce((s, r) => s + r.total, 0);
            const feitos = resumos.reduce((s, r) => s + r.concluidos, 0);
            return total > 0 ? Math.round((feitos / total) * 100) : 0;
          })(),
        }))
      );
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível atualizar a classe.');
    } finally {
      setMarcando(null);
    }
  }

  const unidades = useMemo(
    () => Array.from(new Set(membros.map((m) => m.unidade))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [membros]
  );

  const visiveis = useMemo(() => {
    const termo = normalizar(busca);
    return membros.filter(
      (m) => (!termo || normalizar(m.nome).includes(termo)) && (!unidadeFiltro || m.unidade === unidadeFiltro)
    );
  }, [membros, busca, unidadeFiltro]);

  const totaisClube = useMemo(() => {
    if (visiveis.length === 0) return { pct: 0, investidos: 0, emAndamento: 0 };
    const soma = visiveis.reduce((s, m) => s + m.pctGeral, 0);
    return {
      pct: Math.round(soma / visiveis.length),
      investidos: visiveis.filter((m) => m.resumos.some((r) => r.pct === 100)).length,
      emAndamento: visiveis.filter((m) => m.pctGeral > 0 && m.pctGeral < 100).length,
    };
  }, [visiveis]);

  const semCatalogo = !loading && catalogo.length === 0;

  function alternarDropdownMembro(membroId: number) {
    setMembrosAbertos((prev) => ({ ...prev, [membroId]: !prev[membroId] }));
  }

  return (
    <View style={[styles.container, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.fundo }]}>
      <CabecalhoTela titulo="Classes & Requisitos" />

      <ScrollView contentContainerStyle={styles.scroll}>
        {loading && <ActivityIndicator size="large" color={corIcone(cores)} style={{ marginTop: 40 }} />}
        {!!erro && <EstadoVazio icone="warning-outline" titulo="Não foi possível carregar" texto={erro} acao="Tentar novamente" aoAcao={() => { void carregar(); }} />}

        {semCatalogo && (
          <View style={[styles.avisoBox, cores.isEscuro && { backgroundColor: '#413d41' }]}>
            <Ionicons name="information-circle" size={22} color={tomTexto('#b45309', cores)} />
            <Text style={[styles.avisoTexto, cores.isEscuro && { color: '#fcc35a' }]}>
              Nenhuma classe cadastrada ainda. Um administrador precisa importar o catálogo oficial em
              Modelos → Formativos.
            </Text>
          </View>
        )}

        {!loading && !semCatalogo && (
          <>
            <ResumoCompacto itens={[
              { valor: `${totaisClube.pct}%`, rotulo: 'Progresso médio' },
              { valor: totaisClube.investidos, rotulo: 'Classe completa' },
              { valor: totaisClube.emAndamento, rotulo: 'Em andamento' },
            ]} />

            {verTodos && (
              <>
                <View style={{ marginBottom: 10 }}>
                  <CampoBusca valor={busca} onChange={setBusca} placeholder="Buscar membro..." />
                </View>
                {unidades.length > 1 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={{ gap: 8 }}>
                    <Chip rotulo="Todas" ativo={!unidadeFiltro} onPress={() => setUnidadeFiltro('')} />
                    {unidades.map((u) => (
                      <Chip key={u} rotulo={u} ativo={unidadeFiltro === u} onPress={() => setUnidadeFiltro(unidadeFiltro === u ? '' : u)} />
                    ))}
                  </ScrollView>
                )}
              </>
            )}

            {visiveis.length === 0 && <EstadoVazio icone="people-outline" titulo="Nenhum membro encontrado" texto="Ajuste a busca ou o filtro de unidade." />}

            {visiveis.map((m) => {
              const nivel = nivelPara(m.pctGeral);
              const modo = modoPorMembro[m.id] ?? 'regular';
              const linhas = organizarClassesParaExibicao(m.resumos, modo, m.idade);
              const aberto = !!membrosAbertos[m.id] || visiveis.length === 1;
              const totalClasses = m.resumos.filter((r) => r.total > 0).length;
              const completas = m.resumos.filter((r) => r.total > 0 && r.concluidos >= r.total).length;
              return (
                <View key={m.id} style={{ marginBottom: 6 }}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => (visiveis.length === 1 ? router.push(`/classes/${m.id}` as any) : alternarDropdownMembro(m.id))}
                    accessibilityRole="button"
                    accessibilityLabel={`${m.nome}, ${m.unidade}, ${m.pctGeral}%`}
                    style={[styles.cardMembro, estiloCartao(cores, 17), { boxShadow: `0px 3px 0px ${cores.sombra}` }]}
                  >
                    <Avatar nome={m.nome} foto_url={m.foto_url ?? undefined} cor={nivel.cor} size={54} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.membroNome, { color: cores.texto }]} numberOfLines={1}>{m.nome}</Text>
                      <Text style={[styles.membroUnidade, { color: cores.textoSecundario }]}>{m.unidade} · {nivel.titulo} {nivel.emoji}</Text>
                    </View>
                    {visiveis.length > 1 ? (
                      <>
                        <View style={styles.resumoDireita}>
                          <Text style={[styles.pctGeral, { color: corLegivel(nivel.cor, cores) }]}>{m.pctGeral}%</Text>
                          <Text style={[styles.resumoClasses, { color: cores.textoSecundario }]}>{completas}/{totalClasses || 0}</Text>
                        </View>
                        <Ionicons name={aberto ? 'chevron-up' : 'chevron-down'} size={20} color={cores.textoSecundario} />
                      </>
                    ) : null}
                  </TouchableOpacity>

                  {aberto && (
                    <>
                      <Segmentado
                        style={styles.segmentado}
                        opcoes={MODOS_CLASSE.map((opt) => ({ valor: opt.valor, rotulo: opt.rotulo }))}
                        valor={modo}
                        onChange={(v) => setModoPorMembro((p) => ({ ...p, [m.id]: v }))}
                      />

                      {modo === 'agrupada' ? (
                        <AgrupadasArvore
                          resumos={m.resumos}
                          podeMarcar={podeMarcar}
                          estaMarcando={(r) => marcando === `${m.id}|${r.classe}|${r.avancada}`}
                          onAlternar={(r, concluir) => alternarClasseRapido(m.id, r.classe, r.avancada, concluir)}
                          onAbrirClasse={(r) => router.push(`/classes/${m.id}?chave=${encodeURIComponent(r.chave)}` as any)}
                        />
                      ) : (
                        <>
                          {linhas.length === 0 && (
                            <Text style={[styles.vazioCard, { color: cores.textoSecundario }]}>{textoVazioModo(modo)}</Text>
                          )}
                          {linhas.map((r) => {
                            const completa = r.total > 0 && r.concluidos >= r.total;
                            const naoIniciada = r.concluidos === 0;
                            const chave = `${m.id}|${r.classe}|${r.avancada}`;
                            const status = completa ? 'Concluída' : naoIniciada ? 'Não iniciada' : 'Em andamento';
                            const img = imagemDaClasse(r.classe, r.avancada);
                            return (
                              <TouchableOpacity
                                key={r.chave}
                                activeOpacity={0.85}
                                onPress={() => router.push(`/classes/${m.id}?chave=${encodeURIComponent(r.chave)}` as any)}
                                accessibilityRole="button"
                                accessibilityLabel={`${r.label}: ${r.concluidos} de ${r.total}, ${status}`}
                                style={[styles.classeLinha, { backgroundColor: cores.cartao, borderColor: cores.borda }]}
                              >
                                {podeMarcar && (
                                  <TouchableOpacity
                                    style={[styles.classeCheck, { borderColor: cores.borda }, completa && { backgroundColor: cores.primaria, borderColor: cores.primaria }]}
                                    disabled={marcando === chave}
                                    onPress={() => alternarClasseRapido(m.id, r.classe, r.avancada, !completa)}
                                    accessibilityRole="checkbox"
                                    accessibilityState={{ checked: completa }}
                                    accessibilityLabel={`Marcar ${r.label} como concluída`}
                                  >
                                    {marcando === chave
                                      ? <ActivityIndicator size="small" color={completa ? '#fff' : cores.primaria} />
                                      : completa
                                        ? <Ionicons name="checkmark" size={12} color="#fff" />
                                        : null}
                                  </TouchableOpacity>
                                )}
                                {img ? (
                                  <Image
                                    source={img}
                                    resizeMode="contain"
                                    style={[
                                      r.avancada ? styles.logoClasseAvancada : styles.logoClasse,
                                      naoIniciada && { opacity: 0.45 },
                                      naoIniciada && Platform.OS === 'web' ? ({ filter: 'grayscale(1)' } as any) : null,
                                    ]}
                                  />
                                ) : (
                                  <View style={[styles.logoClasse, { alignItems: 'center', justifyContent: 'center' }]}>
                                    <Ionicons name="ribbon" size={24} color={cores.textoSecundario} />
                                  </View>
                                )}
                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <Text style={[styles.classeNome, { color: cores.texto }]}>{r.label}</Text>
                                  <View style={[styles.barraFundo, { backgroundColor: cores.acentoSuave }]}>
                                    <View style={[styles.barraPreenchida, { width: `${r.pct}%`, backgroundColor: cores.isEscuro ? '#d2b5ff' : cores.primaria }]} />
                                  </View>
                                  <Text style={[styles.classeContagem, { color: cores.textoSecundario }]}>{r.concluidos}/{r.total} · {status}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={cores.textoSecundario} />
                              </TouchableOpacity>
                            );
                          })}
                        </>
                      )}
                    </>
                  )}
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
  container: { flex: 1, backgroundColor: '#f5f3fb' },
  header: {
    backgroundColor: '#4b2bb0',
    paddingTop: 48,
    paddingBottom: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  voltar: { padding: 4 },
  headerTitulo: { color: '#fff', fontSize: 20, fontWeight: '800' },
  catalogoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 11, paddingVertical: 7,
  },
  catalogoBtnText: { color: '#4b2bb0', fontSize: 12, fontWeight: '800' },
  headerSub: { color: '#c7d6e5', fontSize: 12, marginTop: 2 },
  scroll: { padding: 16 },
  erro: { color: '#c0392b', textAlign: 'center', marginVertical: 12 },
  vazio: { color: '#8a94a0', textAlign: 'center', marginTop: 24 },
  avisoBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#fef3c7',
    borderRadius: 18,
    padding: 14,
    alignItems: 'flex-start',
  },
  avisoTexto: { flex: 1, color: '#92400e', fontSize: 13, lineHeight: 18 },
  painel: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  painelItem: { flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 6 },
  painelNumero: { fontSize: 22, fontWeight: '800', color: '#4b2bb0' },
  painelLabel: { fontSize: 11, color: '#6b7785', marginTop: 2, textAlign: 'center' },
  busca: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1f1b33',
    marginBottom: 10,
  },
  chipsRow: { marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#e6e1f4',
    marginRight: 8,
  },
  chipAtivo: { backgroundColor: '#4b2bb0' },
  chipText: { fontSize: 12, color: '#4a5866', fontWeight: '600' },
  chipTextAtivo: { color: '#fff' },
  cardMembro: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 12 },
  cardTopo: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  // Foto 3x4 (proporcao 3:4) com selo do nivel
  fotoMoldura: { width: 45, height: 60, borderRadius: 8, borderWidth: 2, overflow: 'visible' },
  foto: { width: '100%', height: '100%', borderRadius: 6 },
  fotoVazia: { backgroundColor: '#eef2f6', alignItems: 'center', justifyContent: 'center' },
  selo: { position: 'absolute', bottom: -6, right: -6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  seloEmoji: { fontSize: 11 },
  membroNome: { fontSize: 14, fontWeight: '800' },
  membroUnidade: { fontSize: 12, marginTop: 4 },
  pctGeral: { fontSize: 18, fontWeight: '800' },
  resumoDireita: { alignItems: 'flex-end', minWidth: 44 },
  resumoClasses: { fontSize: 10, color: '#7b8794', fontWeight: '700', marginTop: 1 },
  dropdownBtn: {
    width: 34,
    height: 34,
    borderRadius: 22,
    backgroundColor: '#eef4fb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentado: { marginBottom: 16 },
  painelIcone: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  segmentoBtn: { flex: 1, paddingVertical: 7, borderRadius: 7, alignItems: 'center' },
  segmentoBtnAtivo: { backgroundColor: '#4b2bb0' },
  segmentoText: { fontSize: 11, fontWeight: '700', color: '#4a5866' },
  segmentoTextAtivo: { color: '#fff' },
  vazioCard: { fontSize: 12, color: '#9aa5b1', textAlign: 'center', paddingVertical: 8 },
  classeLinha: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 15, padding: 14, marginBottom: 10 },
  classeCabecalho: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  classeCheck: {
    width: 18, height: 18, borderRadius: 5, borderWidth: 2, borderColor: '#c3ccd6',
    alignItems: 'center', justifyContent: 'center',
  },
  pontoClasse: { width: 8, height: 8, borderRadius: 4 },
  classeToque: { flex: 1 },
  logoClasse: { width: 43, height: 43 },
  classeNome: { fontSize: 13, fontWeight: '800' },
  classeContagem: { fontSize: 11 },
  barraFundo: { height: 9, borderRadius: 20, overflow: 'hidden', marginVertical: 10 },
  barraPreenchida: { height: '100%', borderRadius: 20 },
  logoClasseAvancada: { width: 65, height: 43 },
});
