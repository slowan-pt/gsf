import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { getClubeAtivoId } from '../../src/lib/contextoAtual';
import { useAuthStore } from '../../src/stores/authStore';
import { useContextoStore } from '../../src/stores/contextoStore';
import { usePermissoes } from '../../src/lib/permissoes';
import { BottomNav } from '../../src/components/BottomNav';
import { BotaoSairFlutuante } from '../../src/components/BotaoSairFlutuante';
import { AgrupadasArvore } from '../../src/components/classes/AgrupadasArvore';
import { useAparenciaStore } from '../../src/stores/aparenciaStore';
import {
  carregarCatalogoClasses,
  carregarProgressoClube,
  idadePorNascimento,
  imagemDaClasse,
  marcarClasseCompleta,
  organizarClassesParaExibicao,
  resumirPorClasseSeparado,
  nivelPara,
  type ModoClasse,
  type RequisitoCatalogo,
  type ResumoClasseSeparado,
} from '../../src/lib/classesRequisitos';

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
  { valor: 'regular', rotulo: 'Classes regulares' },
  { valor: 'agrupada', rotulo: 'Classes agrupadas' },
  { valor: 'lider', rotulo: 'Classes de Líderes' },
];

function textoVazioModo(modo: ModoClasse): string {
  if (modo === 'agrupada') return 'Nenhuma classe agrupada.';
  if (modo === 'lider') return 'Ainda não desbloqueado — conclua as classes normais (10 a 15) ou as agrupadas.';
  return 'Nenhuma classe regular disponível ainda.';
}

export default function ClassesHubScreen() {
  const corCabecalho = useAparenciaStore((s) => s.corCabecalho);
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
  const [catalogo, setCatalogo] = useState<RequisitoCatalogo[]>([]);
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
      const cat = await carregarCatalogoClasses();
      setCatalogo(cat);

      let idsPermitidos: number[] | null = null;
      if (!verTodos) {
        const ids = new Set<number>();
        if (dbvProprio) ids.add(dbvProprio);
        if (ehResponsavel && usuario?.id) {
          const { data } = await supabase
            .from('responsavel_membros')
            .select('membro_id')
            .eq('usuario_id', usuario.id)
            .eq('ativo', true);
          (data ?? []).forEach((r: any) => ids.add(r.membro_id));
        }
        idsPermitidos = Array.from(ids);
        if (idsPermitidos.length === 0) {
          setMembros([]);
          setLoading(false);
          return;
        }
      }

      let queryMembros = supabase
        .from('desbravadores')
        .select('id,nome,unidade_nome,foto_url,data_nascimento')
        .eq('clube_id', clubeId)
        .neq('ativo', false)
        .order('nome', { ascending: true });
      if (idsPermitidos) queryMembros = queryMembros.in('id', idsPermitidos);

      const [membrosRes, progresso] = await Promise.all([
        queryMembros,
        carregarProgressoClube(clubeId, idsPermitidos ?? undefined),
      ]);
      if (membrosRes.error) throw membrosRes.error;

      const porMembro = new Map<number, Set<number>>();
      for (const p of progresso) {
        if (!porMembro.has(p.dbv_id)) porMembro.set(p.dbv_id, new Set());
        porMembro.get(p.dbv_id)!.add(p.requisito_id);
      }

      const linhas: MembroLinha[] = (membrosRes.data ?? []).map((m: any) => {
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
    <View style={styles.container}>
      <BotaoSairFlutuante />
      <View style={[styles.header, { backgroundColor: corCabecalho, paddingTop: 48, paddingBottom: 18 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitulo}>🏅 Classes & Requisitos</Text>
          <Text style={styles.headerSub}>Acompanhe a jornada de cada desbravador</Text>
        </View>
        {permissoes.temPerfil(['admin_ti', 'admin_total']) && (
          <TouchableOpacity onPress={() => router.push('/classes/catalogo' as any)} style={styles.catalogoBtn}>
            <Ionicons name="settings-outline" size={16} color="#1a3a5c" />
            <Text style={styles.catalogoBtnText}>Catálogo</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {loading && <ActivityIndicator size="large" color="#1a3a5c" style={{ marginTop: 40 }} />}
        {!!erro && <Text style={styles.erro}>{erro}</Text>}

        {semCatalogo && (
          <View style={styles.avisoBox}>
            <Ionicons name="information-circle" size={22} color="#b45309" />
            <Text style={styles.avisoTexto}>
              Nenhuma classe cadastrada ainda. Um administrador precisa importar o catálogo oficial em
              Modelos → Formativos.
            </Text>
          </View>
        )}

        {!loading && !semCatalogo && (
          <>
            <View style={styles.painel}>
              <View style={styles.painelItem}>
                <Text style={styles.painelNumero}>{totaisClube.pct}%</Text>
                <Text style={styles.painelLabel}>Progresso médio</Text>
              </View>
              <View style={styles.painelItem}>
                <Text style={styles.painelNumero}>{totaisClube.investidos}</Text>
                <Text style={styles.painelLabel}>Classe completa</Text>
              </View>
              <View style={styles.painelItem}>
                <Text style={styles.painelNumero}>{totaisClube.emAndamento}</Text>
                <Text style={styles.painelLabel}>Em andamento</Text>
              </View>
            </View>

            {verTodos && (
              <>
                <TextInput
                  style={styles.busca}
                  value={busca}
                  onChangeText={setBusca}
                  placeholder="Buscar membro..."
                  placeholderTextColor="#9aa5b1"
                />
                {unidades.length > 1 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
                    <TouchableOpacity
                      style={[styles.chip, !unidadeFiltro && styles.chipAtivo]}
                      onPress={() => setUnidadeFiltro('')}
                    >
                      <Text style={[styles.chipText, !unidadeFiltro && styles.chipTextAtivo]}>Todas</Text>
                    </TouchableOpacity>
                    {unidades.map((u) => (
                      <TouchableOpacity
                        key={u}
                        style={[styles.chip, unidadeFiltro === u && styles.chipAtivo]}
                        onPress={() => setUnidadeFiltro(unidadeFiltro === u ? '' : u)}
                      >
                        <Text style={[styles.chipText, unidadeFiltro === u && styles.chipTextAtivo]}>{u}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </>
            )}

            {visiveis.length === 0 && <Text style={styles.vazio}>Nenhum membro encontrado.</Text>}

            {visiveis.map((m) => {
              const nivel = nivelPara(m.pctGeral);
              const modo = modoPorMembro[m.id] ?? 'regular';
              const linhas = organizarClassesParaExibicao(m.resumos, modo, m.idade);
              const aberto = !!membrosAbertos[m.id];
              const totalClasses = m.resumos.filter((r) => r.total > 0).length;
              const completas = m.resumos.filter((r) => r.total > 0 && r.concluidos >= r.total).length;
              return (
                <View
                  key={m.id}
                  style={styles.cardMembro}
                >
                  <View style={styles.cardTopo}>
                    <View style={[styles.fotoMoldura, { borderColor: nivel.cor }]}>
                      {m.foto_url ? (
                        <Image source={{ uri: m.foto_url }} style={styles.foto} resizeMode="cover" />
                      ) : (
                        <View style={[styles.foto, styles.fotoVazia]}>
                          <Ionicons name="person" size={22} color="#b8c2cc" />
                        </View>
                      )}
                      <View style={[styles.selo, { backgroundColor: nivel.cor }]}>
                        <Text style={styles.seloEmoji}>{nivel.emoji}</Text>
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <TouchableOpacity onPress={() => router.push(`/classes/${m.id}` as any)} activeOpacity={0.75}>
                        <Text style={styles.membroNome} numberOfLines={1}>{m.nome}</Text>
                      </TouchableOpacity>
                      <Text style={styles.membroUnidade}>{m.unidade} · {nivel.titulo}</Text>
                    </View>
                    <View style={styles.resumoDireita}>
                      <Text style={[styles.pctGeral, { color: nivel.cor }]}>{m.pctGeral}%</Text>
                      <Text style={styles.resumoClasses}>{completas}/{totalClasses || 0}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.dropdownBtn}
                      onPress={() => alternarDropdownMembro(m.id)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name={aberto ? 'chevron-up' : 'chevron-down'} size={20} color="#1a3a5c" />
                    </TouchableOpacity>
                  </View>

                  {aberto && (
                    <>
                      <View style={styles.segmentado}>
                        {MODOS_CLASSE.map((opt) => (
                          <TouchableOpacity
                            key={opt.valor}
                            style={[styles.segmentoBtn, modo === opt.valor && styles.segmentoBtnAtivo]}
                            onPress={() => setModoPorMembro((p) => ({ ...p, [m.id]: opt.valor }))}
                          >
                            <Text style={[styles.segmentoText, modo === opt.valor && styles.segmentoTextAtivo]}>
                              {opt.rotulo}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

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
                            <Text style={styles.vazioCard}>{textoVazioModo(modo)}</Text>
                          )}
                          {linhas.map((r) => {
                            const completa = r.total > 0 && r.concluidos >= r.total;
                            const chave = `${m.id}|${r.classe}|${r.avancada}`;
                            return (
                              <View key={r.chave}>
                                <View style={styles.classeLinha}>
                                  <View style={styles.classeCabecalho}>
                                    {podeMarcar && (
                                      <TouchableOpacity
                                        style={[styles.classeCheck, completa && { backgroundColor: r.cor, borderColor: r.cor }]}
                                        disabled={marcando === chave}
                                        onPress={() => alternarClasseRapido(m.id, r.classe, r.avancada, !completa)}
                                      >
                                        {marcando === chave
                                          ? <ActivityIndicator size="small" color={completa ? '#fff' : r.cor} />
                                          : completa
                                            ? <Ionicons name="checkmark" size={12} color="#fff" />
                                            : null}
                                      </TouchableOpacity>
                                    )}
                                    {(() => {
                                      const img = imagemDaClasse(r.classe, r.avancada);
                                      return img ? (
                                        <Image source={img} style={styles.logoClasse} resizeMode="contain" />
                                      ) : (
                                        <View style={[styles.pontoClasse, { backgroundColor: r.cor }]} />
                                      );
                                    })()}
                                    <TouchableOpacity
                                      style={styles.classeToque}
                                      onPress={() => router.push(`/classes/${m.id}?chave=${encodeURIComponent(r.chave)}` as any)}
                                    >
                                      <Text style={styles.classeNome}>{r.label}</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.classeContagem}>
                                      {r.concluidos}/{r.total} · faltam {Math.max(0, r.total - r.concluidos)}
                                    </Text>
                                  </View>
                                  <View style={styles.barraFundo}>
                                    <View style={[styles.barraPreenchida, { width: `${r.pct}%`, backgroundColor: r.cor }]} />
                                  </View>
                                </View>
                              </View>
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
  container: { flex: 1, backgroundColor: '#f2f5f9' },
  header: {
    backgroundColor: '#1a3a5c',
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
  catalogoBtnText: { color: '#1a3a5c', fontSize: 12, fontWeight: '800' },
  headerSub: { color: '#c7d6e5', fontSize: 12, marginTop: 2 },
  scroll: { padding: 16 },
  erro: { color: '#c0392b', textAlign: 'center', marginVertical: 12 },
  vazio: { color: '#8a94a0', textAlign: 'center', marginTop: 24 },
  avisoBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 14,
    alignItems: 'flex-start',
  },
  avisoTexto: { flex: 1, color: '#92400e', fontSize: 13, lineHeight: 18 },
  painel: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    elevation: 2,
  },
  painelItem: { flex: 1, alignItems: 'center' },
  painelNumero: { fontSize: 22, fontWeight: '800', color: '#1a3a5c' },
  painelLabel: { fontSize: 11, color: '#6b7785', marginTop: 2, textAlign: 'center' },
  busca: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1f2933',
    marginBottom: 10,
  },
  chipsRow: { marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#e4eaf1',
    marginRight: 8,
  },
  chipAtivo: { backgroundColor: '#1a3a5c' },
  chipText: { fontSize: 12, color: '#4a5866', fontWeight: '600' },
  chipTextAtivo: { color: '#fff' },
  cardMembro: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
  },
  cardTopo: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  // Foto 3x4 (proporcao 3:4) com selo do nivel
  fotoMoldura: { width: 45, height: 60, borderRadius: 8, borderWidth: 2, overflow: 'visible' },
  foto: { width: '100%', height: '100%', borderRadius: 6 },
  fotoVazia: { backgroundColor: '#eef2f6', alignItems: 'center', justifyContent: 'center' },
  selo: { position: 'absolute', bottom: -6, right: -6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  seloEmoji: { fontSize: 11 },
  membroNome: { fontSize: 15, fontWeight: '700', color: '#1f2933' },
  membroUnidade: { fontSize: 11, color: '#7b8794', marginTop: 1 },
  pctGeral: { fontSize: 18, fontWeight: '800' },
  resumoDireita: { alignItems: 'flex-end', minWidth: 44 },
  resumoClasses: { fontSize: 10, color: '#7b8794', fontWeight: '700', marginTop: 1 },
  dropdownBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#eef4fb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentado: {
    flexDirection: 'row', backgroundColor: '#eef2f6', borderRadius: 10, padding: 3, marginBottom: 8,
  },
  segmentoBtn: { flex: 1, paddingVertical: 7, borderRadius: 7, alignItems: 'center' },
  segmentoBtnAtivo: { backgroundColor: '#1a3a5c' },
  segmentoText: { fontSize: 11, fontWeight: '700', color: '#4a5866' },
  segmentoTextAtivo: { color: '#fff' },
  vazioCard: { fontSize: 12, color: '#9aa5b1', textAlign: 'center', paddingVertical: 8 },
  classeLinha: { marginTop: 8 },
  classeCabecalho: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  classeCheck: {
    width: 18, height: 18, borderRadius: 5, borderWidth: 2, borderColor: '#c3ccd6',
    alignItems: 'center', justifyContent: 'center',
  },
  pontoClasse: { width: 8, height: 8, borderRadius: 4 },
  classeToque: { flex: 1 },
  logoClasse: { width: 20, height: 20 },
  classeNome: { flex: 1, fontSize: 12, fontWeight: '700', color: '#3e4c59' },
  classeContagem: { fontSize: 11, color: '#7b8794' },
  barraFundo: { height: 10, borderRadius: 999, backgroundColor: '#e4eaf1', overflow: 'hidden' },
  barraPreenchida: { height: '100%', borderRadius: 999 },
});
