import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import {
  agruparClasse,
  carregarCatalogoClasses,
  carregarProgressoClube,
  classesDoCatalogo,
  definirRequisito,
  nivelPara,
  resumirPorClasse,
  type ProgressoRequisito,
  type RequisitoCatalogo,
} from '../../src/lib/classesRequisitos';

const PERFIS_QUE_MARCAM = ['admin_ti', 'admin_clube', 'admin_geral', 'admin_total', 'usuario_secretaria'];

const ICONE_ORIGEM: Record<string, { icone: string; cor: string; rotulo: string }> = {
  manual: { icone: 'checkmark-circle', cor: '#16a34a', rotulo: 'Marcado pela secretaria' },
  atividade: { icone: 'clipboard', cor: '#2563eb', rotulo: 'Concluído por atividade' },
  especialidade: { icone: 'ribbon', cor: '#7c3aed', rotulo: 'Concluído pela especialidade' },
};

export default function ClasseMembroScreen() {
  const { dbvId } = useLocalSearchParams<{ dbvId: string }>();
  const membroId = Number(dbvId);
  const usuario = useAuthStore((s) => s.usuario);
  const permissoes = usePermissoes();
  const clubeId = getClubeAtivoId();
  const podeMarcar = permissoes.temPerfil(PERFIS_QUE_MARCAM);
  const podeCriarAtividade = permissoes.pode('gerenciar_atividades');

  const [loading, setLoading] = useState(true);
  const [salvandoId, setSalvandoId] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [membro, setMembro] = useState<{ nome: string; unidade: string } | null>(null);
  const [catalogo, setCatalogo] = useState<RequisitoCatalogo[]>([]);
  const [progresso, setProgresso] = useState<ProgressoRequisito[]>([]);
  const [classeAtiva, setClasseAtiva] = useState('');
  const [secoesAbertas, setSecoesAbertas] = useState<Record<string, boolean>>({});
  const [raizAberta, setRaizAberta] = useState<number | null>(null);

  useFocusEffect(useCallback(() => { carregar(); }, [clubeId, membroId]));

  async function carregar() {
    if (!Number.isFinite(membroId)) { setErro('Membro inválido.'); setLoading(false); return; }
    setLoading(true);
    setErro(null);
    try {
      const [cat, membroRes, prog] = await Promise.all([
        carregarCatalogoClasses(),
        supabase.from('desbravadores').select('nome,unidade_nome').eq('id', membroId).maybeSingle(),
        carregarProgressoClube(clubeId, [membroId]),
      ]);
      if (membroRes.error) throw membroRes.error;
      setCatalogo(cat);
      setProgresso(prog);
      setMembro(membroRes.data ? { nome: membroRes.data.nome, unidade: membroRes.data.unidade_nome || 'Sem unidade' } : null);
      const classes = classesDoCatalogo(cat);
      setClasseAtiva((atual) => (atual && classes.includes(atual) ? atual : classes[0] ?? ''));
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível carregar os requisitos.');
    } finally {
      setLoading(false);
    }
  }

  const concluidos = useMemo(() => new Set(progresso.map((p) => p.requisito_id)), [progresso]);
  const origemPorRequisito = useMemo(() => {
    const m = new Map<number, string>();
    progresso.forEach((p) => m.set(p.requisito_id, p.origem));
    return m;
  }, [progresso]);

  const classes = useMemo(() => classesDoCatalogo(catalogo), [catalogo]);
  const resumos = useMemo(() => resumirPorClasse(catalogo, concluidos), [catalogo, concluidos]);
  const resumoAtual = resumos.find((r) => r.classe === classeAtiva);
  const secoes = useMemo(
    () => (classeAtiva ? agruparClasse(catalogo, classeAtiva) : []),
    [catalogo, classeAtiva]
  );

  async function alternar(req: RequisitoCatalogo) {
    if (!podeMarcar || salvandoId) return;
    const marcado = concluidos.has(req.id);
    setSalvandoId(req.id);
    try {
      await definirRequisito({
        clubeId,
        dbvId: membroId,
        requisito: req,
        concluido: !marcado,
        usuarioId: usuario?.id ?? null,
      });
      // Recarrega para refletir efeitos cruzados (especialidade ↔ requisito).
      setProgresso(await carregarProgressoClube(clubeId, [membroId]));
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível atualizar o requisito.');
    } finally {
      setSalvandoId(null);
    }
  }

  async function gerarAtividade(req: RequisitoCatalogo) {
    if (!podeCriarAtividade || !membro) return;
    const titulo = `${classeAtiva} · ${req.codigo}${req.subitem ? `.${req.subitem}` : ''} — ${req.texto.slice(0, 70)}`;
    try {
      const { data, error } = await supabase
        .from('atividades')
        .insert({
          clube_id: clubeId,
          titulo: titulo.slice(0, 180),
          descricao: req.texto,
          destino: 'desbravador',
          dbv_id: membroId,
          dbv_nome: membro.nome,
          criado_por: usuario?.nome ?? null,
          item_formativo_tipo: 'classe',
          item_formativo_nome: classeAtiva,
          classe_requisito_id: req.id,
          gera_investidura: false,
        })
        .select('id')
        .single();
      if (error) throw error;
      await supabase.from('atividades_alvos').insert({
        clube_id: clubeId,
        atividade_id: data.id,
        tipo: 'membro',
        membro_id: membroId,
      });
      const msg = 'Atividade criada e enviada ao membro. Quando o avaliador aprovar, o requisito é marcado automaticamente.';
      if (typeof window !== 'undefined') window.alert(msg);
      else Alert.alert('Atividade criada', msg);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível criar a atividade.');
    }
  }

  function renderRequisito(req: RequisitoCatalogo, filhos: RequisitoCatalogo[]) {
    const feito = concluidos.has(req.id);
    const origem = origemPorRequisito.get(req.id);
    const info = origem ? ICONE_ORIGEM[origem] : null;
    const aberto = raizAberta === req.id;
    return (
      <View key={req.id} style={[styles.reqCard, feito && styles.reqCardFeito]}>
        <View style={styles.reqLinha}>
          <TouchableOpacity
            style={[styles.check, feito && styles.checkFeito, !podeMarcar && styles.checkBloqueado]}
            onPress={() => alternar(req)}
            disabled={!podeMarcar || salvandoId === req.id}
          >
            {salvandoId === req.id
              ? <ActivityIndicator size="small" color={feito ? '#fff' : '#1a3a5c'} />
              : feito
                ? <Ionicons name="checkmark" size={16} color="#fff" />
                : null}
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={0.7}
            onPress={() => setRaizAberta(aberto ? null : req.id)}
          >
            <Text style={[styles.reqTexto, feito && styles.reqTextoFeito]}>
              <Text style={styles.reqCodigo}>{req.codigo}{req.subitem ? `.${req.subitem}` : ''} </Text>
              {req.texto}
            </Text>
            <View style={styles.reqMeta}>
              {!!info && (
                <View style={[styles.tag, { backgroundColor: `${info.cor}1a` }]}>
                  <Ionicons name={info.icone as any} size={11} color={info.cor} />
                  <Text style={[styles.tagText, { color: info.cor }]}>{info.rotulo}</Text>
                </View>
              )}
              {!!req.especialidade_nome && (
                <View style={[styles.tag, { backgroundColor: '#ede9fe' }]}>
                  <Ionicons name="ribbon-outline" size={11} color="#7c3aed" />
                  <Text style={[styles.tagText, { color: '#7c3aed' }]}>{req.especialidade_nome}</Text>
                </View>
              )}
              {filhos.length > 0 && (
                <Text style={styles.filhosContador}>
                  {aberto ? '▾' : '▸'} {filhos.length} {filhos.length === 1 ? 'detalhe' : 'detalhes'}
                </Text>
              )}
            </View>
          </TouchableOpacity>
          {podeCriarAtividade && (
            <TouchableOpacity style={styles.btnAtividade} onPress={() => gerarAtividade(req)}>
              <Ionicons name="add-circle-outline" size={20} color="#2563eb" />
            </TouchableOpacity>
          )}
        </View>

        {aberto && filhos.map((f) => {
          const fFeito = concluidos.has(f.id);
          return (
            <View key={f.id} style={styles.filhoLinha}>
              <TouchableOpacity
                style={[styles.checkPequeno, fFeito && styles.checkFeito, !podeMarcar && styles.checkBloqueado]}
                onPress={() => alternar(f)}
                disabled={!podeMarcar || salvandoId === f.id}
              >
                {fFeito ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
              </TouchableOpacity>
              <Text style={[styles.filhoTexto, fFeito && styles.reqTextoFeito]}>
                {!!f.subitem && <Text style={styles.reqCodigo}>{f.subitem}) </Text>}
                {f.texto}
              </Text>
            </View>
          );
        })}
      </View>
    );
  }

  const nivel = nivelPara(resumoAtual?.pct ?? 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.voltar}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitulo} numberOfLines={1}>{membro?.nome ?? 'Membro'}</Text>
          <Text style={styles.headerSub}>{membro?.unidade ?? ''}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {loading && <ActivityIndicator size="large" color="#1a3a5c" style={{ marginTop: 40 }} />}
        {!!erro && <Text style={styles.erro}>{erro}</Text>}

        {!loading && classes.length === 0 && (
          <Text style={styles.vazio}>Nenhuma classe cadastrada no catálogo.</Text>
        )}

        {!loading && classes.length > 0 && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
              {resumos.map((r) => (
                <TouchableOpacity
                  key={r.classe}
                  style={[styles.chip, classeAtiva === r.classe && styles.chipAtivo]}
                  onPress={() => { setClasseAtiva(r.classe); setRaizAberta(null); }}
                >
                  <Text style={[styles.chipText, classeAtiva === r.classe && styles.chipTextAtivo]}>
                    {r.nivel.emoji} {r.classe} · {r.pct}%
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {!!resumoAtual && (
              <View style={[styles.cardProgresso, { borderColor: nivel.cor }]}>
                <Text style={styles.nivelEmoji}>{nivel.emoji}</Text>
                <Text style={[styles.nivelTitulo, { color: nivel.cor }]}>{nivel.titulo}</Text>
                <View style={styles.barraFundo}>
                  <View style={[styles.barraPreenchida, { width: `${resumoAtual.pct}%`, backgroundColor: nivel.cor }]} />
                </View>
                <Text style={styles.progressoTexto}>
                  <Text style={{ fontWeight: '800', color: nivel.cor }}>{resumoAtual.concluidos}</Text>
                  {` de ${resumoAtual.total} requisitos · faltam ${Math.max(0, resumoAtual.total - resumoAtual.concluidos)}`}
                </Text>
                {!podeMarcar && (
                  <Text style={styles.somenteLeitura}>
                    Somente admin do clube e secretaria podem marcar requisitos.
                  </Text>
                )}
              </View>
            )}

            {secoes.map((s) => {
              const aberta = secoesAbertas[s.secao] ?? true;
              const totalSecao = s.raizes.filter((r) => r.raiz.pontua).length;
              const feitosSecao = s.raizes.filter((r) => r.raiz.pontua && concluidos.has(r.raiz.id)).length;
              return (
                <View key={s.secao} style={styles.secaoBox}>
                  <TouchableOpacity
                    style={styles.secaoHeader}
                    onPress={() => setSecoesAbertas((p) => ({ ...p, [s.secao]: !aberta }))}
                  >
                    <Ionicons name={aberta ? 'chevron-down' : 'chevron-forward'} size={18} color="#1a3a5c" />
                    <Text style={styles.secaoTitulo}>{s.secao}</Text>
                    {s.avancada && <Text style={styles.badgeAvancada}>avançada</Text>}
                    <Text style={styles.secaoContagem}>{feitosSecao}/{totalSecao}</Text>
                  </TouchableOpacity>
                  {aberta && s.raizes.map(({ raiz, filhos }) => renderRequisito(raiz, filhos))}
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
  headerTitulo: { color: '#fff', fontSize: 19, fontWeight: '800' },
  headerSub: { color: '#c7d6e5', fontSize: 12, marginTop: 2 },
  scroll: { padding: 16 },
  erro: { color: '#c0392b', textAlign: 'center', marginVertical: 12 },
  vazio: { color: '#8a94a0', textAlign: 'center', marginTop: 24 },
  chipsRow: { marginBottom: 12 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, backgroundColor: '#e4eaf1', marginRight: 8 },
  chipAtivo: { backgroundColor: '#1a3a5c' },
  chipText: { fontSize: 12, color: '#4a5866', fontWeight: '700' },
  chipTextAtivo: { color: '#fff' },
  cardProgresso: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 2,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 2,
  },
  nivelEmoji: { fontSize: 34 },
  nivelTitulo: { fontSize: 16, fontWeight: '800', marginTop: 4, marginBottom: 10 },
  barraFundo: { width: '100%', height: 14, borderRadius: 999, backgroundColor: '#e4eaf1', overflow: 'hidden' },
  barraPreenchida: { height: '100%', borderRadius: 999 },
  progressoTexto: { fontSize: 13, color: '#52606d', marginTop: 8 },
  somenteLeitura: { fontSize: 11, color: '#9aa5b1', marginTop: 6, textAlign: 'center' },
  secaoBox: { marginBottom: 12 },
  secaoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  secaoTitulo: { flex: 1, fontSize: 14, fontWeight: '800', color: '#1a3a5c' },
  badgeAvancada: {
    fontSize: 9,
    fontWeight: '700',
    color: '#7c3aed',
    backgroundColor: '#ede9fe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  secaoContagem: { fontSize: 12, color: '#7b8794', fontWeight: '700' },
  reqCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, elevation: 1 },
  reqCardFeito: { backgroundColor: '#f0fdf4' },
  reqLinha: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#c3ccd6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkPequeno: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#c3ccd6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkFeito: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  checkBloqueado: { opacity: 0.45 },
  reqTexto: { fontSize: 13, color: '#1f2933', lineHeight: 19 },
  reqTextoFeito: { color: '#5c7a68' },
  reqCodigo: { fontWeight: '800', color: '#1a3a5c' },
  reqMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  tagText: { fontSize: 10, fontWeight: '700' },
  filhosContador: { fontSize: 11, color: '#7b8794', fontWeight: '600' },
  btnAtividade: { padding: 2 },
  filhoLinha: { flexDirection: 'row', gap: 8, marginTop: 8, marginLeft: 34, alignItems: 'flex-start' },
  filhoTexto: { flex: 1, fontSize: 12, color: '#52606d', lineHeight: 17 },
});
