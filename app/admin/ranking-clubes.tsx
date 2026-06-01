import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { getClubeAtivoId, getProgramaAtivoId } from '../../src/lib/contextoAtual';
import { usePermissoes } from '../../src/lib/permissoes';
import { useAuthStore } from '../../src/stores/authStore';
import { BottomNav } from '../../src/components/BottomNav';

type Escopo = 'ARF' | 'CAMPORI_DSA';
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
  { id: 'CAMPORI_DSA', label: 'Campori', icon: 'flag' },
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
  if (diff <= 30) return { id: '1m', label: 'Falta até 1 mês', cor: '#1a3a5c', icon: 'notifications-outline' as const };
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
      <View style={s.container}>
        <View style={s.center}>
          <Ionicons name="lock-closed" size={48} color="#bbb" />
          <Text style={s.centerText}>Ranking de clubes disponível apenas para diretoria.</Text>
        </View>
        <BottomNav />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>🏅 Rankings Externos</Text>
          <Text style={s.subtitle}>ARF e Campori por programa</Text>
        </View>
        <TouchableOpacity onPress={carregar} style={s.reload}>
          <Ionicons name="refresh" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={s.tabs}>
        {ESCOPOS.map((e) => {
          const ativo = escopo === e.id;
          return (
            <TouchableOpacity key={e.id} style={[s.tab, ativo && s.tabAtiva]} onPress={() => setEscopo(e.id)}>
              <Ionicons name={e.icon} size={16} color={ativo ? '#fff' : '#1a3a5c'} />
              <Text style={[s.tabText, ativo && s.tabTextAtiva]}>{e.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {carregando ? (
        <View style={s.center}>
          <ActivityIndicator color="#1a3a5c" />
          <Text style={s.centerText}>Carregando ranking...</Text>
        </View>
      ) : (
        <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 32 }}>
          <View style={s.resumoCard}>
            <Text style={s.resumoLabel}>Pontuação atual</Text>
            <Text style={s.resumoNumero}>{resumo.atual.toLocaleString('pt-BR')} / {resumo.maximo.toLocaleString('pt-BR')}</Text>
            <View style={s.progressBg}>
              <View style={[s.progressFill, { width: `${resumo.percentual}%` }]} />
            </View>
            <Text style={s.percentual}>{resumo.percentual}% concluído</Text>
          </View>

          {lembretes.length > 0 && (
            <View style={s.lembretesCard}>
              <View style={s.lembretesHeader}>
                <Ionicons name="notifications" size={18} color="#ef6c00" />
                <Text style={s.lembretesTitle}>Lembretes para responsáveis</Text>
              </View>
              {lembretes.map((aviso) => (
                <View key={aviso.chave} style={[s.lembreteItem, { borderLeftColor: aviso.marco.cor }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.lembreteTitulo}>{aviso.requisito.requisito}</Text>
                    <Text style={s.lembreteMeta}>
                      {aviso.marco.label}
                      {aviso.requisito.prazo ? ` • Prazo: ${new Date(`${aviso.requisito.prazo}T00:00:00`).toLocaleDateString('pt-BR')}` : ''}
                    </Text>
                    {!!aviso.requisito.responsavel && <Text style={s.lembreteMeta}>Responsável: {aviso.requisito.responsavel}</Text>}
                  </View>
                  <Ionicons name={aviso.marco.icon} size={20} color={aviso.marco.cor} />
                  <TouchableOpacity onPress={() => fecharLembrete(aviso.chave)} style={s.fecharAviso}>
                    <Ionicons name="close" size={18} color="#789" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <View style={s.filtrosCard}>
            <Text style={s.filtroTitulo}>Status</Text>
            <View style={s.filtroRow}>
              {STATUS_OPCOES.map((op) => (
                <TouchableOpacity key={op.id} style={[s.filtroChip, filtroStatus === op.id && s.filtroChipAtivo]} onPress={() => setFiltroStatus(op.id)}>
                  <Text style={[s.filtroChipText, filtroStatus === op.id && s.filtroChipTextAtivo]}>{op.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.filtroTitulo}>Ordenar por</Text>
            <View style={s.filtroRow}>
              {ORDEM_OPCOES.map((op) => (
                <TouchableOpacity key={op.id} style={[s.filtroChip, ordenacao === op.id && s.filtroChipAtivo]} onPress={() => setOrdenacao(op.id)}>
                  <Ionicons name={op.icon} size={14} color={ordenacao === op.id ? '#fff' : '#1a3a5c'} />
                  <Text style={[s.filtroChipText, ordenacao === op.id && s.filtroChipTextAtivo]}>{op.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {responsaveis.length > 0 && (
              <>
                <Text style={s.filtroTitulo}>Responsável</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={s.filtroRow}>
                    <TouchableOpacity style={[s.filtroChip, filtroResponsavel === 'todos' && s.filtroChipAtivo]} onPress={() => setFiltroResponsavel('todos')}>
                      <Text style={[s.filtroChipText, filtroResponsavel === 'todos' && s.filtroChipTextAtivo]}>Todos</Text>
                    </TouchableOpacity>
                    {responsaveis.map((nome) => (
                      <TouchableOpacity key={nome} style={[s.filtroChip, filtroResponsavel === nome && s.filtroChipAtivo]} onPress={() => setFiltroResponsavel(nome)}>
                        <Text style={[s.filtroChipText, filtroResponsavel === nome && s.filtroChipTextAtivo]}>{nome}</Text>
                      </TouchableOpacity>
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
              <View key={r.id} style={s.reqCard}>
                <View style={s.reqTop}>
                  <View style={s.reqCodigo}>
                    <Text style={s.reqCodigoText}>{r.item_codigo || r.ordem}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.reqTitulo}>{r.requisito}</Text>
                    <View style={s.reqTags}>
                      <View style={[s.statusTag, concluido ? s.statusConcluido : s.statusPendente]}>
                        <Ionicons name={concluido ? 'checkmark-circle' : 'ellipse-outline'} size={12} color={concluido ? '#2e7d32' : '#ef6c00'} />
                        <Text style={[s.statusTagText, { color: concluido ? '#2e7d32' : '#ef6c00' }]}>
                          {concluido ? 'Concluído' : 'A cumprir'}
                        </Text>
                      </View>
                      {marco && (
                        <View style={[s.statusTag, { backgroundColor: `${marco.cor}14` }]}>
                          <Ionicons name={marco.icon} size={12} color={marco.cor} />
                          <Text style={[s.statusTagText, { color: marco.cor }]}>{marco.label}</Text>
                        </View>
                      )}
                    </View>
                    {!!r.responsavel && <Text style={s.reqMeta}>Responsável: {r.responsavel}</Text>}
                    {!!r.onde_cadastrar && <Text style={s.reqMeta}>Onde cadastrar: {r.onde_cadastrar}</Text>}
                    {!!r.prazo && <Text style={s.reqMeta}>Prazo: {new Date(`${r.prazo}T00:00:00`).toLocaleDateString('pt-BR')}</Text>}
                  </View>
                  <Text style={s.reqPontos}>{atual}/{maximo}</Text>
                </View>
                <View style={s.progressBgSmall}>
                  <View style={[s.progressFillSmall, { width: `${p}%` }]} />
                </View>
                {!!r.observacoes && <Text style={s.obs}>{r.observacoes}</Text>}
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
  container: { flex: 1, backgroundColor: '#eef3f8' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  centerText: { color: '#789', textAlign: 'center' },
  header: { backgroundColor: '#1a3a5c', paddingTop: 52, paddingBottom: 22, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { padding: 6 },
  title: { color: '#fff', fontSize: 23, fontWeight: '900' },
  subtitle: { color: '#a8c8e8', fontSize: 13, marginTop: 3 },
  reload: { padding: 8 },
  tabs: { flexDirection: 'row', padding: 12, gap: 8 },
  tab: { flex: 1, minHeight: 42, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce5ee', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  tabAtiva: { backgroundColor: '#1a3a5c', borderColor: '#1a3a5c' },
  tabText: { color: '#1a3a5c', fontWeight: '900', fontSize: 12 },
  tabTextAtiva: { color: '#fff' },
  scroll: { flex: 1, paddingHorizontal: 14 },
  resumoCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#dce5ee' },
  resumoLabel: { color: '#789', fontWeight: '800', textTransform: 'uppercase', fontSize: 11 },
  resumoNumero: { color: '#1a3a5c', fontSize: 27, fontWeight: '900', marginTop: 6 },
  progressBg: { height: 12, backgroundColor: '#e8eef5', borderRadius: 99, overflow: 'hidden', marginTop: 12 },
  progressFill: { height: 12, backgroundColor: '#2e7d32', borderRadius: 99 },
  percentual: { color: '#456', marginTop: 8, fontWeight: '700' },
  lembretesCard: { backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#f2d6b3' },
  lembretesHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  lembretesTitle: { color: '#1f2933', fontWeight: '900', fontSize: 14 },
  lembreteItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderLeftWidth: 4, borderRadius: 12, backgroundColor: '#fffaf2', marginBottom: 8 },
  lembreteTitulo: { color: '#1f2933', fontWeight: '900', fontSize: 13 },
  lembreteMeta: { color: '#667', fontSize: 11, marginTop: 2 },
  fecharAviso: { padding: 6, borderRadius: 10, backgroundColor: '#f2f5f8' },
  filtrosCard: { backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#dce5ee' },
  filtroTitulo: { color: '#789', fontWeight: '900', textTransform: 'uppercase', fontSize: 10, marginTop: 8, marginBottom: 8 },
  filtroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filtroChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#eef5fb', borderWidth: 1, borderColor: '#dce5ee' },
  filtroChipAtivo: { backgroundColor: '#1a3a5c', borderColor: '#1a3a5c' },
  filtroChipText: { color: '#1a3a5c', fontWeight: '900', fontSize: 11 },
  filtroChipTextAtivo: { color: '#fff' },
  reqCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#dce5ee' },
  reqTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  reqCodigo: { minWidth: 42, minHeight: 42, borderRadius: 12, backgroundColor: '#eef5fb', alignItems: 'center', justifyContent: 'center', padding: 6 },
  reqCodigoText: { color: '#1a3a5c', fontWeight: '900', fontSize: 11, textAlign: 'center' },
  reqTitulo: { color: '#1f2933', fontWeight: '900', fontSize: 14 },
  reqTags: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  statusTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusConcluido: { backgroundColor: '#e8f5e9' },
  statusPendente: { backgroundColor: '#fff4e5' },
  statusTagText: { fontSize: 10, fontWeight: '900' },
  reqMeta: { color: '#667', fontSize: 12, marginTop: 3 },
  reqPontos: { color: '#1a3a5c', fontWeight: '900' },
  progressBgSmall: { height: 8, backgroundColor: '#e8eef5', borderRadius: 99, overflow: 'hidden', marginTop: 12 },
  progressFillSmall: { height: 8, backgroundColor: '#f6a400', borderRadius: 99 },
  obs: { color: '#667', fontSize: 12, lineHeight: 17, marginTop: 10 },
});
