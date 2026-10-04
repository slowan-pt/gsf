import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { getClubeAtivoId, getProgramaAtivoId } from '../../src/lib/contextoAtual';
import { usePermissoes } from '../../src/lib/permissoes';
import { useAuthStore } from '../../src/stores/authStore';
import { BottomNav } from '../../src/components/BottomNav';
import { useCores, useCorCabecalho } from '../../src/stores/temaStore';
import { corIcone, tomTexto, corLegivel } from '../../src/lib/tema';
import { CabecalhoTela } from '../../src/components/CabecalhoTela';
import { Chip } from '../../src/components/ui';

type Escopo = 'ARF';
type FiltroStatus = 'todos' | 'a_cumprir' | 'concluido';
type Ordenacao = 'ordem' | 'status' | 'prazo' | 'responsavel';

interface Requisito {
  id: string;
  escopo: Escopo;
  item_codigo: string | null;
  requisito: string;
  responsavel: string | null;
  estrategia: string | null;
  onde_cadastrar: string | null;
  pontuacao_maxima: number;
  prazo: string | null;
  observacoes: string | null;
  ordem: number;
}

interface PontuacaoClube {
  requisito_id: string;
  pontos_atuais: number;
  observacao: string | null;
}

const ESCOPOS: Array<{ id: Escopo; label: string; icon: any }> = [
  { id: 'ARF', label: 'ARF', icon: 'ribbon' },
];

const STATUS_OPCOES: Array<{ id: FiltroStatus; label: string }> = [
  { id: 'todos', label: 'Todos' },
  { id: 'a_cumprir', label: 'A cumprir' },
  { id: 'concluido', label: 'Concluídos' },
];

const ORDEM_OPCOES: Array<{ id: Ordenacao; label: string; icon: any }> = [
  { id: 'ordem', label: 'Ordem', icon: 'list' },
  { id: 'status', label: 'Status', icon: 'checkmark-circle' },
  { id: 'prazo', label: 'Prazo', icon: 'calendar' },
  { id: 'responsavel', label: 'Responsável', icon: 'person' },
];

function num(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function pct(atual: number, maximo: number) {
  if (!maximo) return 0;
  return Math.max(0, Math.min(100, Math.round((atual / maximo) * 100)));
}

function normalizar(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function dataLocal(data: string | null) {
  if (!data) return null;
  const d = new Date(`${data}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function diasAte(data: string | null) {
  const alvo = dataLocal(data);
  if (!alvo) return null;
  const hoje = new Date();
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.ceil((alvo.getTime() - base.getTime()) / 86400000);
}

function marcoPrazo(diff: number | null) {
  if (diff == null) return null;
  if (diff < 0) return { id: 'vencido', label: 'Vencido', cor: '#c62828', icon: 'alert-circle' as const };
  if (diff === 0) return { id: 'hoje', label: 'Vence hoje', cor: '#c62828', icon: 'alert-circle' as const };
  if (diff <= 3) return { id: '3d', label: 'Faltam até 3 dias', cor: '#ef6c00', icon: 'alarm' as const };
  if (diff <= 14) return { id: '2s', label: 'Faltam até 2 semanas', cor: '#f6a400', icon: 'time' as const };
  if (diff <= 21) return { id: '3s', label: 'Faltam até 3 semanas', cor: '#1565c0', icon: 'notifications' as const };
  if (diff <= 30) return { id: '1m', label: 'Falta até 1 mês', cor: '#4b2bb0', icon: 'notifications-outline' as const };
  return null;
}

function responsavelCombinaUsuario(responsavel: string | null, nomeUsuario?: string | null, email?: string | null) {
  if (!responsavel) return true;
  const resp = normalizar(responsavel);
  const tokens = [
    ...(nomeUsuario ?? '').split(/\s+/),
    (email ?? '').split('@')[0] ?? '',
  ].map(normalizar).filter((t) => t.length >= 3);
  return tokens.length === 0 || tokens.some((t) => resp.includes(t));
}

export default function RankingClubesScreen() {
  const corCabecalho = useCorCabecalho();
  const cores = useCores();
  const permissoes = usePermissoes();
  const usuario = useAuthStore((s) => s.usuario);
  const [escopo, setEscopo] = useState<Escopo>('ARF');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [filtroResponsavel, setFiltroResponsavel] = useState<string>('todos');
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('ordem');
  const [avisosFechados, setAvisosFechados] = useState<Record<string, boolean>>(() => {
    try {
      if (typeof localStorage === 'undefined') return {};
      return JSON.parse(localStorage.getItem('ranking_clube_avisos_fechados') ?? '{}');
    } catch {
      return {};
    }
  });
  const [requisitos, setRequisitos] = useState<Requisito[]>([]);
  const [pontuacoes, setPontuacoes] = useState<Record<string, PontuacaoClube>>({});
  const [carregando, setCarregando] = useState(true);

  const podeVer = permissoes.pode('ver_relatorios') || permissoes.pode('gerenciar_clubes');
  // Quem acompanha o checklist no dia a dia — pode marcar cada requisito
  // como concluído ou voltar pra pendente.
  const podeEditar = permissoes.temPerfil(['admin_ti', 'admin_clube', 'usuario_secretaria']);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  async function alternarConclusao(r: Requisito) {
    const atual = num(pontuacoes[r.id]?.pontos_atuais);
    const maximo = num(r.pontuacao_maxima);
    const concluido = maximo > 0 && atual >= maximo;
    const novoValor = concluido ? 0 : maximo;
    const clubeId = getClubeAtivoId();

    setSalvandoId(r.id);
    const anterior = pontuacoes[r.id];
    setPontuacoes((p) => ({ ...p, [r.id]: { requisito_id: r.id, pontos_atuais: novoValor, observacao: anterior?.observacao ?? null } }));
    try {
      const { error } = await supabase
        .from('ranking_clubes_pontuacoes')
        .upsert(
          { clube_id: clubeId, requisito_id: r.id, pontos_atuais: novoValor, atualizado_por: usuario?.id ?? null, updated_at: new Date().toISOString() },
          { onConflict: 'clube_id,requisito_id' }
        );
      if (error) throw error;
    } catch {
      setPontuacoes((p) => ({ ...p, [r.id]: anterior ?? { requisito_id: r.id, pontos_atuais: 0, observacao: null } }));
    } finally {
      setSalvandoId(null);
    }
  }

  useFocusEffect(useCallback(() => {
    carregar();
  }, []));

  async function carregar() {
    setCarregando(true);
    const clubeId = getClubeAtivoId();
    const programaId = getProgramaAtivoId();
    const [{ data: reqs }, { data: pontos }] = await Promise.all([
      supabase
        .from('ranking_clubes_requisitos')
        .select('*')
        .eq('programa_id', programaId)
        .eq('ativo', true)
        .order('escopo')
        .order('ordem'),
      supabase
        .from('ranking_clubes_pontuacoes')
        .select('*')
        .eq('clube_id', clubeId),
    ]);
    setRequisitos((reqs ?? []) as Requisito[]);
    const mapa: Record<string, PontuacaoClube> = {};
    for (const p of (pontos ?? []) as PontuacaoClube[]) mapa[p.requisito_id] = p;
    setPontuacoes(mapa);
    setCarregando(false);
  }

  const responsaveis = useMemo(() => {
    const nomes = requisitos
      .filter((r) => r.escopo === escopo && r.responsavel)
      .map((r) => r.responsavel!.trim())
      .filter(Boolean);
    return Array.from(new Set(nomes)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [requisitos, escopo]);

  const listaBase = useMemo(() => requisitos.filter((r) => r.escopo === escopo), [requisitos, escopo]);
  const lista = useMemo(() => {
    const filtrada = listaBase.filter((r) => {
      const atual = num(pontuacoes[r.id]?.pontos_atuais);
      const maximo = num(r.pontuacao_maxima);
      const concluido = maximo > 0 && atual >= maximo;
      if (filtroStatus === 'concluido' && !concluido) return false;
      if (filtroStatus === 'a_cumprir' && concluido) return false;
      if (filtroResponsavel !== 'todos' && r.responsavel !== filtroResponsavel) return false;
      return true;
    });
    return [...filtrada].sort((a, b) => {
      if (ordenacao === 'status') {
        const ca = num(pontuacoes[a.id]?.pontos_atuais) >= num(a.pontuacao_maxima) ? 1 : 0;
        const cb = num(pontuacoes[b.id]?.pontos_atuais) >= num(b.pontuacao_maxima) ? 1 : 0;
        return ca - cb || a.ordem - b.ordem;
      }
      if (ordenacao === 'prazo') {
        const da = dataLocal(a.prazo)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const db = dataLocal(b.prazo)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return da - db || a.ordem - b.ordem;
      }
      if (ordenacao === 'responsavel') {
        return (a.responsavel ?? 'zz').localeCompare(b.responsavel ?? 'zz', 'pt-BR') || a.ordem - b.ordem;
      }
      return a.ordem - b.ordem;
    });
  }, [listaBase, pontuacoes, filtroStatus, filtroResponsavel, ordenacao]);
  const resumo = useMemo(() => {
    const maximo = listaBase.reduce((acc, r) => acc + num(r.pontuacao_maxima), 0);
    const atual = listaBase.reduce((acc, r) => acc + num(pontuacoes[r.id]?.pontos_atuais), 0);
    return { atual, maximo, percentual: pct(atual, maximo) };
  }, [listaBase, pontuacoes]);

  const lembretes = useMemo(() => {
    return listaBase
      .map((r) => {
        const atual = num(pontuacoes[r.id]?.pontos_atuais);
        const maximo = num(r.pontuacao_maxima);
        const concluido = maximo > 0 && atual >= maximo;
        const diff = diasAte(r.prazo);
        const marco = marcoPrazo(diff);
        if (concluido || !marco) return null;
        if (!responsavelCombinaUsuario(r.responsavel, usuario?.nome, usuario?.email)) return null;
        const chave = `${r.id}:${marco.id}`;
        if (avisosFechados[chave]) return null;
        return { requisito: r, diff, marco, chave, atual, maximo };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => (a.diff ?? 999) - (b.diff ?? 999))
      .slice(0, 5) as Array<{ requisito: Requisito; diff: number | null; marco: NonNullable<ReturnType<typeof marcoPrazo>>; chave: string; atual: number; maximo: number }>;
  }, [listaBase, pontuacoes, usuario?.nome, usuario?.email, avisosFechados]);

  function fecharLembrete(chave: string) {
    const novo = { ...avisosFechados, [chave]: true };
    setAvisosFechados(novo);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ranking_clube_avisos_fechados', JSON.stringify(novo));
      }
    } catch {}
  }

  if (!podeVer) {
    return (
      <View style={[s.container, cores.isEscuro && { backgroundColor: '#3e3b4b' }, { backgroundColor: cores.fundo }]}>
        <View style={s.center}>
          <Ionicons name="lock-closed" size={48} color={cores.textoSecundario} />
          <Text style={[s.centerText, { color: cores.textoSecundario }]}>Ranking de clubes disponível apenas para diretoria.</Text>
        </View>
        <BottomNav />
      </View>
    );
  }

  return (
    <View style={[s.container, cores.isEscuro && { backgroundColor: '#3e3b4b' }, { backgroundColor: cores.fundo }]}>
      <CabecalhoTela titulo="Rankings Externos" />

      {/* Com um único escopo não há o que escolher — o seletor só reapareceria
          se outro ranking externo voltasse a existir. */}
      {ESCOPOS.length > 1 && (
        <View style={s.tabs}>
          {ESCOPOS.map((e) => {
            const ativo = escopo === e.id;
            return (
              <TouchableOpacity key={e.id} style={[s.tab, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, { backgroundColor: cores.cartao, borderColor: cores.borda }, ativo && s.tabAtiva]} onPress={() => setEscopo(e.id)}>
                <Ionicons name={e.icon} size={16} color={ativo ? '#fff' : tomTexto('#4b2bb0', cores)} />
                <Text style={[s.tabText, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }, ativo && s.tabTextAtiva]}>{e.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {carregando ? (
        <View style={s.center}>
          <ActivityIndicator color={corIcone(cores)} />
          <Text style={[s.centerText, { color: cores.textoSecundario }]}>Carregando ranking...</Text>
        </View>
      ) : (
        <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 32 }}>
          <View style={[s.resumoCard, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, { backgroundColor: cores.cartao, borderColor: cores.borda }]}>
            <Text style={[s.resumoLabel, { color: cores.textoSecundario }]}>Pontuação atual</Text>
            <Text style={[s.resumoNumero, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>{resumo.atual.toLocaleString('pt-BR')} / {resumo.maximo.toLocaleString('pt-BR')}</Text>
            <View style={[s.progressBg, cores.isEscuro && { backgroundColor: '#1d1932' }]}>
              <View style={[s.progressFill, { width: `${resumo.percentual}%` }]} />
            </View>
            <Text style={[s.percentual, cores.isEscuro && { color: '#acb4bb' }, { color: cores.textoSecundario }]}>{resumo.percentual}% concluído</Text>
          </View>

          {lembretes.length > 0 && (
            <View style={[s.lembretesCard, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, { backgroundColor: cores.cartao }]}>
              <View style={s.lembretesHeader}>
                <Ionicons name="notifications" size={18} color={tomTexto('#ef6c00', cores)} />
                <Text style={[s.lembretesTitle, cores.isEscuro && { color: '#f1eefc' }, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>Lembretes para responsáveis</Text>
              </View>
              {lembretes.map((aviso) => (
                <View key={aviso.chave} style={[s.lembreteItem, cores.isEscuro && { backgroundColor: '#1d1932' }, { borderLeftColor: aviso.marco.cor }, cores.isEscuro && { backgroundColor: 'rgba(255,167,38,0.12)' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.lembreteTitulo, cores.isEscuro && { color: '#f1eefc' }, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>{aviso.requisito.requisito}</Text>
                    <Text style={[s.lembreteMeta, cores.isEscuro && { color: '#cfd0dc' }, { color: cores.textoSecundario }]}>
                      {aviso.marco.label}
                      {aviso.requisito.prazo ? ` • Prazo: ${new Date(`${aviso.requisito.prazo}T00:00:00`).toLocaleDateString('pt-BR')}` : ''}
                    </Text>
                    {!!aviso.requisito.responsavel && <Text style={[s.lembreteMeta, cores.isEscuro && { color: '#cfd0dc' }, { color: cores.textoSecundario }]}>Responsável: {aviso.requisito.responsavel}</Text>}
                  </View>
                  <Ionicons name={aviso.marco.icon} size={20} color={corLegivel(aviso.marco.cor, cores, 3)} />
                  <TouchableOpacity onPress={() => fecharLembrete(aviso.chave)} style={[s.fecharAviso, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.fundo }]}>
                    <Ionicons name="close" size={18} color={cores.textoSecundario} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <View style={[s.filtrosCard, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, { backgroundColor: cores.cartao, borderColor: cores.borda }]}>
            <Text style={[s.filtroTitulo, { color: cores.textoSecundario }]}>Status</Text>
            <View style={s.filtroRow}>
              {STATUS_OPCOES.map((op) => (
                <Chip key={op.id} rotulo={op.label} ativo={!!(filtroStatus === op.id)} onPress={() => setFiltroStatus(op.id)} />
              ))}
            </View>

            <Text style={[s.filtroTitulo, { color: cores.textoSecundario }]}>Ordenar por</Text>
            <View style={s.filtroRow}>
              {ORDEM_OPCOES.map((op) => (
                <TouchableOpacity key={op.id} style={[s.filtroChip, cores.isEscuro && { backgroundColor: '#3e3b4b', borderColor: '#322c52' }, { backgroundColor: cores.fundo, borderColor: cores.borda }, ordenacao === op.id && s.filtroChipAtivo]} onPress={() => setOrdenacao(op.id)}>
                  <Ionicons name={op.icon} size={14} color={ordenacao === op.id ? '#fff' : tomTexto('#4b2bb0', cores)} />
                  <Text style={[s.filtroChipText, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }, ordenacao === op.id && s.filtroChipTextAtivo]}>{op.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {responsaveis.length > 0 && (
              <>
                <Text style={[s.filtroTitulo, { color: cores.textoSecundario }]}>Responsável</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={s.filtroRow}>
                    <Chip rotulo="Todos" ativo={!!(filtroResponsavel === 'todos')} onPress={() => setFiltroResponsavel('todos')} />
                    {responsaveis.map((nome) => (
                      <Chip key={nome} rotulo={nome} ativo={!!(filtroResponsavel === nome)} onPress={() => setFiltroResponsavel(nome)} />
                    ))}
                  </View>
                </ScrollView>
              </>
            )}
          </View>

          {lista.map((r) => {
            const atual = num(pontuacoes[r.id]?.pontos_atuais);
            const maximo = num(r.pontuacao_maxima);
            const p = pct(atual, maximo);
            const concluido = maximo > 0 && atual >= maximo;
            const diff = diasAte(r.prazo);
            const marco = concluido ? null : marcoPrazo(diff);
            return (
              <View key={r.id} style={[s.reqCard, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, { backgroundColor: cores.cartao, borderColor: cores.borda }]}>
                <View style={s.reqTop}>
                  <View style={[s.reqCodigo, cores.isEscuro && { backgroundColor: '#3e3b4b' }, { backgroundColor: cores.fundo }]}>
                    <Text style={[s.reqCodigoText, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>{r.item_codigo || r.ordem}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.reqTitulo, cores.isEscuro && { color: '#f1eefc' }, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>{r.requisito}</Text>
                    <View style={s.reqTags}>
                      <View style={[s.statusTag, concluido ? [s.statusConcluido, cores.isEscuro && { backgroundColor: '#1d1932' }] : [s.statusPendente, cores.isEscuro && { backgroundColor: '#413d47' }]]}>
                        <Ionicons name={concluido ? 'checkmark-circle' : 'ellipse-outline'} size={12} color={concluido ? tomTexto('#2e7d32', cores) : tomTexto('#ef6c00', cores)} />
                        <Text style={[s.statusTagText, { color: concluido ? tomTexto('#2e7d32', cores) : tomTexto('#ef6c00', cores) }]}>
                          {concluido ? 'Concluído' : 'A cumprir'}
                        </Text>
                      </View>
                      {marco && (
                        <View style={[s.statusTag, { backgroundColor: `${marco.cor}14` }]}>
                          <Ionicons name={marco.icon} size={12} color={corLegivel(marco.cor, cores, 3)} />
                          <Text style={[s.statusTagText, { color: corLegivel(marco.cor, cores) }]}>{marco.label}</Text>
                        </View>
                      )}
                    </View>
                    {!!r.responsavel && <Text style={[s.reqMeta, cores.isEscuro && { color: '#cfd0dc' }, { color: cores.textoSecundario }]}>Responsável: {r.responsavel}</Text>}
                    {!!r.onde_cadastrar && <Text style={[s.reqMeta, cores.isEscuro && { color: '#cfd0dc' }, { color: cores.textoSecundario }]}>Onde cadastrar: {r.onde_cadastrar}</Text>}
                    {!!r.prazo && <Text style={[s.reqMeta, cores.isEscuro && { color: '#cfd0dc' }, { color: cores.textoSecundario }]}>Prazo: {new Date(`${r.prazo}T00:00:00`).toLocaleDateString('pt-BR')}</Text>}
                  </View>
                  <Text style={[s.reqPontos, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>{atual}/{maximo}</Text>
                </View>
                <View style={[s.progressBgSmall, cores.isEscuro && { backgroundColor: '#1d1932' }]}>
                  <View style={[s.progressFillSmall, { width: `${p}%` }]} />
                </View>
                {!!r.observacoes && <Text style={[s.obs, cores.isEscuro && { color: '#cfd0dc' }, { color: cores.textoSecundario }]}>{r.observacoes}</Text>}
                {podeEditar && (
                  <TouchableOpacity
                    style={[s.marcarBtn, concluido && [s.marcarBtnConcluido, cores.isEscuro && { backgroundColor: '#1d1932' }]]}
                    onPress={() => alternarConclusao(r)}
                    disabled={salvandoId === r.id}
                  >
                    {salvandoId === r.id ? (
                      <ActivityIndicator size="small" color={concluido ? tomTexto('#2e7d32', cores) : tomTexto('#4b2bb0', cores)} />
                    ) : (
                      <Ionicons name={concluido ? 'refresh' : 'checkmark-circle'} size={16} color={concluido ? tomTexto('#2e7d32', cores) : '#fff'} />
                    )}
                    <Text style={[s.marcarBtnText, concluido && [s.marcarBtnTextConcluido, cores.isEscuro && { color: '#7fdc98' }]]}>
                      {concluido ? 'Marcar como pendente' : 'Marcar como concluído'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#efeaf9' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  centerText: { color: '#789', textAlign: 'center' },
  header: { backgroundColor: '#4b2bb0', paddingTop: 52, paddingBottom: 22, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { padding: 6 },
  title: { color: '#fff', fontSize: 23, fontWeight: '900' },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 3 },
  reload: { padding: 8 },
  tabs: { flexDirection: 'row', padding: 12, gap: 8 },
  tab: { flex: 1, minHeight: 42, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd5f0', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  tabAtiva: { backgroundColor: '#4b2bb0', borderColor: '#4b2bb0' },
  tabText: { color: '#4b2bb0', fontWeight: '900', fontSize: 12 },
  tabTextAtiva: { color: '#fff' },
  scroll: { flex: 1, paddingHorizontal: 14 },
  resumoCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#ddd5f0' },
  resumoLabel: { color: '#789', fontWeight: '800', textTransform: 'uppercase', fontSize: 11 },
  resumoNumero: { color: '#4b2bb0', fontSize: 27, fontWeight: '900', marginTop: 6 },
  progressBg: { height: 12, backgroundColor: '#e8eef5', borderRadius: 99, overflow: 'hidden', marginTop: 12 },
  progressFill: { height: 12, backgroundColor: '#2e7d32', borderRadius: 99 },
  percentual: { color: '#456', marginTop: 8, fontWeight: '700' },
  lembretesCard: { backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#f2d6b3' },
  lembretesHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  lembretesTitle: { color: '#1f1b33', fontWeight: '900', fontSize: 14 },
  lembreteItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderLeftWidth: 4, borderRadius: 18, backgroundColor: '#fffaf2', marginBottom: 8 },
  lembreteTitulo: { color: '#1f1b33', fontWeight: '900', fontSize: 13 },
  lembreteMeta: { color: '#667', fontSize: 11, marginTop: 2 },
  fecharAviso: { padding: 6, borderRadius: 10, backgroundColor: '#f2f5f8' },
  filtrosCard: { backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#ddd5f0' },
  filtroTitulo: { color: '#789', fontWeight: '900', textTransform: 'uppercase', fontSize: 10, marginTop: 8, marginBottom: 8 },
  filtroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filtroChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#efeaf9', borderWidth: 1, borderColor: '#ddd5f0' },
  filtroChipAtivo: { backgroundColor: '#4b2bb0', borderColor: '#4b2bb0' },
  filtroChipText: { color: '#4b2bb0', fontWeight: '900', fontSize: 11 },
  filtroChipTextAtivo: { color: '#fff' },
  reqCard: { backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#ddd5f0' },
  reqTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  reqCodigo: { minWidth: 42, minHeight: 42, borderRadius: 12, backgroundColor: '#efeaf9', alignItems: 'center', justifyContent: 'center', padding: 6 },
  reqCodigoText: { color: '#4b2bb0', fontWeight: '900', fontSize: 11, textAlign: 'center' },
  reqTitulo: { color: '#1f1b33', fontWeight: '900', fontSize: 14 },
  reqTags: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  statusTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusConcluido: { backgroundColor: '#e8f5e9' },
  statusPendente: { backgroundColor: '#fff4e5' },
  statusTagText: { fontSize: 10, fontWeight: '900' },
  reqMeta: { color: '#667', fontSize: 12, marginTop: 3 },
  reqPontos: { color: '#4b2bb0', fontWeight: '900' },
  progressBgSmall: { height: 8, backgroundColor: '#e8eef5', borderRadius: 99, overflow: 'hidden', marginTop: 12 },
  progressFillSmall: { height: 8, backgroundColor: '#f6a400', borderRadius: 99 },
  obs: { color: '#667', fontSize: 12, lineHeight: 17, marginTop: 10 },
  marcarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 12, paddingVertical: 9, borderRadius: 22, backgroundColor: '#4b2bb0',
  },
  marcarBtnConcluido: { backgroundColor: '#e8f5e9' },
  marcarBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  marcarBtnTextConcluido: { color: '#2e7d32' },
});
